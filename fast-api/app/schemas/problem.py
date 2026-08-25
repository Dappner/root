"""RFC 7807 problem details schema.

When raising errors in handlers, prefer raising the typed exceptions from
`app.core.exceptions` so the global exception handlers can shape the
response uniformly. This schema exists for OpenAPI documentation only —
no handler should construct `Problem` instances by hand.
"""

from __future__ import annotations

from pydantic import BaseModel


class FieldError(BaseModel):
    field: str | None = None
    code: str | None = None
    message: str | None = None


class Problem(BaseModel):
    type: str | None = None
    title: str | None = None
    status: int | None = None
    detail: str | None = None
    instance: str | None = None
    errors: list[FieldError] | None = None
