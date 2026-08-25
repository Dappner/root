from __future__ import annotations

from app.core.cache import get_cache
from app.core.cache_decorator import KEY_PREFIX_VERSION
from app.core.logging import get_logger

logger = get_logger(__name__)

# Short TTL: the graph is a browse view that tolerates brief staleness, and the
# build is heavy (one ANN query per takeaway). We deliberately do NOT actively
# invalidate on writes — a missed bust would be the fragile part — and instead
# let the value self-heal within the TTL.
# TODO: if the manual invalidate_* discipline elsewhere becomes a tax, revisit
# generational (key-versioned) caching anchored to an after_commit ORM event so
# invalidation is forget-proof rather than per-call-site.
GRAPH_CACHE_TTL_SECONDS = 60


def graph_cache_key(*, user_id: str, **_: object) -> str:
    return f"graph:full:{user_id}"


async def invalidate_graph_cache(user_id: str) -> None:
    cache_key = f"{KEY_PREFIX_VERSION}:{graph_cache_key(user_id=user_id)}"
    try:
        await get_cache().delete(cache_key)
    except Exception:
        logger.exception("graph cache invalidation failed", extra={"key": cache_key})
