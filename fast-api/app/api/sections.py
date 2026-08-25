from inspect import signature
from typing import Annotated, cast

from fastapi import BackgroundTasks, Depends, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.core.ownership import require_source
from app.core.routing import APIRouter
from app.deps import (
    capture_service,
    citation_service,
    get_voyage,
)
from app.deps import (
    section_summary_embedding_service as build_section_summary_embedding_service,
)
from app.integrations.voyage import VoyageClient
from app.models.database import SourceSection
from app.schemas.problem import Problem
from app.schemas.sections import (
    CreateSourceSectionRequest,
    MoveHighlightToSectionRequest,
    ReorderSourceSectionsRequest,
    SourceSectionResponse,
    UpdateSourceSectionRequest,
)
from app.services import source_section_service
from app.services.capture_service import CaptureService
from app.services.citation_service import CitationService
from app.services.section_summary_embedding_service import SectionSummaryEmbeddingService
from app.services.source_sectioning_service import RegenerateStatus, regenerate_sections_for_source

router = APIRouter(tags=["sections"])


def _section_summary_embedding_service(
    voyage_client: VoyageClient,
) -> SectionSummaryEmbeddingService:
    return build_section_summary_embedding_service(voyage_client)


def _section_summary_embedding_dependency(
    voyage_client: Annotated[VoyageClient, Depends(get_voyage)],
) -> SectionSummaryEmbeddingService:
    provider = _section_summary_embedding_service
    if len(signature(provider).parameters) == 0:
        return cast(SectionSummaryEmbeddingService, provider())  # type: ignore[call-arg]
    return provider(voyage_client)


class RegenerateSectionsResponse(BaseModel):
    status: RegenerateStatus
    reason: str | None = None


@router.get(
    "/sources/{source_id}/sections",
    response_model=list[SourceSectionResponse],
    operation_id="listSourceSections",
)
async def list_source_sections(
    source_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[SourceSectionResponse]:
    await require_source(db, source_id, user_id)

    result = await db.execute(
        select(SourceSection)
        .where(SourceSection.source_id == source_id)
        .order_by(SourceSection.order_index.asc())
    )
    sections = result.scalars().all()
    return [SourceSectionResponse.model_validate(s) for s in sections]


@router.post(
    "/sources/{source_id}/sections",
    response_model=SourceSectionResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createSection",
    summary="Create a section",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
    },
)
async def create_section(
    source_id: int,
    req: CreateSourceSectionRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    embedding: Annotated[
        SectionSummaryEmbeddingService, Depends(_section_summary_embedding_dependency)
    ],
) -> SourceSectionResponse:
    """Create a user-authored section. A non-empty summary is hashed and an
    embedding is generated in the background after the request commits."""
    result = await source_section_service.create_section(
        db,
        user_id=user_id,
        source_id=source_id,
        title=req.title,
        subtitle=req.subtitle,
        summary=req.summary,
        range_start=req.range_start,
        range_end=req.range_end,
    )
    if result.needs_embedding:
        background_tasks.add_task(embedding.generate, result.section.id, user_id)
    return SourceSectionResponse.model_validate(result.section)


@router.put(
    "/sources/{source_id}/sections/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="reorderSections",
    summary="Reorder sections within a source",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def reorder_sections(
    source_id: int,
    req: ReorderSourceSectionsRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Renumber the listed sections by their position. Partial sets are allowed;
    each id must belong to the source (unknown ids -> 404)."""
    await source_section_service.reorder_sections(
        db, user_id=user_id, source_id=source_id, section_ids=req.section_ids
    )


@router.get(
    "/sources/{source_id}/sections/{section_id}",
    response_model=SourceSectionResponse,
    operation_id="getSection",
    summary="Get a section by ID",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def get_section(
    source_id: int,
    section_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SourceSectionResponse:
    section = await source_section_service.get_section(
        db, user_id=user_id, source_id=source_id, section_id=section_id
    )
    return SourceSectionResponse.model_validate(section)


@router.patch(
    "/sources/{source_id}/sections/{section_id}",
    response_model=SourceSectionResponse,
    operation_id="updateSection",
    summary="Update a section",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def update_section(
    source_id: int,
    section_id: int,
    req: UpdateSourceSectionRequest,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    embedding: Annotated[
        SectionSummaryEmbeddingService, Depends(_section_summary_embedding_dependency)
    ],
) -> SourceSectionResponse:
    """PATCH merge: omitted optional fields are preserved; an empty string
    clears subtitle/summary. Clearing the summary deletes its embedding row;
    a new/changed summary regenerates the embedding in the background."""
    existing = await source_section_service.get_section(
        db, user_id=user_id, source_id=source_id, section_id=section_id
    )

    # Fetch-then-merge: None means the field was omitted -> preserve existing.
    # An empty string is an explicit clear and flows through to the service.
    subtitle = req.subtitle if req.subtitle is not None else existing.subtitle
    summary = req.summary if req.summary is not None else existing.summary
    range_start = req.range_start if req.range_start is not None else existing.range_start
    range_end = req.range_end if req.range_end is not None else existing.range_end

    result = await source_section_service.update_section(
        db,
        user_id=user_id,
        source_id=source_id,
        section_id=section_id,
        title=req.title,
        subtitle=subtitle,
        summary=summary,
        range_start=range_start,
        range_end=range_end,
    )
    if result.needs_embedding:
        background_tasks.add_task(embedding.generate, result.section.id, user_id)
    return SourceSectionResponse.model_validate(result.section)


@router.delete(
    "/sources/{source_id}/sections/{section_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteSection",
    summary="Delete a section",
    responses={
        401: {"model": Problem, "description": "Unauthorized"},
        403: {"model": Problem, "description": "Forbidden"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def delete_section(
    source_id: int,
    section_id: int,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    await source_section_service.delete_section(
        db, user_id=user_id, source_id=source_id, section_id=section_id
    )


@router.put(
    "/sources/{source_id}/sections/assign",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="AssignHighlight",
    summary="Move a highlight (citation or capture) to a section",
    responses={
        400: {"model": Problem, "description": "Bad Request"},
        401: {"model": Problem, "description": "Unauthorized"},
        404: {"model": Problem, "description": "Not Found"},
    },
)
async def assign_highlight(
    source_id: int,
    req: MoveHighlightToSectionRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    captures: Annotated[CaptureService, Depends(capture_service)],
    citations: Annotated[CitationService, Depends(citation_service)],
) -> None:
    if req.highlight_type == "capture":
        # Captures attached to a citation inherit the citation's section and
        # must be moved via the citation, not directly.
        capture = await captures.get(db=db, user_id=user_id, capture_id=req.highlight_id)
        if capture.citation_id is not None:
            raise ValidationError("captures attached to a citation must be moved via the citation")
        await captures.assign_section(
            db=db,
            user_id=user_id,
            capture_id=req.highlight_id,
            source_id=source_id,
            section_id=req.section_id,
        )
    else:
        await citations.assign_section(
            db=db,
            user_id=user_id,
            citation_id=req.highlight_id,
            source_id=source_id,
            section_id=req.section_id,
        )


@router.post(
    "/sources/{source_id}/sections/regenerate",
    response_model=RegenerateSectionsResponse,
    operation_id="regenerateSourceSections",
)
async def regenerate_source_sections(
    source_id: int,
    background_tasks: BackgroundTasks,
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RegenerateSectionsResponse:
    """Trigger auto-sectioning for a single source.

    Returns immediately; the sectioning LLM call runs in the background.
    Skips non-AV sources and AV sources whose transcript isn't ready yet.
    """
    status, reason = await regenerate_sections_for_source(
        db=db,
        background_tasks=background_tasks,
        source_id=source_id,
        user_id=user_id,
    )
    return RegenerateSectionsResponse(status=status, reason=reason)
