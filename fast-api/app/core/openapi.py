"""OpenAPI schema normalization."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


def _is_request_schema_name(name: str) -> bool:
    return name.endswith("Request")


def _strip_null_branch(schema: dict[str, Any]) -> dict[str, Any]:
    for key in ("anyOf", "oneOf"):
        variants = schema.get(key)
        if not isinstance(variants, list):
            continue
        has_null_variant = any(
            isinstance(variant, dict) and variant.get("type") == "null" for variant in variants
        )
        if not has_null_variant:
            continue

        survivors = [
            variant
            for variant in variants
            if not (isinstance(variant, dict) and variant.get("type") == "null")
        ]
        if not survivors:
            return schema

        rewritten = {schema_key: value for schema_key, value in schema.items() if schema_key != key}
        if len(survivors) == 1:
            return {**survivors[0], **rewritten}
        return {**rewritten, key: survivors}

    return schema


def _strip_optional_nulls_in_properties(schema: dict[str, Any]) -> None:
    props = schema.get("properties")
    if not isinstance(props, dict):
        return

    required = set(schema.get("required") or [])
    for prop_name, prop_schema in props.items():
        if prop_name in required or not isinstance(prop_schema, dict):
            continue
        props[prop_name] = _strip_null_branch(prop_schema)


def normalize_optional_response_nulls(openapi_schema: dict[str, Any]) -> dict[str, Any]:
    """Collapse optional response DTO fields from ``T | null`` to ``T?``.

    FastAPI/Pydantic exposes ``field: T | None = None`` as both optional and
    nullable in OpenAPI. The API omits ``None`` response values at runtime, so
    response schemas should advertise an omitted field rather than explicit
    ``null``. Request schemas keep nullable top-level fields because some
    updates use ``null`` to clear a value while omission preserves it.
    """

    schemas = openapi_schema.get("components", {}).get("schemas", {})
    if not isinstance(schemas, dict):
        return openapi_schema

    for schema_name, schema in schemas.items():
        if not isinstance(schema_name, str) or not isinstance(schema, dict):
            continue
        if _is_request_schema_name(schema_name):
            continue
        _strip_optional_nulls_in_properties(schema)

    return openapi_schema


def install_openapi(app: FastAPI) -> None:
    """Install the project's normalized OpenAPI generator."""

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        app.openapi_schema = normalize_optional_response_nulls(openapi_schema)
        return app.openapi_schema

    app.openapi = custom_openapi  # type: ignore[method-assign]
