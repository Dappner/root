"""FastAPI routing defaults shared across API modules."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter as FastAPIRouter
from fastapi.routing import APIRoute


class ExcludeNoneAPIRoute(APIRoute):
    """Omit ``None`` fields from response models by default.

    This preserves the old Go API's JSON shape for unset fields: omitted
    properties read as ``undefined`` in JavaScript instead of explicit ``null``.
    Request bodies still accept ``null`` where schemas use it for clear semantics.
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        if kwargs.get("response_model") is not None:
            kwargs["response_model_exclude_none"] = True
        super().__init__(*args, **kwargs)


class APIRouter(FastAPIRouter):
    """Project router with response serialization defaults."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault("route_class", ExcludeNoneAPIRoute)
        super().__init__(*args, **kwargs)
