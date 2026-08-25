"""Knowledge graph endpoints: full-library graph + per-node neighborhood."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.routing import APIRouter
from app.schemas.graph import GraphResponse, NodeNeighborhood
from app.services.graph_service import GraphService, graph_service
from app.services.neighborhood_service import NeighborhoodService, neighborhood_service

router = APIRouter(tags=["graph"])


@router.get("/graph", response_model=GraphResponse)
async def get_graph(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[GraphService, Depends(graph_service)],
) -> GraphResponse:
    """User's full knowledge graph: takeaways + notes as nodes. Edges are
    either structural (shared citation) or semantic (embedding nearest-
    neighbor between takeaways across sources). See Root - Graph Model in the
    vault for design rationale."""
    return await service.build_graph(db, user_id=user_id)


@router.get("/neighborhood", response_model=NodeNeighborhood)
async def get_neighborhood(
    user_id: Annotated[str, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[NeighborhoodService, Depends(neighborhood_service)],
    node_id: str = Query(
        ...,
        description="Composite node id: 'takeaway:42' | 'note:7' | 'citation:17'",
    ),
) -> NodeNeighborhood:
    """Citation-pivoted local graph for any node. The shape is uniform across
    center kinds: takeaway and note centers pivot through their citations;
    citation centers carry every entity referencing them directly."""
    return await service.build(db, user_id=user_id, node_id=node_id)
