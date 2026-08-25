"""Voyage AI async client."""

from voyageai.client_async import AsyncClient


class VoyageClient(AsyncClient):
    """Thin subclass so services can type-hint against our integration, not voyageai directly."""

    pass
