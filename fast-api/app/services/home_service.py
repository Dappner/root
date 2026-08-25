from collections.abc import Sequence

from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.home_repository import HomeRepository
from app.schemas.home import (
    HomeNoteDTO,
    HomePickupNote,
    HomePrimaryItem,
    HomeRecentHighlight,
    HomeRecentlyCaptured,
    HomeRecentSource,
    HomeResponse,
)
from app.schemas.podcasts import SourceDTO
from app.schemas.takeaways import TakeawayResponse, TakeawaySourceRef

_repo = HomeRepository()


class HomeService:
    async def get_home(self, db: AsyncSession, user_id: str) -> HomeResponse:
        activity_rows = await _repo.get_activity_rows(db, user_id)
        highlight_rows = await _repo.get_recent_highlight_rows(db, user_id)
        takeaway_rows = await _repo.get_recent_takeaway_rows(db, user_id)
        note_rows = await _repo.get_pickup_note_rows(db, user_id)
        captured_rows = await _repo.get_recently_captured_rows(db, user_id)

        return HomeResponse(
            primary=self._primary_item(activity_rows),
            recent_sources=self._recent_sources(activity_rows),
            recent_highlights=[self._highlight(row) for row in highlight_rows],
            recent_takeaways=[self._takeaway(row) for row in takeaway_rows],
            pickup_notes=[self._pickup_note(row) for row in note_rows],
            recently_captured=[self._recently_captured(row) for row in captured_rows],
        )

    def _takeaway(self, row: RowMapping) -> TakeawayResponse:
        image_url = row["pe_image_url"] or row["v_thumbnail_url"]
        return TakeawayResponse(
            id=row["id"],
            user_id=row["user_id"],
            source=TakeawaySourceRef(
                id=row["source_id"],
                title=row["source_title"],
                type=row["source_type"],
                image_url=image_url,
            ),
            title=row["title"],
            body=row["body"],
            body_json=row["body_json"],
            content_sha256=row["content_sha256"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _pickup_note(self, row: RowMapping) -> HomePickupNote:
        return HomePickupNote(
            id=row["id"],
            title=row["title"] or "Untitled",
            kind=row["kind"],
            preview=row["preview"] or "",
            word_count=row["word_count"] or 0,
            updated_at=row["updated_at"],
        )

    def _recently_captured(self, row: RowMapping) -> HomeRecentlyCaptured:
        return HomeRecentlyCaptured(
            source=self._source(row),
            captured_at=row["captured_at"],
        )

    def _primary_item(self, rows: Sequence[RowMapping]) -> HomePrimaryItem | None:
        if not rows:
            return None

        row = rows[0]
        item = HomePrimaryItem(
            kind=row["activity_kind"],
            activity_type=row["activity_type"],
            last_activity_at=row["last_activity_at"],
            section_id=row["section_id"],
            section_title=row["section_title"],
        )
        if row["activity_kind"] == "source" and row["s_id"] is not None:
            item.source = self._source(row)
        elif row["activity_kind"] == "note" and row["n_id"] is not None:
            item.note = HomeNoteDTO(
                id=row["n_id"],
                title=row["n_title"],
                kind=row["n_kind"],
                updated_at=row["n_updated_at"],
                preview=row["n_preview"] or "",
                word_count=row["n_word_count"] or 0,
                citation_count=row["n_citation_count"] or 0,
            )
        return item

    def _recent_sources(self, rows: Sequence[RowMapping]) -> list[HomeRecentSource]:
        sources: list[HomeRecentSource] = []
        for row in rows[1:]:
            if row["activity_kind"] != "source" or row["s_id"] is None:
                continue
            sources.append(
                HomeRecentSource(
                    source=self._source(row),
                    activity_type=row["activity_type"],
                    last_activity_at=row["last_activity_at"],
                )
            )
            if len(sources) == 4:
                break
        return sources

    def _source(self, row: RowMapping) -> SourceDTO:
        duration = None
        image_url = None
        media_url = None
        source_url = None
        episode = None

        if row["s_type"] == "podcast":
            duration = row["pe_duration"]
            image_url = row["pe_image_url"]
            media_url = row["pe_enclosure_url"]
            episode = row["pe_title"]
        elif row["s_type"] == "video":
            duration = row["v_duration"]
            image_url = row["v_thumbnail_url"]
            media_url = row["v_embed_url"]
            if row["v_platform"] == "youtube" and row["v_platform_id"]:
                source_url = f"https://www.youtube.com/watch?v={row['v_platform_id']}"

        return SourceDTO(
            id=row["s_id"],
            title=row["s_title"],
            type=row["s_type"],
            status=row["s_status"],
            author=row["s_author"],
            label=row["s_label"],
            metadata=row["s_metadata"],
            summary_short=row["s_summary_short"],
            summary_long=row["s_summary_long"],
            tag_ids=list(row["s_tag_ids"] or []),
            collection_ids=[],
            capture_count=row["s_capture_count"],
            citation_count=row["s_citation_count"],
            takeaway_count=row["s_takeaway_count"],
            published_at=row["s_published_at"],
            last_active_at=row["s_last_active_at"],
            completed_at=row["s_completed_at"],
            episode_id=row["s_episode_id"],
            video_id=row["s_video_id"],
            duration=duration,
            episode=episode,
            image_url=image_url,
            media_url=media_url,
            source_url=source_url,
            created_at=row["s_created_at"],
            updated_at=row["s_updated_at"],
        )

    def _highlight(self, row: RowMapping) -> HomeRecentHighlight:
        info_type = row["info_type"] or None
        return HomeRecentHighlight(
            kind=row["kind"],
            id=row["id"],
            source_id=row["source_id"],
            source_title=row["source_title"],
            source_type=row["source_type"],
            section_id=row["section_id"],
            section_title=row["section_title"],
            text=row["text"],
            summary=row["summary"],
            info_type=info_type,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
