"""ObjectStore seam: the in-memory fake's contract, R2 read errors, and a service
reading through the store instead of fetching presigned URLs."""

import io

import boto3
import pytest
from botocore.stub import Stubber

from app.core.config import Settings
from app.integrations import r2 as r2_module
from app.integrations.r2 import R2Client
from app.providers.object_store import (
    InMemoryObjectStore,
    ObjectNotFoundError,
    ObjectStoreError,
    create_object_store,
    read_json,
)
from app.services.transcript_chunk_hydrator import TranscriptChunkHydrator


@pytest.mark.asyncio
async def test_in_memory_store_round_trips() -> None:
    store = InMemoryObjectStore()
    store.upload_json("a/doc.json", {"x": 1})
    store.upload_stream("a/blob", io.BytesIO(b"hello" * 1000), "audio/mpeg")

    assert await read_json(store, "a/doc.json") == {"x": 1}
    assert store.get_bytes("a/blob") == b"hello" * 1000
    assert store.exists("a/blob")
    store.delete("a/blob")
    assert not store.exists("a/blob")
    with pytest.raises(ObjectNotFoundError):
        store.get_bytes("a/blob")


def _stubbed_r2(monkeypatch: pytest.MonkeyPatch) -> tuple[R2Client, Stubber]:
    monkeypatch.setattr(r2_module.settings, "r2_bucket_name", "bucket")
    client = R2Client()
    client.client = boto3.client(
        "s3",
        region_name="auto",
        endpoint_url="http://r2.invalid",
        aws_access_key_id="k",
        aws_secret_access_key="s",
    )
    return client, Stubber(client.client)


def test_r2_get_bytes_maps_missing_key_and_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    client, stub = _stubbed_r2(monkeypatch)
    stub.add_client_error("get_object", "NoSuchKey", http_status_code=404)
    stub.add_client_error("get_object", "InternalError", http_status_code=500)
    stub.add_response(
        "get_object",
        {"Body": io.BytesIO(b'{"utterances": []}')},
        {"Bucket": "bucket", "Key": "ok.json"},
    )
    with stub:
        with pytest.raises(ObjectNotFoundError):
            client.get_bytes("missing.json")
        with pytest.raises(ObjectStoreError):
            client.get_bytes("broken.json")
        assert client.get_json("ok.json") == {"utterances": []}


@pytest.mark.asyncio
async def test_chunk_hydrator_reads_transcript_from_store() -> None:
    store = InMemoryObjectStore()
    store.upload_json(
        "podcasts/7/transcript.json",
        {"utterances": [{"text": "Compounding curiosity.", "start": 0, "end": 1000}]},
    )

    result = await TranscriptChunkHydrator(store).hydrate([(1, 0, 7, None), (2, 0, None, 9)])

    chunk = result[(1, 0)]
    assert chunk is not None and "Compounding curiosity." in chunk.text
    assert result[(2, 0)] is None  # missing transcript degrades to no chunk


def test_create_object_store_selects_provider() -> None:
    base = {"database_url": "postgresql://t:t@localhost/t"}
    assert isinstance(
        create_object_store(Settings(**base, object_store_provider="memory")),
        InMemoryObjectStore,
    )
    assert isinstance(create_object_store(Settings(**base, object_store_provider="r2")), R2Client)
    with pytest.raises(ValueError):
        create_object_store(Settings(**base, object_store_provider="nope"))
    # R2 credentials are only required for the r2 provider.
    Settings(
        **base, object_store_provider="memory", embedding_provider="fake"
    ).validate_startup_config()
