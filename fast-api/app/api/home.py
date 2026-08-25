from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import home_service
from app.schemas.home import HomeResponse
from app.services.home_service import HomeService

router = APIRouter(prefix="/home", tags=["home"])


@router.get("", response_model=HomeResponse, operation_id="GetHome")
async def get_home(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[HomeService, Depends(home_service)],
) -> HomeResponse:
    return await service.get_home(db, user_id)
