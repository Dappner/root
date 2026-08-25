class AppError(Exception):
    """Base class for all application errors."""


class NotFoundError(AppError):
    """Resource does not exist or does not belong to the requesting user."""

    def __init__(self, resource: str, id: int | str | None = None) -> None:
        detail = f"{resource} not found"
        if id is not None:
            detail = f"{resource} {id} not found"
        super().__init__(detail)


class AuthorizationError(AppError):
    """Caller is authenticated but not permitted to perform this action."""


class ConflictError(AppError):
    """Request conflicts with current resource state."""


class ValidationError(AppError):
    """Input is structurally valid but fails business-rule validation."""


class ExternalServiceError(AppError):
    """An upstream provider (AssemblyAI, R2, YouTube, LLM) returned an error."""

    def __init__(self, provider: str, detail: str) -> None:
        super().__init__(f"{provider}: {detail}")
