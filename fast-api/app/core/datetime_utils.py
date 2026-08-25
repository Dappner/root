"""Datetime helpers.

The DB column type is `timestamp without time zone`, so we strip tzinfo after
generating a UTC instant. Centralized here to keep that invariant consistent
across services that write created_at / updated_at.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer, WithJsonSchema


def utcnow() -> datetime:
    """Return the current UTC instant as a naive datetime (tzinfo stripped)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(value: datetime | None) -> datetime | None:
    """Normalize a datetime to naive UTC for writes to `timestamp` columns.

    - `None` passes through.
    - Naive datetimes are assumed to already represent UTC and returned as-is.
    - Aware datetimes are converted to UTC and stripped of tzinfo.

    Use at repository write boundaries when the input may be tz-aware (e.g.
    parsed RFC-2822 dates, third-party API responses).
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def to_aware_utc(value: datetime) -> datetime:
    """Normalize a datetime to aware UTC for comparison or wire serialization.

    Inverse of `to_naive_utc`. Use when comparing values from a naive `timestamp`
    column against values from a `timestamptz` column, or any external aware
    instant.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def serialize_utc_dt(dt: datetime) -> str:
    """Serialize a naive-UTC datetime to ISO-8601 with an explicit `Z` suffix.

    Every datetime in the DB is naive but represents a UTC instant (see
    `utcnow` above). JS's `new Date("2026-05-31T10:00:00")` treats a
    suffix-less string as local time, which silently shifts the value by the
    viewer's UTC offset — that's the "Updated 2h ago" bug for fresh rows.
    Appending `Z` tells the client this is UTC; `new Date("...Z")` parses it
    correctly.
    """
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    # If anyone ever hands us a tz-aware datetime, normalize to UTC and emit Z.
    return dt.astimezone(timezone.utc).replace(tzinfo=None).isoformat() + "Z"


# Use this in response schemas instead of bare `datetime` so the wire format
# always carries the UTC marker. Equivalent to declaring a field-level
# serializer per field but reusable everywhere. The `WithJsonSchema` hint
# preserves `format: date-time` in the OpenAPI doc that PlainSerializer would
# otherwise drop, so orval still gets a meaningful annotation.
UTCDatetime = Annotated[
    datetime,
    PlainSerializer(serialize_utc_dt, return_type=str),
    WithJsonSchema({"type": "string", "format": "date-time"}),
]
