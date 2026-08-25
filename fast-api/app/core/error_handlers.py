"""Application exception handlers.

Maps each :class:`AppError` subclass to an HTTP status code. The base
``AppError`` is registered last so it acts as the catch-all (500) for any
application error that does not have a more specific handler.
"""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions import (
    AppError,
    AuthorizationError,
    ConflictError,
    ExternalServiceError,
    NotFoundError,
    ValidationError,
)

# Most specific first; AppError last as the catch-all.
ERROR_STATUS_CODES: list[tuple[type[AppError], int]] = [
    (NotFoundError, 404),
    (AuthorizationError, 403),
    (ConflictError, 409),
    (ValidationError, 400),
    (ExternalServiceError, 503),
    (AppError, 500),
]


def _make_handler(
    status_code: int,
) -> Callable[[Request, Exception], Awaitable[JSONResponse]]:
    async def handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": str(exc)})

    return handler


def register_error_handlers(app: FastAPI) -> None:
    """Register all application exception handlers on the FastAPI app."""
    for exc_type, status_code in ERROR_STATUS_CODES:
        app.add_exception_handler(exc_type, _make_handler(status_code))
