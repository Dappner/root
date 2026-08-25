"""Logging configuration."""

import json
import logging
import os
import sys
from datetime import datetime, timezone

import logfire

from app.core.config import settings


class JsonFormatter(logging.Formatter):
    """Simple JSON formatter for structured logs."""

    def format(self, record: logging.LogRecord) -> str:
        log = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "app_env": settings.app_env,
        }

        if record.exc_info:
            log["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(log, ensure_ascii=True)


class HealthCheckFilter(logging.Filter):
    """Downgrade noisy health check access logs to debug."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            # Uvicorn access logs include the path in args[2].
            if (
                isinstance(record.args, tuple)
                and len(record.args) >= 3
                and record.args[2] == "/rag-api/health"
            ):
                record.levelno = logging.DEBUG
                record.levelname = "DEBUG"
                return True
        except Exception:
            pass

        message = record.getMessage()
        if "/rag-api/health" in message:
            record.levelno = logging.DEBUG
            record.levelname = "DEBUG"
        return True


def setup_logging() -> None:
    """Configure logging for the application."""
    logfire_enabled = bool(os.getenv("LOGFIRE_TOKEN"))
    if logfire_enabled:
        logfire.configure(environment=settings.app_env, service_name="fast-api")
        logfire.instrument_system_metrics()
        logfire.instrument_httpx()
        # SQLAlchemy instrumentation lives here (not in core.database) so all
        # logfire wiring stays in one place, and it stays gated on LOGFIRE_TOKEN.
        from app.core.database import engine

        logfire.instrument_sqlalchemy(engine=engine.sync_engine)
    # Get log level from config
    log_level_str = settings.log_level.upper()
    level = getattr(logging, log_level_str, logging.INFO)
    handler = logging.StreamHandler(sys.stdout)

    # Use JSON formatting in non-local environments
    if settings.app_env.lower() != "local":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )

    handler.addFilter(HealthCheckFilter())

    handlers: list[logging.Handler] = [handler]
    if logfire_enabled:
        # Forward stdlib log records (logger.info/warning/error) into Logfire
        # so they show up alongside spans. Without this, only auto-instrumented
        # things (httpx, FastAPI, SQLAlchemy) reach Logfire.
        logfire_handler = logfire.LogfireLoggingHandler()
        logfire_handler.setLevel(level)
        logfire_handler.addFilter(HealthCheckFilter())
        handlers.append(logfire_handler)

    logging.basicConfig(level=level, handlers=handlers, force=True)
    logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

    # Silence libraries that auto-instrumentation already traces as spans,
    # so we don't get the same event twice (once as a span, once as a log).
    for noisy in ("httpx", "httpcore", "sqlalchemy.engine.Engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)
