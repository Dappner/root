from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.exceptions import (
    AuthorizationError,
    ConflictError,
)
from app.core.hashing import sha256_hex
from app.core.ownership import (
    require_captures,
    require_citations,
    require_source,
    require_takeaway,
)
from app.core.tiptap import tiptap_to_plain_text
from app.models.database import SourceTakeaway
from app.repositories.capture_repository import CaptureRepository
from app.repositories.source_repository import SourceRepository, bump_source_last_active
from app.repositories.source_takeaway_repository import SourceTakeawayRepository
from app.schemas.citations import CaptureResponse, CitationResponse
from app.schemas.takeaways import (
    TakeawayResponse,
    TakeawaySourceRef,
    TakeawayWithLinksResponse,
)
from app.services.source_list_cache import invalidate_source_list_cache

MAX_TAKEAWAYS_PER_SOURCE = 5


def _dedupe(ids: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for i in ids:
        if i in seen:
            continue
        seen.add(i)
        out.append(i)
    return out


class SourceTakeawayService:
    def __init__(
        self,
        repo: SourceTakeawayRepository,
        source_repo: SourceRepository | None = None,
        capture_repo: CaptureRepository | None = None,
    ) -> None:
        self._repo = repo
        self._source_repo = source_repo or SourceRepository()
        self._capture_repo = capture_repo or CaptureRepository()

    # --- Body derivation ---

    @staticmethod
    def _resolve_body(body_json: dict | None, existing_body: str | None) -> str:
        if body_json is not None:
            return tiptap_to_plain_text(body_json)
        # TODO: remove this fallback once all takeaways have body_json populated
        # (i.e. every legacy takeaway has been opened + saved in the rich editor).
        # Until then, accept the legacy plain-text body so older records remain editable.
        return existing_body or ""

    # --- CRUD ---

    async def list_by_source(
        self, db: AsyncSession, source_id: int, user_id: str
    ) -> list[tuple[SourceTakeaway, list, list]]:
        await require_source(db, source_id, user_id)
        takeaways = await self._repo.list_by_source(db, source_id, user_id)
        result: list[tuple[SourceTakeaway, list, list]] = []
        for t in takeaways:
            citations = await self._repo.list_citations(db, t.id)
            captures = await self._repo.list_captures(db, t.id)
            result.append((t, citations, captures))
        return result

    async def get_with_links(
        self,
        db: AsyncSession,
        takeaway_id: int,
        user_id: str,
        source_id: int | None = None,
    ) -> tuple[SourceTakeaway, list, list]:
        takeaway = await require_takeaway(db, takeaway_id, user_id, source_id=source_id)
        citations = await self._repo.list_citations(db, takeaway.id)
        captures = await self._repo.list_captures(db, takeaway.id)
        return takeaway, citations, captures

    async def create(
        self,
        db: AsyncSession,
        *,
        source_id: int,
        user_id: str,
        title: str,
        body_json: dict | None,
        citation_ids: list[int],
        capture_ids: list[int],
    ) -> tuple[SourceTakeaway, list, list]:
        await require_source(db, source_id, user_id)

        count = await self._repo.count_by_source(db, source_id)
        if count >= MAX_TAKEAWAYS_PER_SOURCE:
            raise ConflictError(
                f"Cannot create more than {MAX_TAKEAWAYS_PER_SOURCE} takeaways per source"
            )

        citation_ids = _dedupe(citation_ids)
        capture_ids = _dedupe(capture_ids)
        await require_citations(db, citation_ids, user_id)
        await require_captures(db, capture_ids, user_id)

        body = self._resolve_body(body_json, existing_body=None)
        content_sha = sha256_hex(f"{title} - {body}")
        now = utcnow()

        takeaway = SourceTakeaway(
            user_id=user_id,
            source_id=source_id,
            title=title,
            body=body,
            body_json=body_json,
            content_sha256=content_sha,
            created_at=now,
            updated_at=now,
        )
        takeaway = await self._repo.add(db, takeaway)

        for cid in citation_ids:
            await self._repo.add_citation(db, takeaway.id, cid, now)
        for cap_id in capture_ids:
            await self._repo.add_capture(db, takeaway.id, cap_id, now)

        await bump_source_last_active(db, source_id, user_id)
        await invalidate_source_list_cache(user_id)

        citations = await self._repo.list_citations(db, takeaway.id)
        captures = await self._repo.list_captures(db, takeaway.id)
        return takeaway, citations, captures

    async def update(
        self,
        db: AsyncSession,
        *,
        takeaway_id: int,
        user_id: str,
        title: str,
        body_json: dict | None,
        citation_ids: list[int] | None,
        capture_ids: list[int] | None,
        source_id: int | None = None,
    ) -> tuple[SourceTakeaway, list, list]:
        takeaway = await require_takeaway(db, takeaway_id, user_id, source_id=source_id)

        # None means "preserve existing links"; an explicit list (even []) replaces them.
        deduped_citations = _dedupe(citation_ids) if citation_ids is not None else None
        deduped_captures = _dedupe(capture_ids) if capture_ids is not None else None
        if deduped_citations is not None:
            await require_citations(db, deduped_citations, user_id)
        if deduped_captures is not None:
            await require_captures(db, deduped_captures, user_id)

        body = self._resolve_body(body_json, existing_body=takeaway.body)
        content_sha = sha256_hex(f"{title} - {body}")
        now = utcnow()

        takeaway.title = title
        takeaway.body = body
        takeaway.body_json = body_json if body_json is not None else takeaway.body_json
        takeaway.content_sha256 = content_sha
        takeaway.updated_at = now

        if deduped_citations is not None:
            await self._sync_citations(db, takeaway.id, deduped_citations, now)
        if deduped_captures is not None:
            await self._sync_captures(db, takeaway.id, deduped_captures, now)

        await bump_source_last_active(db, takeaway.source_id, user_id)
        await invalidate_source_list_cache(user_id)

        citations = await self._repo.list_citations(db, takeaway.id)
        captures = await self._repo.list_captures(db, takeaway.id)
        return takeaway, citations, captures

    async def delete(
        self,
        db: AsyncSession,
        takeaway_id: int,
        user_id: str,
        source_id: int | None = None,
    ) -> None:
        # Enforce source-scope before deletion so a mismatched route can't drop the row.
        takeaway = await require_takeaway(db, takeaway_id, user_id, source_id=source_id)
        deleted = await self._repo.delete(db, takeaway_id, user_id)
        if not deleted:
            raise AuthorizationError(f"takeaway {takeaway_id} not accessible")
        await bump_source_last_active(db, takeaway.source_id, user_id)
        await invalidate_source_list_cache(user_id)

    # --- Response assembly ---

    async def _build_source_ref(
        self, db: AsyncSession, source_id: int, user_id: str
    ) -> TakeawaySourceRef:
        source = await require_source(db, source_id, user_id)
        image_url = await self._source_repo.get_image_url_for_source(
            db, episode_id=source.episode_id, video_id=source.video_id
        )
        return TakeawaySourceRef(
            id=source.id,
            title=source.title,
            type=source.type,
            image_url=image_url,
        )

    async def _to_response(
        self,
        db: AsyncSession,
        takeaway: SourceTakeaway,
        source_ref: TakeawaySourceRef,
        citations: list,
        captures: list,
    ) -> TakeawayWithLinksResponse:
        # Each linked citation carries all of its own (non-deleted) captures,
        # batched to avoid an N+1. The top-level `captures` are the takeaway's
        # directly-linked captures — a distinct relationship from captures-on-a-citation.
        captures_by_citation = await self._capture_repo.list_active_by_citation_ids(
            db, [c.id for c in citations]
        )
        return TakeawayWithLinksResponse(
            id=takeaway.id,
            user_id=takeaway.user_id,
            source=source_ref,
            title=takeaway.title,
            body=takeaway.body,
            body_json=takeaway.body_json,
            content_sha256=takeaway.content_sha256,
            created_at=takeaway.created_at,
            updated_at=takeaway.updated_at,
            citations=[
                CitationResponse.from_orm_with_captures(c, captures_by_citation.get(c.id, []))
                for c in citations
            ],
            captures=[CaptureResponse.model_validate(c) for c in captures],
        )

    async def list_by_source_response(
        self, db: AsyncSession, source_id: int, user_id: str
    ) -> list[TakeawayWithLinksResponse]:
        rows = await self.list_by_source(db, source_id, user_id)
        source_ref = await self._build_source_ref(db, source_id, user_id)
        return [
            await self._to_response(db, t, source_ref, citations, captures)
            for t, citations, captures in rows
        ]

    async def get_response(
        self,
        db: AsyncSession,
        takeaway_id: int,
        user_id: str,
        *,
        source_id: int,
    ) -> TakeawayWithLinksResponse:
        takeaway, citations, captures = await self.get_with_links(
            db, takeaway_id, user_id, source_id=source_id
        )
        source_ref = await self._build_source_ref(db, source_id, user_id)
        return await self._to_response(db, takeaway, source_ref, citations, captures)

    async def create_response(
        self,
        db: AsyncSession,
        *,
        source_id: int,
        user_id: str,
        title: str,
        body_json: dict | None,
        citation_ids: list[int],
        capture_ids: list[int],
    ) -> tuple[TakeawayWithLinksResponse, int]:
        takeaway, citations, captures = await self.create(
            db,
            source_id=source_id,
            user_id=user_id,
            title=title,
            body_json=body_json,
            citation_ids=citation_ids,
            capture_ids=capture_ids,
        )
        source_ref = await self._build_source_ref(db, source_id, user_id)
        response = await self._to_response(db, takeaway, source_ref, citations, captures)
        return response, takeaway.id

    async def update_response(
        self,
        db: AsyncSession,
        *,
        takeaway_id: int,
        user_id: str,
        title: str,
        body_json: dict | None,
        citation_ids: list[int] | None,
        capture_ids: list[int] | None,
        source_id: int,
    ) -> tuple[TakeawayWithLinksResponse, int]:
        takeaway, citations, captures = await self.update(
            db,
            takeaway_id=takeaway_id,
            user_id=user_id,
            title=title,
            body_json=body_json,
            citation_ids=citation_ids,
            capture_ids=capture_ids,
            source_id=source_id,
        )
        source_ref = await self._build_source_ref(db, source_id, user_id)
        response = await self._to_response(db, takeaway, source_ref, citations, captures)
        return response, takeaway.id

    async def list_recent_response(
        self, db: AsyncSession, user_id: str, limit: int, offset: int
    ) -> list[TakeawayResponse]:
        """Recent takeaways across all sources, newest first. Slim shape (no
        citations/captures). The image url is resolved in the repo query, so no
        per-source image lookup is needed here."""
        rows = await self._repo.list_recent_with_source(db, user_id, limit, offset)
        return [
            TakeawayResponse(
                id=t.id,
                user_id=t.user_id,
                source=TakeawaySourceRef(
                    id=s.id,
                    title=s.title,
                    type=s.type,
                    image_url=image_url,
                ),
                title=t.title,
                body=t.body,
                body_json=t.body_json,
                content_sha256=t.content_sha256,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t, s, image_url in rows
        ]

    # --- Link sync ---

    async def _sync_citations(
        self, db: AsyncSession, takeaway_id: int, desired: list[int], now: datetime
    ) -> None:
        existing = await self._repo.list_citation_ids(db, takeaway_id)
        desired_set = set(desired)
        for cid in existing - desired_set:
            await self._repo.remove_citation(db, takeaway_id, cid)
        for cid in desired_set - existing:
            await self._repo.add_citation(db, takeaway_id, cid, now)

    async def _sync_captures(
        self, db: AsyncSession, takeaway_id: int, desired: list[int], now: datetime
    ) -> None:
        existing = await self._repo.list_capture_ids(db, takeaway_id)
        desired_set = set(desired)
        for cid in existing - desired_set:
            await self._repo.remove_capture(db, takeaway_id, cid)
        for cid in desired_set - existing:
            await self._repo.add_capture(db, takeaway_id, cid, now)
