"""Database connection and session management."""

import ssl
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _prepare_database_config() -> tuple[Any, dict[str, Any]]:
    """Normalize DB URL and translate sslmode to asyncpg-compatible args."""
    db_url = settings.database_url
    # Ensure asyncpg driver is used
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    url = make_url(db_url)
    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    channel_binding = query.pop("channel_binding", None)

    connect_args: dict[str, Any] = {}
    if sslmode and isinstance(sslmode, str):
        mode = sslmode.lower()
        if mode == "disable":
            connect_args["ssl"] = False
        elif mode in ("allow", "prefer", "require"):
            connect_args["ssl"] = True
        elif mode in ("verify-ca", "verify-full"):
            connect_args["ssl"] = ssl.create_default_context()
        else:
            logger.warning(f"Unsupported sslmode '{sslmode}', defaulting to ssl=True")
            connect_args["ssl"] = True

    if channel_binding:
        logger.warning(
            "channel_binding option is not supported by asyncpg; ignoring it for compatibility"
        )

    if query != url.query:
        url = url.set(query=query)

    return url, connect_args


db_url, db_connect_args = _prepare_database_config()

# Create async engine
engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=db_connect_args,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Request-scoped DB session that auto-commits on success / rolls back on
    exception.

    Transaction-ownership rule:
    - Service methods that take `db: AsyncSession` MUST NOT commit. The caller
      (this dependency, for HTTP requests) owns the transaction boundary.
    - Service methods that open their own session via `session_factory` ARE
      their own unit of work and MUST commit explicitly.
    - Repositories never commit.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
