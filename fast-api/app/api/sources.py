from typing import Annotated

from fastapi import Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.core.routing import APIRouter
from app.deps import get_object_store
from app.integrations.enrichment import fetch_metadata_from_web
from app.providers.object_store import ObjectStore
from app.schemas.problem import Problem
from app.schemas.sources import (
    CreateSourceRequest,
    EnrichSourceRequest,
    EnrichSourceResponse,
    PdfUploadResponse,
    PdfUrlResponse,
    SourceCounts,
    SourceDTO,
    SourcesListResponse,
    SourcesMetadata,
    SourceStatusResponse,
    SourceSummariesResponse,
    TransitionSourceStatusRequest,
    UpdateSourceRequest,
    UpdateSourceSummariesRequest,
)
from app.services import source_service
from app.services.source_lifecycle import (
    transition_source_status,
    update_source_summaries,
)
from app.services.source_pdf_service import get_pdf_url, upload_pdf

router = APIRouter(tags=["sources"])


@router.get(
    "/sources",
    response_model=SourcesListResponse,
    operation_id="listSources",
    summary="List all sources with type-count metadata",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
    },
)
async def list_sources(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourcesListResponse:
    """Return all of the user's sources plus per-type counts (book/article/
    video/podcast/pdf and `all`) used by the library filter chips."""
    sources = await source_service.list_sources(db, user_id)
    counts = SourceCounts(
        all=len(sources),
        book=sum(1 for s in sources if s.type == "book"),
        article=sum(1 for s in sources if s.type == "article"),
        video=sum(1 for s in sources if s.type == "video"),
        podcast=sum(1 for s in sources if s.type == "podcast"),
        pdf=sum(1 for s in sources if s.type == "pdf"),
    )
    return SourcesListResponse(sources=sources, metadata=SourcesMetadata(counts=counts))


@router.post(
    "/sources",
    response_model=SourceDTO,
    status_code=201,
    operation_id="createSource",
    summary="Create a source",
    responses={
        400: {"model": Problem, "description": "Validation error"},
        401: {"model": Problem, "description": "Unauthorized"},
        409: {"model": Problem, "description": "Duplicate source"},
    },
)
async def create_source(
    req: CreateSourceRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourceDTO:
    """Create a source. Title is trimmed (empty rejected); a duplicate
    title+type returns 409; article/video/podcast URLs are normalized."""
    return await source_service.create_source(db, user_id, req)


@router.post(
    "/sources/enrich",
    response_model=EnrichSourceResponse,
    operation_id="enrichSource",
    summary="Enrich source metadata from a URL",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        503: {"model": Problem, "description": "Enrichment failed"},
    },
)
async def enrich_source(
    req: EnrichSourceRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> EnrichSourceResponse:
    """Fetch lightweight metadata (title/site/author/description) for a URL via
    YouTube oEmbed or OpenGraph scraping. Upstream failures return 503."""
    metadata = await fetch_metadata_from_web(req.url)
    return EnrichSourceResponse(
        title=metadata.title or None,
        site_name=metadata.site_name or None,
        author_name=metadata.author_name or None,
        description=metadata.description or None,
    )


@router.get(
    "/sources/{source_id}",
    response_model=SourceDTO,
    operation_id="getSource",
    summary="Get a source by ID",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
    },
)
async def get_source(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourceDTO:
    return await source_service.get_source(db, user_id, source_id)


@router.put(
    "/sources/{source_id}",
    response_model=SourceDTO,
    operation_id="updateSource",
    summary="Update a source",
    responses={
        400: {"model": Problem, "description": "Validation error"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
    },
)
async def update_source(
    source_id: int,
    req: UpdateSourceRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourceDTO:
    """PUT-merge update: omitted fields are preserved. `tag_ids` is tri-state —
    null leaves tags untouched, [] clears, a list replaces."""
    return await source_service.update_source(db, user_id, source_id, req)


@router.delete(
    "/sources/{source_id}",
    status_code=204,
    operation_id="deleteSource",
    summary="Delete a source",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
    },
)
async def delete_source(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    r2: Annotated[ObjectStore, Depends(get_object_store)],
) -> None:
    """Delete a source. For `pdf` sources the stored R2 object is removed first;
    child rows are handled by the DB's FK rules."""
    await source_service.delete_source(db, user_id, source_id, r2)


@router.patch(
    "/sources/{source_id}/status",
    response_model=SourceStatusResponse,
    operation_id="transitionSourceStatus",
    summary="Transition a source's lifecycle status",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        409: {"model": Problem, "description": "Illegal transition"},
    },
)
async def transition_status(
    source_id: int,
    req: TransitionSourceStatusRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourceStatusResponse:
    """Move a source between todo/in_progress/reflecting/done.

    The legal transition graph is enforced server-side; illegal moves return 409.
    """
    source = await transition_source_status(
        db,
        source_id=source_id,
        user_id=user_id,
        target=req.status,
    )
    return SourceStatusResponse.model_validate(source)


@router.patch(
    "/sources/{source_id}/summary",
    response_model=SourceSummariesResponse,
    operation_id="updateSourceSummaries",
    summary="Update a source's long summary",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
    },
)
async def update_summaries(
    source_id: int,
    req: UpdateSourceSummariesRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourceSummariesResponse:
    """Set the long summary for a source (user-written, not AI-generated)."""
    source = await update_source_summaries(
        db,
        source_id=source_id,
        user_id=user_id,
        summary_long=req.summary_long,
    )
    return SourceSummariesResponse.model_validate(source)


@router.post(
    "/sources/{source_id}/pdf",
    response_model=PdfUploadResponse,
    operation_id="uploadSourcePdf",
    summary="Upload a PDF file for a source",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        409: {"model": Problem, "description": "Storage unavailable"},
    },
)
async def upload_source_pdf(
    source_id: int,
    file: Annotated[UploadFile, File()],
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    r2: Annotated[ObjectStore, Depends(get_object_store)],
) -> PdfUploadResponse:
    """Store a PDF (max 50MB) for a `pdf`-type source. Replacing an existing
    PDF clears highlights derived from the previous file."""
    content_type = file.content_type or ""
    filename = file.filename or ""
    if "pdf" not in content_type.lower() and not filename.lower().endswith(".pdf"):
        raise ValidationError("invalid file type; PDF required")
    if "pdf" not in content_type.lower():
        content_type = "application/pdf"

    data = await file.read()
    size_bytes = await upload_pdf(
        db,
        r2,
        source_id=source_id,
        user_id=user_id,
        content_type=content_type,
        data=data,
    )
    return PdfUploadResponse(size_bytes=size_bytes)


@router.get(
    "/sources/{source_id}/pdf/url",
    response_model=PdfUrlResponse,
    operation_id="getSourcePdfUrl",
    summary="Get a URL for a source's stored PDF",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        404: {"model": Problem, "description": "No PDF stored"},
    },
)
async def get_source_pdf_url(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    r2: Annotated[ObjectStore, Depends(get_object_store)],
) -> PdfUrlResponse:
    url = await get_pdf_url(db, r2, source_id=source_id, user_id=user_id)
    return PdfUrlResponse(url=url)
