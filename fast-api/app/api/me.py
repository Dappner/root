from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import stats_service
from app.schemas.stats import UserStatsResponse
from app.services.stats_service import StatsService

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/stats", response_model=UserStatsResponse, operation_id="GetMyStats")
async def get_my_stats(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[StatsService, Depends(stats_service)],
    weeks_back: int = Query(
        default=12,
        ge=1,
        le=53,
        description="Weeks of activity history (1-53)",
    ),
) -> UserStatsResponse:
    return await service.get_for_user(db, user_id, weeks_back=weeks_back)
