"""Context resolution for contextual assistant requests."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import SourceSection
from app.repositories.capture_repository import CaptureRepository
from app.repositories.citation_repository import CitationRepository
from app.repositories.source_repository import SourceRepository
from app.repositories.source_section_repository import SourceSectionRepository
from app.schemas.rag import AskContext

MAX_CONTEXT_ITEMS = 16
MAX_SECTION_INDEX_ITEMS = 80
MAX_TEXT_CHARS = 900


@dataclass
class ResolvedAssistantContext:
    text: str


def _truncate(value: str | None, max_chars: int = MAX_TEXT_CHARS) -> str | None:
    if not value:
        return None
    text = " ".join(value.split())
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def _line(label: str, value: str | int | None) -> str | None:
    if value is None or value == "":
        return None
    return f"- {label}: {value}"


def _format_range(section: SourceSection) -> str | None:
    if section.range_start is None and section.range_end is None:
        return None
    if section.range_start is not None and section.range_end is not None:
        return f"{section.range_start}-{section.range_end}"
    if section.range_start is not None:
        return str(section.range_start)
    return f"through {section.range_end}"


class AssistantContextResolver:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._citations = CitationRepository()
        self._captures = CaptureRepository()
        self._sources = SourceRepository()
        self._sections = SourceSectionRepository()

    async def resolve(
        self,
        user_id: str,
        context: AskContext | None,
    ) -> ResolvedAssistantContext | None:
        if context is None or context.surface in {"ask", "library"}:
            return None

        if context.source_id is None:
            return None

        source = await self._sources.get_for_user(self.db, context.source_id, user_id)
        if source is None:
            return ResolvedAssistantContext(
                text=(
                    "Current Root context could not be loaded. "
                    "The requested source was not found for this user."
                )
            )

        section: SourceSection | None = None
        if context.section_id is not None:
            candidate = await self._sections.get_for_user(self.db, context.section_id, user_id)
            # Preserve the source-membership check: only attach the section if it
            # belongs to the source in the current context.
            if candidate is not None and candidate.source_id == source.id:
                section = candidate

        parts = [
            "Current Root context:",
            *[
                item
                for item in [
                    _line("surface", context.surface),
                    _line("source_id", source.id),
                    _line("source_title", source.title),
                    _line("source_type", source.type),
                    _line("source_author", source.author),
                    _line("source_summary", _truncate(source.summary_short or source.summary_long)),
                ]
                if item is not None
            ],
        ]

        if context.section_id is not None and section is None:
            parts.append(f"- section_id: {context.section_id} (not found for this source/user)")
        elif section is not None:
            parts.extend(
                item
                for item in [
                    _line("section_id", section.id),
                    _line("section_title", section.title),
                    _line("section_subtitle", _truncate(section.subtitle, 300)),
                    _line("section_summary", _truncate(section.summary)),
                ]
                if item is not None
            )

        sections = await self._load_sections(user_id, source.id)
        if sections:
            parts.append("\nSection index for this source:")
            for indexed_section in sections:
                summary = _truncate(indexed_section.summary, 220)
                subtitle = _truncate(indexed_section.subtitle, 160)
                range_label = _format_range(indexed_section)
                details = [
                    f"section_id={indexed_section.id}",
                    f"order={indexed_section.order_index}",
                    f"title={indexed_section.title}",
                ]
                if subtitle:
                    details.append(f"subtitle={subtitle}")
                if range_label:
                    details.append(f"range={range_label}")
                if summary:
                    details.append(f"summary={summary}")
                parts.append("- " + "; ".join(details))

        citations = await self._load_citations(user_id, source.id, section.id if section else None)
        captures = await self._load_captures(user_id, source.id, section.id if section else None)

        if citations:
            parts.append("\nCitation candidates in current context:")
            for citation in citations:
                text = _truncate(citation.text)
                speaker = f" speaker={citation.speaker}" if citation.speaker else ""
                parts.append(f"- citation_id={citation.id}{speaker}: {text}")

        if captures:
            parts.append("\nExisting notes in current context:")
            for capture in captures:
                citation_label = (
                    f" citation_id={capture.citation_id}" if capture.citation_id is not None else ""
                )
                parts.append(
                    f"- capture_id={capture.id}{citation_label}: {_truncate(capture.content)}"
                )

        parts.append(
            "\nUse this context to interpret the user's message. "
            "If you cite or refer to an item above, use its explicit ID."
        )

        return ResolvedAssistantContext(text="\n".join(parts))

    async def _load_citations(
        self,
        user_id: str,
        source_id: int,
        section_id: int | None,
    ) -> list:
        return await self._citations.list_for_source(
            self.db, user_id, source_id, section_id=section_id, limit=MAX_CONTEXT_ITEMS
        )

    async def _load_sections(self, user_id: str, source_id: int) -> list[SourceSection]:
        return await self._sections.list_by_source_for_user(
            self.db, source_id, user_id, limit=MAX_SECTION_INDEX_ITEMS
        )

    async def _load_captures(
        self,
        user_id: str,
        source_id: int,
        section_id: int | None,
    ) -> list:
        return await self._captures.list_for_source(
            self.db, user_id, source_id, section_id=section_id, limit=MAX_CONTEXT_ITEMS
        )
