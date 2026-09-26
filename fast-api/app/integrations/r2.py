"""Cloudflare R2 implementation of the ObjectStore provider (S3 API via boto3)."""

import json
import logging
import time
from threading import Lock
from typing import Any, cast

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.exceptions import ExternalServiceError
from app.providers.object_store import ObjectNotFoundError, ObjectStoreError, ReadableByteStream

logger = logging.getLogger(__name__)
MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024

# Presigned URLs are valid 7 days (see ExpiresIn below); cache them for 6 to
# leave a full day of headroom for clients that hold a URL across page loads,
# background app resumes, or long-running streams. Caching only matters on the
# presigned branch — the public-CDN branch is a string concat.
PRESIGNED_URL_EXPIRES_IN = 7 * 24 * 60 * 60  # 7 days, used in boto call
PRESIGNED_URL_CACHE_TTL = 6 * 24 * 60 * 60  # 6 days, in-process cache TTL


class R2Client:
    """Cloudflare R2 implementation of the ObjectStore provider (S3 API via boto3)."""

    def __init__(self) -> None:
        self.client = None
        # Per-instance presigned URL cache. R2Client is a module-level singleton
        # (app/clients.py), so this is process-wide. Not using app/core/cache.py
        # because that's async/aiocache; this is a sync helper called from sync
        # transcript-generation code paths.
        self._presigned_cache: dict[str, tuple[str, float]] = {}
        self._presigned_cache_lock = Lock()

        if self._is_configured():
            self.client = boto3.client(
                "s3",
                endpoint_url=settings.r2_endpoint_url,
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key,
                region_name="auto",
            )
            logger.info("R2 client initialized")
        else:
            logger.warning("R2 credentials not configured — storage operations disabled")

    def _is_configured(self) -> bool:
        return all(
            [
                settings.r2_account_id,
                settings.r2_access_key_id,
                settings.r2_secret_access_key,
                settings.r2_endpoint_url,
                settings.r2_bucket_name,
            ]
        )

    def is_available(self) -> bool:
        return self.client is not None

    def upload_json(self, key: str, data: dict) -> None:
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")
        try:
            self.client.put_object(
                Bucket=settings.r2_bucket_name,
                Key=key,
                Body=json.dumps(data, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            logger.info("Uploaded JSON to R2: %s", key)
        except ClientError as e:
            logger.error("Failed to upload to R2: %s", e)
            raise

    def upload_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> None:
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")
        try:
            self.client.put_object(
                Bucket=settings.r2_bucket_name,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            logger.info("Uploaded bytes to R2: %s", key)
        except ClientError as e:
            logger.error("Failed to upload to R2: %s", e)
            raise

    def upload_stream(
        self, key: str, stream: ReadableByteStream, content_type: str = "application/octet-stream"
    ) -> None:
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")
        client = self.client
        upload_id: str | None = None
        try:
            first_chunk = stream.read(MULTIPART_CHUNK_SIZE)
            if first_chunk == b"":
                client.put_object(
                    Bucket=settings.r2_bucket_name, Key=key, Body=b"", ContentType=content_type
                )
                return

            second_chunk = stream.read(MULTIPART_CHUNK_SIZE)
            if second_chunk == b"":
                client.put_object(
                    Bucket=settings.r2_bucket_name,
                    Key=key,
                    Body=first_chunk,
                    ContentType=content_type,
                )
                logger.info("Uploaded stream to R2 via put_object: %s", key)
                return

            multipart = client.create_multipart_upload(
                Bucket=settings.r2_bucket_name, Key=key, ContentType=content_type
            )
            upload_id = multipart["UploadId"]
            parts = []
            part_number = 1

            def _upload_part(data: bytes, number: int) -> None:
                response = client.upload_part(
                    Bucket=settings.r2_bucket_name,
                    Key=key,
                    UploadId=upload_id,
                    PartNumber=number,
                    Body=data,
                )
                parts.append({"PartNumber": number, "ETag": response["ETag"]})

            _upload_part(first_chunk, part_number)
            part_number += 1
            _upload_part(second_chunk, part_number)
            part_number += 1

            while True:
                chunk = stream.read(MULTIPART_CHUNK_SIZE)
                if chunk == b"":
                    break
                _upload_part(chunk, part_number)
                part_number += 1

            client.complete_multipart_upload(
                Bucket=settings.r2_bucket_name,
                Key=key,
                UploadId=upload_id,
                MultipartUpload={"Parts": parts},
            )
            logger.info("Uploaded stream to R2: %s", key)
        except ClientError as e:
            if upload_id:
                try:
                    client.abort_multipart_upload(
                        Bucket=settings.r2_bucket_name, Key=key, UploadId=upload_id
                    )
                except ClientError as abort_error:
                    logger.warning("Failed to abort multipart upload for %s: %s", key, abort_error)
            logger.error("Failed to upload stream to R2: %s", e)
            raise

    def get_bytes(self, key: str) -> bytes:
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")
        try:
            response = self.client.get_object(Bucket=settings.r2_bucket_name, Key=key)
            return cast(bytes, response["Body"].read())
        except ClientError as e:
            if _is_not_found(e):
                raise ObjectNotFoundError(key) from e
            logger.error("Failed to read from R2: %s", e)
            raise ObjectStoreError(f"failed to read {key}: {e}") from e

    def get_json(self, key: str) -> Any:
        return json.loads(self.get_bytes(key))

    def get_public_url(self, key: str) -> str:
        if settings.r2_public_url_base:
            return f"{settings.r2_public_url_base.rstrip('/')}/{key}"
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")

        now = time.monotonic()
        with self._presigned_cache_lock:
            entry = self._presigned_cache.get(key)
            if entry is not None and entry[1] > now:
                return entry[0]

        url = cast(
            str,
            self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.r2_bucket_name, "Key": key},
                ExpiresIn=PRESIGNED_URL_EXPIRES_IN,
            ),
        )

        with self._presigned_cache_lock:
            self._presigned_cache[key] = (url, now + PRESIGNED_URL_CACHE_TTL)
        return url

    def delete(self, key: str) -> None:
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")
        try:
            self.client.delete_object(Bucket=settings.r2_bucket_name, Key=key)
            logger.info("Deleted from R2: %s", key)
        except ClientError as e:
            logger.error("Failed to delete from R2: %s", e)
            raise
        with self._presigned_cache_lock:
            self._presigned_cache.pop(key, None)

    def exists(self, key: str) -> bool:
        if not self.client:
            raise ExternalServiceError("r2", "client not initialized — credentials not configured")
        try:
            self.client.head_object(Bucket=settings.r2_bucket_name, Key=key)
            return True
        except ClientError as e:
            if _is_not_found(e):
                return False
            logger.error("Failed to check R2 object: %s", e)
            raise


def _is_not_found(e: ClientError) -> bool:
    error_code = e.response.get("Error", {}).get("Code")
    status_code = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return error_code in {"404", "NoSuchKey", "NotFound"} or status_code == 404
