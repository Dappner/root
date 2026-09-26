"""Object storage provider seam (transcripts, audio, PDFs)."""

from __future__ import annotations

import asyncio
import json
from typing import Any, Protocol

from app.core.config import Settings


class ReadableByteStream(Protocol):
    def read(self, size: int = -1) -> bytes: ...


class ObjectStoreError(RuntimeError):
    """Storage operation failed (provider-agnostic)."""


class ObjectNotFoundError(ObjectStoreError):
    def __init__(self, key: str) -> None:
        super().__init__(f"object not found: {key}")
        self.key = key


class ObjectStore(Protocol):
    """What services need from object storage. Methods are blocking; from async
    code read through ``read_json`` (or ``asyncio.to_thread``).

    ``get_public_url`` is for handing a URL to something outside the backend (a
    browser, AssemblyAI). The backend itself reads with ``get_bytes``/``get_json``.
    """

    def is_available(self) -> bool: ...

    def upload_json(self, key: str, data: dict) -> None: ...

    def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None: ...

    def upload_stream(
        self, key: str, stream: ReadableByteStream, content_type: str = "application/octet-stream"
    ) -> None: ...

    def get_bytes(self, key: str) -> bytes:
        """Raises ObjectNotFoundError if the key does not exist."""
        ...

    def get_json(self, key: str) -> Any: ...

    def exists(self, key: str) -> bool: ...

    def delete(self, key: str) -> None: ...

    def get_public_url(self, key: str) -> str: ...


async def read_json(store: ObjectStore, key: str) -> Any:
    """``store.get_json`` off the event loop."""
    return await asyncio.to_thread(store.get_json, key)


class InMemoryObjectStore:
    """Process-local ObjectStore for tests and offline runs.

    Public URLs use a ``memory://`` scheme: fine for code that only passes them
    along, not fetchable by browsers or third parties.
    """

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def is_available(self) -> bool:
        return True

    def upload_json(self, key: str, data: dict) -> None:
        self.upload_bytes(key, json.dumps(data, indent=2).encode(), "application/json")

    def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None:
        self.objects[key] = (bytes(data), content_type)

    def upload_stream(
        self, key: str, stream: ReadableByteStream, content_type: str = "application/octet-stream"
    ) -> None:
        chunks = []
        while chunk := stream.read(1024 * 1024):
            chunks.append(chunk)
        self.upload_bytes(key, b"".join(chunks), content_type)

    def get_bytes(self, key: str) -> bytes:
        if key not in self.objects:
            raise ObjectNotFoundError(key)
        return self.objects[key][0]

    def get_json(self, key: str) -> Any:
        return json.loads(self.get_bytes(key))

    def exists(self, key: str) -> bool:
        return key in self.objects

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    def get_public_url(self, key: str) -> str:
        return f"memory://objects/{key}"


def create_object_store(settings: Settings) -> ObjectStore:
    """Build the configured ObjectStore (``OBJECT_STORE_PROVIDER``: r2 | memory)."""
    if settings.object_store_provider == "memory":
        return InMemoryObjectStore()
    if settings.object_store_provider == "r2":
        from app.integrations.r2 import R2Client

        return R2Client()
    raise ValueError(f"unknown OBJECT_STORE_PROVIDER: {settings.object_store_provider!r}")
