from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import PodcastEpisode, Source, Suggestion
from app.schemas.suggestions import SuggestionStatus


class SuggestionRepository:
    async def get_by_id(self, db: AsyncSession, suggestion_id: int) -> Suggestion | None:
        result = await db.execute(select(Suggestion).where(Suggestion.id == suggestion_id))
        return result.scalar_one_or_none()

    async def get_by_client_id(
        self, db: AsyncSession, user_id: str, client_id: str
    ) -> Suggestion | None:
        result = await db.execute(
            select(Suggestion).where(
                Suggestion.user_id == user_id,
                Suggestion.client_id == client_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_for_source(
        self,
        db: AsyncSession,
        user_id: str,
        source_id: int,
    ) -> list[Suggestion]:
        result = await db.execute(
            select(Suggestion)
            .where(Suggestion.user_id == user_id, Suggestion.source_id == source_id)
            .order_by(Suggestion.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_for_user(
        self,
        db: AsyncSession,
        user_id: str,
        statuses: list[SuggestionStatus] | None = None,
        limit: int = 20,
    ) -> list[Suggestion]:
        query = select(Suggestion).where(Suggestion.user_id == user_id)
        if statuses:
            query = query.where(Suggestion.status.in_(statuses))
        result = await db.execute(query.order_by(Suggestion.created_at.desc()).limit(limit))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, suggestion: Suggestion) -> Suggestion:
        db.add(suggestion)
        await db.flush()
        return suggestion

    async def save(self, db: AsyncSession, suggestion: Suggestion) -> Suggestion:
        await db.commit()
        await db.refresh(suggestion)
        return suggestion

    async def get_episode(self, db: AsyncSession, episode_id: int) -> PodcastEpisode | None:
        result = await db.execute(select(PodcastEpisode).where(PodcastEpisode.id == episode_id))
        return result.scalar_one_or_none()

    async def get_source_episode_id(self, db: AsyncSession, source_id: int) -> int | None:
        result = await db.execute(select(Source.episode_id).where(Source.id == source_id))
        row = result.scalar_one_or_none()
        return row

    async def get_approved_episode_id(
        self,
        db: AsyncSession,
        suggestion: Suggestion,
    ) -> int | None:
        episode_id = suggestion.episode_id
        if episode_id is None:
            episode_id = await self.get_source_episode_id(db, suggestion.source_id)
        return episode_id

    async def get_ready_episode(
        self,
        db: AsyncSession,
        episode_id: int,
    ) -> PodcastEpisode | None:
        episode = await self.get_episode(db, episode_id)
        if not episode or episode.transcript_status not in ("transcribed", "embedded"):
            return None
        return episode
