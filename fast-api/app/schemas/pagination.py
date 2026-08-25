"""Shared pagination primitives used by listing endpoints."""

from __future__ import annotations

from pydantic import BaseModel


class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int
    has_next: bool
    has_previous: bool


def make_pagination_meta(total: int, limit: int, offset: int) -> PaginationMeta:
    return PaginationMeta(
        total=total,
        limit=limit,
        offset=offset,
        has_next=(offset + limit) < total,
        has_previous=offset > 0,
    )
