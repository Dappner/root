"""@cached decorator with a callable key builder.

Unlike a string-template decorator, the key builder receives the function's
kwargs and can include values that aren't function args — most importantly the
content_sha of an embedded entity, so a re-embed naturally produces a new key
and invalidates the prior value.

Bump KEY_PREFIX_VERSION when the cached value shape changes; old entries age
out via TTL without manual purge.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from functools import wraps
from typing import Any, TypeVar

from aiocache import BaseCache
from pydantic import BaseModel

from app.core.cache import get_cache
from app.core.logging import get_logger

logger = get_logger(__name__)

T = TypeVar("T")

KEY_PREFIX_VERSION = "v1"


def _serialize(value: Any) -> str:
    """JSON-encode the function result for backend portability.

    Memory backend would accept Python objects directly, but encoding here keeps
    behavior identical when we swap to Redis. Pydantic models are handled via
    model_dump; lists of models too.
    """
    if isinstance(value, BaseModel):
        return value.model_dump_json()
    if isinstance(value, list) and value and isinstance(value[0], BaseModel):
        return json.dumps([m.model_dump(mode="json") for m in value])
    return json.dumps(value)


def _deserialize(raw: str, model: type[BaseModel] | None, is_list: bool) -> Any:
    if model is None:
        result: Any = json.loads(raw)
        return result
    if is_list:
        return [model.model_validate(item) for item in json.loads(raw)]
    return model.model_validate_json(raw)


def cached(
    *,
    key: Callable[..., str],
    ttl: int,
    model: type[BaseModel] | None = None,
    is_list: bool = False,
    cache_getter: Callable[[], BaseCache] = get_cache,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """Cache an async function's result.

    Args:
        key: builds the cache key from the function's kwargs. Receives the
            *same* kwargs the decorated function was called with, so if the
            function takes operational args that don't belong in the key (db
            session, anything not affecting the result), the builder must
            absorb them with `**_: object`. Include every value that DOES
            affect the result (user_id, entity_id, content_sha, limit, …).
        ttl: cache TTL in seconds.
        model: pydantic model used to rehydrate cached values. Required when
            the function returns a pydantic model or list thereof.
        is_list: True when the function returns list[Model].
        cache_getter: returns the cache instance. Defaults to the app-wide
            singleton; tests inject a stub via the FastAPI dependency override
            on get_cache, which this defers to.

    The decorated function must accept keyword arguments only — positional args
    would make key construction ambiguous and surprise readers.
    """

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            if args:
                raise TypeError(
                    f"@cached function {func.__name__} must be called with keyword "
                    "arguments only; got positional args"
                )

            cache = cache_getter()
            user_key = key(**kwargs)
            cache_key = f"{KEY_PREFIX_VERSION}:{user_key}"

            try:
                raw = await cache.get(cache_key)
            except Exception:
                # Cache failures must never break the request path.
                logger.exception("cache get failed", extra={"key": cache_key})
                raw = None

            if raw is not None:
                try:
                    hit: T = _deserialize(raw, model, is_list)
                    return hit
                except Exception:
                    logger.exception("cache deserialize failed", extra={"key": cache_key})

            value = await func(**kwargs)

            try:
                await cache.set(cache_key, _serialize(value), ttl=ttl)
            except Exception:
                logger.exception("cache set failed", extra={"key": cache_key})

            return value

        return wrapper

    return decorator
