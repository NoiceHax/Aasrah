"""Application configuration via pydantic-settings (loaded from environment / .env)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    PROJECT_NAME: str = "Aasrah API"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    # Background job runner + automation scheduler. Disabled under tests so the
    # TestClient lifespan doesn't spin up long-lived asyncio loops.
    RUN_BACKGROUND_WORKERS: bool = True
    AUTOMATION_INTERVAL_SECONDS: int = 300

    # Database
    # Prefer AASRAH_DATABASE_URL so a generic DATABASE_URL set in the shell
    # (e.g. for another project) can't hijack this app's connection. Falls
    # back to DATABASE_URL only when the dedicated var is absent.
    AASRAH_DATABASE_URL: str | None = None
    DATABASE_URL: str | None = None

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS (comma-separated string in env; use `cors_origins` for the parsed list)
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # Uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_IMAGES_PER_REPORT: int = 6

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "200/minute"
    RATE_LIMIT_AUTH: str = "10/minute"

    # External services
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    NOMINATIM_USER_AGENT: str = "AasrahHumanitarianPlatform/1.0"

    # AI (NVIDIA NIM (OpenAI-compatible). Without a key, a heuristic fallback
    # is used so the features still function (degraded) offline.
    NVIDIA_API_KEY: str | None = None
    AI_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    AI_VISION_MODEL: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"
    AI_TEXT_MODEL: str = "openai/gpt-oss-120b"
    AI_TIMEOUT_SECONDS: float = 30.0

    # Email (SMTP). Without a host, emails are rendered + logged as a preview.
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "Aasrah <no-reply@aasrah.org>"
    SMTP_USE_TLS: bool = True

    # Web Push (VAPID). Generate with: python -m scripts.gen_vapid
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_SUBJECT: str = "mailto:support@aasrah.org"

    # Error tracking (Sentry). Dormant unless a DSN is provided.
    SENTRY_DSN: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    @property
    def ai_enabled(self) -> bool:
        return bool(self.NVIDIA_API_KEY)

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.SMTP_HOST)

    @property
    def push_enabled(self) -> bool:
        return bool(self.VAPID_PRIVATE_KEY and self.VAPID_PUBLIC_KEY)

    @property
    def sentry_enabled(self) -> bool:
        return bool(self.SENTRY_DSN)

    @property
    def database_url(self) -> str:
        """Resolved connection string: dedicated var wins over the generic one."""
        url = self.AASRAH_DATABASE_URL or self.DATABASE_URL
        if not url:
            raise RuntimeError(
                "No database URL configured. Set AASRAH_DATABASE_URL (preferred) "
                "or DATABASE_URL in backend/.env."
            )
        return url

    @property
    def sqlalchemy_database_url(self) -> str:
        """database_url normalized to the psycopg (v3) driver.

        The URL may arrive as `postgresql://...` (e.g. from a shell env var or
        the Neon dashboard) which SQLAlchemy maps to psycopg2. We force the
        psycopg v3 driver, which is what we install and which handles Neon's
        SSL requirements cleanly.
        """
        url = self.database_url
        if url.startswith("postgresql+"):
            return url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        return url

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
