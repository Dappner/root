"""Configuration settings for the RAG service."""

from urllib.parse import urljoin

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Essential environment variables only
    database_url: str
    embedding_api_key: str = ""  # Voyage API key (required when embedding_provider=voyage)
    google_api_key: str = ""  # Google API key (for Gemini LLM + YouTube Data API)
    openai_api_key: str = ""  # OpenAI API key (for review generation)
    anthropic_api_key: str = ""  # Anthropic API key (Claude models)
    assemblyai_api_key: str = ""  # AssemblyAI API key (for transcripts)
    elevenlabs_api_key: str = ""  # ElevenLabs API key (for conversational voice)
    elevenlabs_agent_id: str = ""  # ElevenLabs conversational agent ID

    # Cloudflare R2 configuration (for transcript storage)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_endpoint_url: str = ""
    r2_public_url_base: str = ""  # Optional: custom domain for intentional public access

    better_auth_url: str = "http://localhost:3000"
    jwks_url: str | None = None  # Auto-derived if not provided
    cors_origins: list[str] = ["http://localhost:3000"]
    app_env: str = "local"  # local, staging, production
    log_level: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # YouTube Proxy Configuration
    youtube_proxy_username: str = ""
    youtube_proxy_password: str = ""
    youtube_proxy_country: str = ""  # Optional: e.g., "CA" for Canadian proxies

    # Cache backend: "memory" (per-process) or "redis"
    cache_backend: str = "memory"
    cache_namespace: str = "root"
    cache_redis_endpoint: str = "localhost"
    cache_redis_port: int = 6379

    # --- Optional vars ---
    # Non-critical for startup: sensible defaults work out of the box, override
    # via env only when you need to. Document + query embeddings must share the
    # same model (same vector space); bumping it makes existing rows stale and
    # the admin refresh endpoint picks them up.
    embedding_model: str = "voyage-4-large"
    # "voyage" (real) or "fake" (deterministic, offline: tests + local verification).
    embedding_provider: str = "voyage"
    # Override the Voyage API base URL (e.g. a local HTTP fake for verification runs).
    # Empty = the SDK default (https://api.voyageai.com/v1).
    embedding_base_url: str = ""

    def get_jwks_url(self) -> str:
        """Get JWKS URL, deriving from better_auth_url if needed."""
        if self.jwks_url:
            return self.jwks_url
        base = self.better_auth_url.rstrip("/") + "/"
        return urljoin(base, "api/auth/jwks")

    def validate_startup_config(self) -> None:
        """Validate required runtime config and fail fast on invalid deployments."""
        missing: list[str] = []

        if self.embedding_provider == "voyage" and not self.embedding_api_key:
            missing.append("embedding_api_key")

        r2_required = {
            "r2_account_id": self.r2_account_id,
            "r2_access_key_id": self.r2_access_key_id,
            "r2_secret_access_key": self.r2_secret_access_key,
            "r2_bucket_name": self.r2_bucket_name,
            "r2_endpoint_url": self.r2_endpoint_url,
        }
        missing.extend(name for name, value in r2_required.items() if not value)

        if missing:
            missing_csv = ", ".join(sorted(missing))
            raise RuntimeError(
                "Missing required environment configuration for FastAPI startup: " f"{missing_csv}"
            )


# Global settings instance (FastAPI pattern: "Settings in another module")
# https://fastapi.tiangolo.com/advanced/settings/#settings-in-another-module
settings = Settings()
