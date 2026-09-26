from __future__ import annotations

import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import anyio
import httpx
from fastapi import UploadFile
from pydantic import TypeAdapter
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.datetime_utils import utcnow
from app.core.exceptions import ExternalServiceError, ValidationError
from app.core.hashing import sha256_hex_or_none
from app.core.logging import get_logger
from app.core.ownership import require_citation, require_source, require_suggestion
from app.integrations.r2 import R2Client
from app.models.database import Capture, Citation, Suggestion
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository
from app.repositories.source_section_repository import SourceSectionRepository
from app.repositories.suggestion_repository import SuggestionRepository
from app.schemas.suggestions import (
    ApprovalMetadata,
    CandidateContextMetadata,
    CandidateUtterancePreview,
    MatchCaptureMetadata,
    MatchCitationMetadata,
    MatchMetadata,
    ProcessingMetadata,
    SuggestedCapturePayload,
    SuggestedCitationPayload,
    SuggestedPayload,
    SuggestedPayloadEntities,
    SuggestedPayloadUncertain,
    SuggestionStatus,
    TranscriptionMetadata,
    TranscriptLocation,
    TranscriptV1Location,
    coerce_legacy_suggested_payload,
)
from app.services.audio_transcription import get_audio_transcription_service
from app.services.citation_location_validation import validate_section_ownership
from app.services.source_list_cache import invalidate_source_list_cache
from app.services.voice_suggestion_matcher import VoiceSuggestionMatch, VoiceSuggestionMatcher

logger = get_logger(__name__)
MAX_VOICE_AUDIO_BYTES = 25 * 1024 * 1024
VOICE_UPLOAD_CHUNK_SIZE = 1024 * 1024
MAX_CANDIDATE_UTTERANCES = 120

_repo = SuggestionRepository()
_citation_repo = CitationRepository()
_capture_repo = CaptureRepository()
_section_repo = SourceSectionRepository()


def _normalize_for_matching(text: str) -> str:
    """Lowercase + collapse whitespace + unify quotes, for fuzzy substring search.

    Mirrors the frontend transcript matcher's normalization so backend-computed
    offsets agree with how the desktop transcript view locates a quote.
    """
    return (
        re.sub(r"\s+", " ", text.lower())
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .strip()
    )


def locate_quote_offsets(
    *,
    utterances: list[dict[str, Any]],
    utterance_start_idx: int,
    utterance_end_idx: int,
    quote_text: str,
) -> tuple[int, int] | None:
    """Find a quote phrase within an utterance range, returning per-utterance
    char offsets (start offset into the start utterance, end offset into the end
    utterance) — the source of truth the transcript view highlights against.

    Utterances in the range are joined with single spaces (matching the desktop
    matcher). Tries an exact substring match first, then a normalized one. Returns
    None when the phrase can't be located, so the caller can fall back to
    whole-utterance offsets rather than emit a wrong span.
    """
    quote = (quote_text or "").strip()
    if not quote:
        return None

    range_utterances = utterances[utterance_start_idx : utterance_end_idx + 1]
    texts = [str(u.get("text") or "") for u in range_utterances]
    combined = " ".join(texts)

    index = combined.find(quote)
    match_len = len(quote)
    if index == -1:
        normalized_combined = _normalize_for_matching(combined)
        normalized_quote = _normalize_for_matching(quote)
        index = normalized_combined.find(normalized_quote)
        match_len = len(normalized_quote)
        # Normalized offsets only line up with the raw text when normalization
        # didn't shift character positions (no collapsed whitespace before the
        # match). Guard against drift by requiring the raw slice to still look
        # like the quote; otherwise bail to the whole-utterance fallback.
        if index == -1:
            return None

    end_index = index + match_len

    # Map the combined-text [index, end_index) span back to per-utterance offsets.
    # Each utterance contributes len(text) chars + 1 for the joining space.
    start_offset: int | None = None
    end_offset: int | None = None
    cursor = 0
    for i, text in enumerate(texts):
        utt_start = cursor
        utt_end = cursor + len(text)
        if start_offset is None and index < utt_end + 1:
            start_offset = max(0, index - utt_start)
        if end_index <= utt_end:
            end_offset = end_index - utt_start
            break
        cursor = utt_end + 1  # +1 for the joining space

    if start_offset is None or end_offset is None:
        return None
    return start_offset, end_offset


def build_transcript_location(
    *,
    utterances: list[dict[str, Any]],
    utterance_start_idx: int,
    utterance_end_idx: int,
    char_offset_start: int = 0,
    char_offset_end: int | None = None,
) -> TranscriptLocation:
    """Build the desktop-compatible citation transcript_v1 location object."""
    if utterance_start_idx < 0 or utterance_end_idx < utterance_start_idx:
        raise ValidationError("Invalid transcript utterance range")
    if utterance_end_idx >= len(utterances):
        raise ValidationError("Transcript utterance range exceeds transcript length")

    start = utterances[utterance_start_idx]
    end = utterances[utterance_end_idx]
    end_text = str(end.get("text") or "")

    return TranscriptLocation(
        mode="derived",
        type="transcript_v1",
        transcript=TranscriptV1Location.model_validate(
            {
                "utteranceStartIdx": utterance_start_idx,
                "utteranceEndIdx": utterance_end_idx,
                "charOffsetStart": char_offset_start,
                "charOffsetEnd": len(end_text) if char_offset_end is None else char_offset_end,
                "tStartSec": float(start.get("start") or 0),
                "tEndSec": float(end.get("end") or start.get("start") or 0),
            }
        ),
    )


class SuggestionService:
    def __init__(
        self,
        r2_client: R2Client | None = None,
    ) -> None:
        if r2_client is None:
            from app.clients import r2

            r2_client = r2
        self._r2 = r2_client

    async def list_for_source(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        source_id: int,
    ) -> list[Suggestion]:
        return await _repo.list_for_source(db, user_id, source_id)

    async def list_for_user(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        statuses: list[SuggestionStatus] | None = None,
        limit: int = 20,
    ) -> list[Suggestion]:
        return await _repo.list_for_user(db, user_id, statuses=statuses, limit=limit)

    async def get(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        suggestion_id: int,
    ) -> Suggestion:
        return await require_suggestion(db, suggestion_id, user_id)

    async def approve(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        suggestion_id: int,
        payload_override: SuggestedPayload | None = None,
    ) -> tuple[Suggestion, list[int], list[int]]:
        suggestion = await self.get(db=db, user_id=user_id, suggestion_id=suggestion_id)
        if suggestion.status != "ready":
            raise ValidationError("suggestion is not ready for approval")

        raw = payload_override or suggestion.suggested_payload
        if not raw:
            raise ValidationError("suggestion payload missing")

        # payload_override is already typed; suggestion.suggested_payload is a
        # JSONB dict which may use the legacy single-citation/single-capture
        # shape for rows written before this migration.
        raw_dict = raw if isinstance(raw, dict) else raw.model_dump()
        payload: SuggestedPayload = TypeAdapter(SuggestedPayload).validate_python(
            coerce_legacy_suggested_payload(raw_dict)
        )

        if not isinstance(payload, SuggestedPayloadEntities):
            raise ValidationError("suggestion action is not approvable")

        # Any IDs supplied by the client (payload_override) need ownership/source
        # checks before we write them to citation/capture rows. FK constraints
        # only verify existence, so without these checks a user could approve
        # their own suggestion while pointing the new rows at another user's
        # section or citation.
        await self._validate_payload_references(
            db=db,
            user_id=user_id,
            suggestion_source_id=suggestion.source_id,
            payload=payload,
        )

        now = utcnow()
        citation_ids: list[int] = []
        capture_ids: list[int] = []

        for cp in payload.citations:
            citation = await _citation_repo.create(
                db,
                Citation(
                    user_id=user_id,
                    info_type=cp.info_type,
                    text=cp.text,
                    summary=cp.summary,
                    source_id=suggestion.source_id,
                    section_id=cp.section_id,
                    location=cp.location.model_dump(by_alias=True),
                    text_sha256=sha256_hex_or_none(cp.text),
                    speaker=cp.speaker,
                    context=cp.context,
                    suggestion_id=suggestion.id,
                    created_at=now,
                    updated_at=now,
                ),
            )
            citation_ids.append(citation.id)

        for cap in payload.captures:
            if cap.citation_idx is not None:
                citation_id_for_capture: int | None = citation_ids[cap.citation_idx]
            else:
                citation_id_for_capture = cap.citation_id
            capture = await _capture_repo.create(
                db,
                Capture(
                    user_id=user_id,
                    citation_id=citation_id_for_capture,
                    source_id=suggestion.source_id,
                    section_id=cap.section_id,
                    content=cap.text,
                    summary=cap.summary,
                    content_sha256=sha256_hex_or_none(cap.text),
                    suggestion_id=suggestion.id,
                    created_at=now,
                    updated_at=now,
                ),
            )
            capture_ids.append(capture.id)

        if not citation_ids and not capture_ids:
            raise ValidationError("suggestion action is not approvable")

        suggestion.status = "approved"
        suggestion.suggested_payload = payload.model_dump(by_alias=True)
        suggestion.reviewed_at = now
        suggestion.updated_at = now
        existing_meta: dict[str, Any] = dict(suggestion.processing_metadata or {})
        existing_meta["approval"] = ApprovalMetadata(
            citation_ids=citation_ids,
            capture_ids=capture_ids,
            approved_at=now.isoformat(),
        ).model_dump()
        suggestion.processing_metadata = existing_meta
        saved = await _repo.save(db, suggestion)

        # Approving created citations/captures directly via the repos, bypassing
        # citation_service/capture_service which normally bust this cache. The
        # cached source list carries citation_count/capture_count, so invalidate
        # here too or those counts stay stale for the 30-min TTL.
        await invalidate_source_list_cache(user_id)

        return saved, citation_ids, capture_ids

    async def _validate_payload_references(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        suggestion_source_id: int | None,
        payload: SuggestedPayload,
    ) -> None:
        if not isinstance(payload, SuggestedPayloadEntities):
            return

        for cp in payload.citations:
            if cp.section_id is not None:
                if suggestion_source_id is None:
                    raise ValidationError("cannot attach section_id: suggestion has no source")
                await validate_section_ownership(
                    db,
                    section_id=cp.section_id,
                    source_id=suggestion_source_id,
                    user_id=user_id,
                )

        for cap in payload.captures:
            if cap.citation_idx is None and cap.citation_id is not None:
                await require_citation(db, cap.citation_id, user_id)
            if cap.section_id is not None:
                if suggestion_source_id is None:
                    raise ValidationError("cannot attach section_id: suggestion has no source")
                await validate_section_ownership(
                    db,
                    section_id=cap.section_id,
                    source_id=suggestion_source_id,
                    user_id=user_id,
                )

    async def retry(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        suggestion_id: int,
    ) -> Suggestion:
        suggestion = await self.get(db=db, user_id=user_id, suggestion_id=suggestion_id)
        if suggestion.status not in {"ready", "failed"}:
            raise ValidationError("only ready or failed suggestions can be retried")
        if not suggestion.audio_r2_key:
            raise ValidationError("suggestion has no voice audio to retry")

        now = utcnow()
        suggestion.status = "uploaded"
        suggestion.error = None
        suggestion.suggested_action = None
        suggestion.suggested_payload = None
        suggestion.updated_at = now
        return await _repo.save(db, suggestion)

    async def dismiss(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        suggestion_id: int,
    ) -> Suggestion:
        suggestion = await self.get(db=db, user_id=user_id, suggestion_id=suggestion_id)
        if suggestion.status in {"approved", "dismissed"}:
            return suggestion

        now = utcnow()
        suggestion.status = "dismissed"
        suggestion.reviewed_at = now
        suggestion.updated_at = now
        return await _repo.save(db, suggestion)

    async def create_voice_suggestion(
        self,
        *,
        db: AsyncSession,
        user_id: str,
        file: UploadFile,
        client_id: str,
        source_id: int,
        episode_id: int | None,
        playback_position_seconds: float | None,
        recorded_at: datetime | None,
    ) -> Suggestion:
        existing = await _repo.get_by_client_id(db, user_id, client_id)
        if existing:
            return existing

        source = await require_source(db, source_id, user_id)
        if (
            episode_id is not None
            and source.episode_id is not None
            and source.episode_id != episode_id
        ):
            raise ValidationError("episode does not match source")

        now = utcnow()
        recorded_at_naive = recorded_at.replace(tzinfo=None) if recorded_at is not None else None
        suggestion = await _repo.create(
            db,
            Suggestion(
                client_id=client_id,
                user_id=user_id,
                source_id=source_id,
                episode_id=episode_id,
                origin="mobile_voice",
                status="uploaded",
                playback_position_seconds=playback_position_seconds,
                recorded_at=recorded_at_naive,
                processing_metadata={},
                created_at=now,
                updated_at=now,
            ),
        )

        temp_path = await self._persist_upload_temp(file)
        r2_key = f"users/{user_id}/suggestions/{suggestion.id}/voice{Path(temp_path).suffix}"
        try:

            def _upload() -> None:
                with Path(temp_path).open("rb") as stream:
                    self._r2.upload_stream(
                        r2_key,
                        stream,
                        content_type=file.content_type or "application/octet-stream",
                    )

            await anyio.to_thread.run_sync(_upload)
        finally:
            Path(temp_path).unlink(missing_ok=True)

        suggestion.audio_r2_key = r2_key
        suggestion.processing_metadata = {}
        suggestion.updated_at = utcnow()
        return await _repo.save(db, suggestion)

    async def process_voice_suggestion(
        self, suggestion_id: int, refinement: str | None = None
    ) -> None:
        async with AsyncSessionLocal() as db:
            suggestion = await _repo.get_by_id(db, suggestion_id)
            if not suggestion:
                logger.warning("Suggestion %s not found for processing", suggestion_id)
                return

            try:
                suggestion.status = "processing"
                suggestion.error = None
                suggestion.updated_at = utcnow()
                await db.commit()

                if not suggestion.audio_r2_key:
                    raise ExternalServiceError("r2", "voice audio R2 key missing")

                audio_url = self._r2.get_public_url(suggestion.audio_r2_key)
                raw_transcription = await get_audio_transcription_service().transcribe_url(
                    audio_url
                )
                raw_confidence = raw_transcription.get("confidence")
                raw_duration = raw_transcription.get("duration_seconds")
                transcription = TranscriptionMetadata(
                    transcript=str(raw_transcription.get("transcript") or ""),
                    provider=str(raw_transcription.get("provider") or "assemblyai"),
                    confidence=float(raw_confidence) if raw_confidence is not None else None,
                    duration_seconds=float(raw_duration) if raw_duration is not None else None,
                )
                suggestion.voice_transcript = transcription.transcript

                transcript_data = await self._load_transcript_for_suggestion(db, suggestion)
                utterances = transcript_data.get("utterances") or []
                if not utterances:
                    raise ValidationError("no transcript available")

                playback_position_seconds = float(suggestion.playback_position_seconds or 0)
                candidate_utterances = self._candidate_utterances(
                    utterances=utterances,
                    playback_position_seconds=playback_position_seconds,
                )
                candidate_metadata = self._candidate_context_metadata(
                    candidate_utterances=candidate_utterances,
                    playback_position_seconds=playback_position_seconds,
                )

                match = await VoiceSuggestionMatcher().match(
                    voice_transcript=suggestion.voice_transcript,
                    playback_position_seconds=playback_position_seconds,
                    candidate_utterances=candidate_utterances,
                    refinement=refinement,
                )
                suggested_payload = await self._build_suggested_payload(
                    db=db,
                    match=match,
                    utterances=utterances,
                    voice_transcript=suggestion.voice_transcript,
                    source_id=suggestion.source_id,
                )

                processing_metadata = ProcessingMetadata(
                    transcription=transcription,
                    candidate_context=candidate_metadata,
                    match=MatchMetadata(
                        action=match.action,
                        confidence=match.confidence,
                        citations=[
                            MatchCitationMetadata(**c.model_dump()) for c in match.citations
                        ],
                        captures=[MatchCaptureMetadata(**c.model_dump()) for c in match.captures],
                        reasoning_summary=match.reasoning_summary,
                    ),
                )

                suggestion.status = "ready"
                suggestion.suggested_action = match.action
                suggestion.suggested_payload = suggested_payload.model_dump(by_alias=True)
                suggestion.processing_metadata = processing_metadata.model_dump()
                suggestion.updated_at = utcnow()
                await db.commit()
            except Exception as exc:
                logger.exception("Failed to process voice suggestion %s: %s", suggestion_id, exc)
                suggestion.status = "failed"
                suggestion.error = str(exc)
                suggestion.updated_at = utcnow()
                await db.commit()

    async def _persist_upload_temp(self, file: UploadFile) -> str:
        suffix = Path(file.filename or "voice.m4a").suffix or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            total = 0
            while chunk := await file.read(VOICE_UPLOAD_CHUNK_SIZE):
                total += len(chunk)
                if total > MAX_VOICE_AUDIO_BYTES:
                    raise ValidationError("Audio file is too large")
                temp.write(chunk)
            temp_path = temp.name

        await file.close()
        if Path(temp_path).stat().st_size == 0:
            Path(temp_path).unlink(missing_ok=True)
            raise ValidationError("Audio file is empty")
        return temp_path

    async def _load_transcript_for_suggestion(
        self, db: AsyncSession, suggestion: Suggestion
    ) -> dict[str, Any]:
        episode_id = await _repo.get_approved_episode_id(db, suggestion)
        if episode_id is None:
            raise ValidationError("no transcript available")

        episode = await _repo.get_ready_episode(db, episode_id)
        if not episode:
            raise ValidationError("no transcript available")

        r2_key = f"podcasts/{episode_id}/transcript.json"
        url = self._r2.get_public_url(r2_key)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            transcript_json: dict[str, Any] = response.json()
            return transcript_json

    def _candidate_utterances(
        self,
        *,
        utterances: list[dict[str, Any]],
        playback_position_seconds: float,
    ) -> list[dict[str, Any]]:
        indexed = [
            {
                "index": idx,
                "text": str(utterance.get("text") or ""),
                "start": float(utterance.get("start") or 0),
                "end": float(utterance.get("end") or utterance.get("start") or 0),
                "speaker": utterance.get("speaker"),
            }
            for idx, utterance in enumerate(utterances)
        ]
        nearby = self._windowed_utterances(
            indexed,
            start_seconds=playback_position_seconds - 180,
            end_seconds=playback_position_seconds + 60,
        )
        fallback = self._windowed_utterances(
            indexed,
            start_seconds=playback_position_seconds - 600,
            end_seconds=playback_position_seconds + 180,
        )
        selected = nearby or fallback
        if len(selected) <= MAX_CANDIDATE_UTTERANCES:
            return selected

        nearest_position = min(
            range(len(selected)),
            key=lambda position: abs(
                ((selected[position]["start"] + selected[position]["end"]) / 2)
                - playback_position_seconds
            ),
        )
        half = MAX_CANDIDATE_UTTERANCES // 2
        start = max(0, nearest_position - half)
        end = min(len(selected), start + MAX_CANDIDATE_UTTERANCES)
        start = max(0, end - MAX_CANDIDATE_UTTERANCES)
        return selected[start:end]

    def _windowed_utterances(
        self,
        utterances: list[dict[str, Any]],
        *,
        start_seconds: float,
        end_seconds: float,
    ) -> list[dict[str, Any]]:
        return [
            utterance
            for utterance in utterances
            if float(utterance["end"]) >= start_seconds and float(utterance["start"]) <= end_seconds
        ]

    def _candidate_context_metadata(
        self,
        *,
        candidate_utterances: list[dict[str, Any]],
        playback_position_seconds: float,
    ) -> CandidateContextMetadata:
        return CandidateContextMetadata(
            playback_position_seconds=playback_position_seconds,
            utterance_count=len(candidate_utterances),
            utterances=[
                CandidateUtterancePreview(
                    index=utterance["index"],
                    start=utterance["start"],
                    end=utterance["end"],
                    speaker=utterance.get("speaker"),
                    preview=str(utterance.get("text") or "")[:240],
                )
                for utterance in candidate_utterances[:20]
            ],
        )

    async def _build_suggested_payload(
        self,
        *,
        db: AsyncSession,
        match: VoiceSuggestionMatch,
        utterances: list[dict[str, Any]],
        voice_transcript: str,
        source_id: int | None,
    ) -> SuggestedPayload:
        confidence = match.confidence
        reasoning_summary = match.reasoning_summary

        if match.action == "uncertain":
            return SuggestedPayloadUncertain(
                action="uncertain",
                confidence=confidence,
                voice_transcript=voice_transcript,
                reasoning_summary=reasoning_summary,
            )

        citations: list[SuggestedCitationPayload] = []
        for mc in match.citations:
            citations.append(
                await self._build_citation_payload(
                    db=db,
                    utterance_start_idx=mc.utterance_start_idx,
                    utterance_end_idx=mc.utterance_end_idx,
                    citation_text=mc.citation_text,
                    speaker=mc.speaker,
                    context=mc.context,
                    utterances=utterances,
                    source_id=source_id,
                )
            )

        captures = [
            SuggestedCapturePayload(
                text=mc.capture_text,
                citation_idx=mc.citation_idx,
            )
            for mc in match.captures
        ]

        return SuggestedPayloadEntities(
            action="create_entities",
            confidence=confidence,
            voice_transcript=voice_transcript,
            reasoning_summary=reasoning_summary,
            citations=citations,
            captures=captures,
        )

    async def _build_citation_payload(
        self,
        *,
        db: AsyncSession,
        utterance_start_idx: int,
        utterance_end_idx: int,
        citation_text: str,
        speaker: str | None,
        context: str | None,
        utterances: list[dict[str, Any]],
        source_id: int | None,
    ) -> SuggestedCitationPayload:
        text = citation_text or self._join_utterance_text(
            utterances=utterances,
            utterance_start_idx=utterance_start_idx,
            utterance_end_idx=utterance_end_idx,
        )
        # Locate the quote phrase within its utterance range so the stored char
        # offsets bracket the exact quote (the SoT the transcript view highlights).
        # Falls back to whole-utterance offsets when the phrase can't be located.
        offsets = locate_quote_offsets(
            utterances=utterances,
            utterance_start_idx=utterance_start_idx,
            utterance_end_idx=utterance_end_idx,
            quote_text=text,
        )
        location = build_transcript_location(
            utterances=utterances,
            utterance_start_idx=utterance_start_idx,
            utterance_end_idx=utterance_end_idx,
            char_offset_start=offsets[0] if offsets else 0,
            char_offset_end=offsets[1] if offsets else None,
        )
        section_id = await self._resolve_section_id(
            db=db,
            source_id=source_id,
            t_start_sec=location.transcript.t_start_sec,
        )
        return SuggestedCitationPayload(
            text=text,
            info_type="quote",
            location=location,
            speaker=speaker,
            context=context,
            section_id=section_id,
        )

    async def _resolve_section_id(
        self,
        *,
        db: AsyncSession,
        source_id: int | None,
        t_start_sec: float,
    ) -> int | None:
        """Resolve the section that contains the given transcript timestamp.

        Matches the AV citation backfill logic in transcript_generator: pick the
        section whose [range_start, range_end) window contains t_start_sec.
        Returns None for sources without sections or when no section matches.
        """
        if source_id is None:
            return None
        return await _section_repo.find_section_id_by_timestamp(db, source_id, t_start_sec)

    def _join_utterance_text(
        self,
        *,
        utterances: list[dict[str, Any]],
        utterance_start_idx: int,
        utterance_end_idx: int,
    ) -> str:
        return " ".join(
            str(utterance.get("text") or "").strip()
            for utterance in utterances[utterance_start_idx : utterance_end_idx + 1]
            if str(utterance.get("text") or "").strip()
        )

    def _required_text(self, value: Any, field_name: str) -> str:
        text = str(value or "").strip()
        if not text:
            raise ValidationError(f"{field_name} missing")
        return text
