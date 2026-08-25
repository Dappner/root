from __future__ import annotations

from app.core.cache import get_cache
from app.core.cache_decorator import KEY_PREFIX_VERSION
from app.core.logging import get_logger

logger = get_logger(__name__)

SOURCE_LIST_CACHE_TTL_SECONDS = 30 * 60


def source_list_cache_key(*, user_id: str, **_: object) -> str:
    return f"sources:list:{user_id}"


async def invalidate_source_list_cache(user_id: str) -> None:
    cache_key = f"{KEY_PREFIX_VERSION}:{source_list_cache_key(user_id=user_id)}"
    try:
        await get_cache().delete(cache_key)
    except Exception:
        logger.exception("source list cache invalidation failed", extra={"key": cache_key})
