"""Playback progress tracking.

Persists per-source playback position into the source's `metadata_json` and
derives a `completed` flag. Lives in the service layer so the route stays a thin
parse/auth/return shell.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utcnow
from app.core.ownership import require_source
from app.schemas.playback import PlaybackProgressRequest, PlaybackProgressResponse

# Fraction of duration past which a source counts as "completed".
PLAYBACK_COMPLETE_PROGRESS = 0.95


class PlaybackService:
    async def update_progress(
        self,
        db: AsyncSession,
        *,
        user_id: str,
        source_id: int,
        payload: PlaybackProgressRequest,
    ) -> PlaybackProgressResponse:
        """Record playback position for a source the user owns.

        Stamps `current_position`, a type-appropriate last-played timestamp, and
        (when duration is known) `duration` + a `completed` flag into the
        source's metadata. The caller's transaction boundary commits.
        """
        source = await require_source(db, source_id, user_id)

        metadata = dict(source.metadata_json or {})
        now = utcnow()
        position = int(round(payload.position_seconds))
        duration = (
            int(round(payload.duration_seconds)) if payload.duration_seconds is not None else None
        )

        metadata["current_position"] = position
        if source.type == "video":
            metadata["last_watched_at"] = now.isoformat()
        else:
            metadata["last_listened_at"] = now.isoformat()
        if duration is not None:
            metadata["duration"] = duration
            metadata["completed"] = (
                duration > 0 and position / duration >= PLAYBACK_COMPLETE_PROGRESS
            )

        source.metadata_json = metadata
        source.updated_at = now

        return PlaybackProgressResponse(
            source_id=source_id,
            position_seconds=float(position),
            duration_seconds=float(duration) if duration is not None else None,
        )
