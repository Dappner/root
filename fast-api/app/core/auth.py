"""Authentication middleware."""

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

# Lazy-initialized JWT validator
_jwt_validator: "JWTValidator | None" = None


def get_jwt_validator() -> "JWTValidator":
    """Get or create the JWT validator (lazy initialization)."""
    global _jwt_validator
    if _jwt_validator is None:
        _jwt_validator = JWTValidator(settings.get_jwks_url())
    return _jwt_validator


class JWTValidator:
    """Validates Better Auth JWTs using JWKS."""

    def __init__(self, jwks_url: str, audience: str | None = None, cache_lifespan: int = 900):
        self.jwks_client = PyJWKClient(
            jwks_url,
            cache_keys=True,
            lifespan=cache_lifespan,
            # Headers to bypass Cloudflare/WAF bot protection on JWKS endpoint
            headers={
                "User-Agent": "root-rag-service/1.0",
                "Accept": "application/json",
            },
        )
        self.audience = audience

    def validate(self, token: str) -> dict:
        """Validate the JWT and return claims."""
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg", "RS256")

        options: dict[str, bool] = {"verify_aud": bool(self.audience)}
        try:
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=self.audience,
                options=options,  # type: ignore[arg-type]
            )
        except InvalidTokenError as exc:
            raise exc


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    root_session: str | None = Cookie(default=None, alias="root_session"),
) -> str:
    """Validate Authorization: Bearer <token> using Better Auth JWKS."""
    claims = await get_current_claims(credentials, root_session)
    user_id = claims.get("sub")
    logger.debug(f"Authenticated user: {user_id}")
    return str(user_id)


async def get_current_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    root_session: str | None = Cookie(default=None, alias="root_session"),
) -> dict:
    """Validate Authorization: Bearer <token> using Better Auth JWKS and return claims."""
    token = ""
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials.strip()
    elif root_session:
        token = root_session.strip()

    if not token:
        logger.warning("Missing or invalid Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Authorization header",
        )

    try:
        claims = await run_in_threadpool(get_jwt_validator().validate, token)
    except InvalidTokenError as exc:
        logger.warning(f"JWT validation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc
    except Exception as exc:
        logger.error(f"Error validating token: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        ) from exc

    user_id = claims.get("sub")
    if not user_id:
        logger.warning("Token missing sub claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        )

    return claims


async def require_admin_user(
    claims: dict = Depends(get_current_claims),
) -> str:
    """Require a Better Auth admin role and return the authenticated user ID."""
    if claims.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return str(claims["sub"])
