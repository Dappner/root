from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Literal

from jetflow import AsyncAgent, action
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import get_logger
from app.integrations.llm import create_llm_client
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository
from app.repositories.source_section_repository import SourceSectionRepository
from app.schemas.citation_location import AvLocation, TranscriptLocation
from app.schemas.citations import LOCATION_ADAPTER
from app.schemas.rag import ModelConfig

logger = get_logger(__name__)

# Skip sectioning for transcripts shorter than this; too little material to chunk usefully.
MIN_DURATION_SEC = 600

# Hard upper bound on the LLM call so a hung provider can't delay embedding.
LLM_TIMEOUT_SEC = 30.0

MIN_SECTIONS = 3
MAX_SECTIONS = 20
MAX_TITLE_LEN = 120

SECTIONING_MODEL: Literal["gemini-3.5-flash-lite"] = "gemini-3.5-flash-lite"

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "transcript_sectioning.md"
SYSTEM_PROMPT = _PROMPT_FILE.read_text().strip()


class AutoSection(BaseModel):
    start_sec: int = Field(ge=0)
    end_sec: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=MAX_TITLE_LEN)

    @model_validator(mode="after")
    def _check_order(self) -> "AutoSection":
        if self.end_sec <= self.start_sec:
            raise ValueError("end_sec must be greater than start_sec")
        return self


class AutoSectionList(BaseModel):
    sections: list[AutoSection]


@action(schema=AutoSectionList, exit=True)
def finish_sections(result: AutoSectionList) -> str:
    return result.model_dump_json()


class TranscriptSectioningService:
    """Generates flat semantic section headers for podcast/video transcripts.

    Best-effort: any failure is swallowed by the caller. The service still tries
    to degrade gracefully so a bad LLM response, timeout, or DB error doesn't bubble.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        llm_api_key: str | None = None,
    ) -> None:
        self.session_factory = session_factory
        self._llm_api_key = llm_api_key
        self._section_repo = SourceSectionRepository()
        self._citation_repo = CitationRepository()
        self._capture_repo = CaptureRepository()

    async def generate(self, source_ids: list[int], utterances: list[dict]) -> None:
        """Generate sections from `utterances` and persist to every source in `source_ids`.

        Transcripts are shared across users (one R2 object per episode/video), so the
        LLM call is made once and the resulting rows are fanned out to every linked
        user-source. Pass a single-element list when only one source needs updating.
        """
        if not source_ids:
            return

        if not self._llm_api_key:
            logger.info(
                "No LLM API key configured; skipping auto-sectioning for sources %s",
                source_ids,
            )
            return

        if not utterances:
            logger.info("No utterances; skipping auto-sectioning for sources %s", source_ids)
            return

        duration = _compute_duration(utterances)
        if duration < MIN_DURATION_SEC:
            logger.info(
                "Transcript too short (%.0fs < %ds); skipping auto-sectioning for sources %s",
                duration,
                MIN_DURATION_SEC,
                source_ids,
            )
            return

        try:
            sections = await asyncio.wait_for(
                self._call_llm(utterances, duration),
                timeout=LLM_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Auto-sectioning timed out after %.0fs for sources %s",
                LLM_TIMEOUT_SEC,
                source_ids,
            )
            return
        except Exception as e:
            logger.warning(
                "Auto-sectioning LLM call failed for sources %s: %s",
                source_ids,
                e,
                exc_info=True,
            )
            return

        validated = _validate_sections(sections, total_duration=duration)
        if validated is None:
            logger.warning(
                "Auto-sectioning LLM response failed validation for sources %s",
                source_ids,
            )
            return

        for source_id in source_ids:
            try:
                await self._persist(source_id, validated)
            except Exception as e:
                logger.warning(
                    "Auto-sectioning persist failed for source %s: %s",
                    source_id,
                    e,
                    exc_info=True,
                )
                continue
            logger.info("Wrote %d auto sections for source %s", len(validated), source_id)

    async def _call_llm(self, utterances: list[dict], duration: float) -> list[AutoSection]:
        prompt = _build_prompt(utterances, duration)
        client = create_llm_client(
            ModelConfig(provider="gemini", model=SECTIONING_MODEL, thinking_level="minimal")
        )
        agent = AsyncAgent(
            client=client,
            actions=[finish_sections],
            system_prompt=SYSTEM_PROMPT,
            require_action=True,
            max_iter=1,
            verbose=False,
        )
        response = await agent.run(prompt)
        payload = json.loads(response.content or "{}")
        return AutoSectionList.model_validate(payload).sections

    async def _persist(self, source_id: int, sections: list[AutoSection]) -> None:
        async with self.session_factory() as db:
            async with db.begin():
                await self._section_repo.replace_auto_sections(
                    db,
                    source_id=source_id,
                    sections=[
                        {
                            "source_id": source_id,
                            "title": s.title,
                            "range_start": s.start_sec,
                            "range_end": s.end_sec,
                            "order_index": 0,
                            "generated_by": "auto",
                        }
                        for s in sections
                    ],
                )
                await self._section_repo.restamp_order_index(db, source_id)

                # Slot existing AV citations into the freshly written sections,
                # then have linked captures inherit. Matching happens in Python
                # rather than SQL: the equivalent UPDATE...FROM (SELECT ... LIMIT 1)
                # over JSONB has triggered a Postgres planner crash
                # ("rt_fetch used out-of-bounds") on some plan shapes, and the
                # data per source is small enough that a Python pass is simpler
                # and safer. Both passes are non-destructive: a citation/capture
                # whose location doesn't match any section keeps its current
                # section_id.
                await self._backfill_citation_sections(db, source_id)
                await self._backfill_capture_sections(db, source_id)

    async def _backfill_citation_sections(self, db: AsyncSession, source_id: int) -> None:
        # WHERE clause guarantees non-null range bounds.
        section_rows = await self._section_repo.list_ranges_for_source(db, source_id)
        if not section_rows:
            return

        citation_rows = await self._citation_repo.list_id_section_location_for_source(db, source_id)
        if not citation_rows:
            return

        # Group by target section so we can issue one UPDATE per group instead
        # of one per citation.
        updates_by_section: dict[int, list[int]] = {}
        for citation_id, section_id, location in citation_rows:
            t_start = _extract_av_t_start(location)
            if t_start is None:
                continue
            new_section_id = _match_section(t_start, section_rows)
            if new_section_id is None or new_section_id == section_id:
                continue
            updates_by_section.setdefault(new_section_id, []).append(citation_id)

        for new_section_id, ids in updates_by_section.items():
            await self._citation_repo.assign_section(db, ids, new_section_id)

    async def _backfill_capture_sections(self, db: AsyncSession, source_id: int) -> None:
        # A capture inherits its citation's section. Captures without a citation,
        # and captures whose citation has no section, are left alone.
        rows = await self._capture_repo.list_citation_section_pairs(db, source_id)
        if not rows:
            return

        updates_by_section: dict[int, list[int]] = {}
        for capture_id, cap_section_id, cit_section_id in rows:
            if cap_section_id == cit_section_id:
                continue
            updates_by_section.setdefault(cit_section_id, []).append(capture_id)

        for new_section_id, ids in updates_by_section.items():
            await self._capture_repo.assign_section(db, ids, new_section_id)


def _extract_av_t_start(location: dict | None) -> float | None:
    """Pull the start timestamp from a citation's location JSON, if any.

    Returns the float seconds for av_v1 / transcript_v1 locations; None for
    every other type or for malformed payloads (validation failures shouldn't
    poison the whole backfill).
    """
    if not isinstance(location, dict):
        return None
    try:
        parsed = LOCATION_ADAPTER.validate_python(location)
    except Exception:
        return None
    if isinstance(parsed, AvLocation):
        return parsed.av.t_start_sec
    if isinstance(parsed, TranscriptLocation):
        return parsed.transcript.t_start_sec
    return None


def _match_section(
    t_start: float,
    sections: list[tuple[int, int, int]],
) -> int | None:
    """Find the section whose [range_start, range_end) covers t_start."""
    for section_id, range_start, range_end in sections:
        if range_start <= t_start < range_end:
            return section_id
    return None


def _compute_duration(utterances: list[dict]) -> float:
    end_times = [float(u.get("end") or 0) for u in utterances]
    return max(end_times) if end_times else 0.0


def _build_prompt(utterances: list[dict], duration: float) -> str:
    lines = [_format_line(u) for u in utterances]
    transcript = "\n".join(lines)
    return (
        f"Transcript duration: {int(duration)} seconds.\n"
        f"Utterance count: {len(utterances)}.\n\n"
        f"Transcript:\n{transcript}\n"
    )


def _format_line(utterance: dict) -> str:
    start = int(float(utterance.get("start") or 0))
    speaker = utterance.get("speaker")
    text_part = (utterance.get("text") or "").strip()
    if speaker:
        return f"[{start}s] {speaker}: {text_part}"
    return f"[{start}s] {text_part}"


def _validate_sections(
    sections: list[AutoSection],
    *,
    total_duration: float,
) -> list[AutoSection] | None:
    if not (MIN_SECTIONS <= len(sections) <= MAX_SECTIONS):
        logger.warning(
            "Section count %d out of bounds [%d, %d]",
            len(sections),
            MIN_SECTIONS,
            MAX_SECTIONS,
        )
        return None

    sorted_sections = sorted(sections, key=lambda s: s.start_sec)

    if sorted_sections[0].start_sec != 0:
        # Snap first section to zero rather than reject — small leniency.
        first = sorted_sections[0]
        sorted_sections[0] = AutoSection(start_sec=0, end_sec=first.end_sec, title=first.title)

    last = sorted_sections[-1]
    if last.end_sec < int(total_duration) - 30:
        logger.warning(
            "Last section ends at %ds but transcript runs to %.0fs",
            last.end_sec,
            total_duration,
        )
        return None

    # Snap each section's start to the previous section's end. Gemini often
    # returns inclusive end_sec followed by next start_sec = end_sec + 1, which
    # would fail a strict contiguity check. Reject only on real overlaps or
    # large gaps where the model dropped material.
    repaired: list[AutoSection] = [sorted_sections[0]]
    for prev, curr in zip(sorted_sections, sorted_sections[1:]):
        gap = curr.start_sec - prev.end_sec
        if gap < -1 or gap > 5:
            logger.warning(
                "Sections not contiguous: prev ends %d, next starts %d",
                prev.end_sec,
                curr.start_sec,
            )
            return None
        if curr.start_sec != prev.end_sec:
            curr = AutoSection(
                start_sec=prev.end_sec,
                end_sec=curr.end_sec,
                title=curr.title,
            )
        repaired.append(curr)

    return repaired


__all__ = ["TranscriptSectioningService"]
