"""Cache backend wiring.

Single place that decides which aiocache backend the app uses. Today it's
in-process memory; flip the env to use Redis without touching call sites.

NOTE: An alternate design materializes parallels (and similar results) into a
dedicated Postgres table with invalidation on the embedding pipeline. That's
worth doing if/when:
  - per-user takeaway counts exceed ~10k (ANN per request gets noticeable), or
  - we want to surface parallels in list/feed views (many at once), or
  - the in-process cache hit rate is low because reads spread across workers.
Until then, the cache here is sufficient.
"""

from __future__ import annotations

from aiocache import BaseCache, Cache

from app.core.config import settings

_cache: BaseCache | None = None


def _build_cache() -> BaseCache:
    """Construct the configured aiocache backend.

    Memory backend is per-process; safe for stateless data like cached
    parallels. Switch by setting CACHE_BACKEND=redis in env (and providing
    CACHE_REDIS_* settings).
    """
    backend = (getattr(settings, "cache_backend", None) or "memory").lower()
    if backend == "redis":
        return Cache(
            Cache.REDIS,
            endpoint=settings.cache_redis_endpoint,
            port=settings.cache_redis_port,
            namespace=getattr(settings, "cache_namespace", "root"),
        )
    return Cache(Cache.MEMORY, namespace=getattr(settings, "cache_namespace", "root"))


def get_cache() -> BaseCache:
    """FastAPI dependency: returns the process-wide cache instance.

    Single instance so connection pools (Redis) live across requests. Tests
    override this dependency to inject a stub cache.
    """
    global _cache
    if _cache is None:
        _cache = _build_cache()
    return _cache


def reset_cache_for_tests() -> None:
    """Test helper: drop the singleton so the next get_cache() rebuilds it."""
    global _cache
    _cache = None
