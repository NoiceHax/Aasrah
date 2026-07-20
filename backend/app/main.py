"""FastAPI application factory and entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.api.deps import require_roles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.observability import ObservabilityMiddleware, metrics
from app.core.rate_limit import limiter
from app.models.enums import UserRole
from app.models.user import User

configure_logging()
logger = get_logger(__name__)


def _init_sentry() -> None:
    """Initialize Sentry error tracking if a DSN is configured (dormant otherwise)."""
    if not settings.sentry_enabled:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        )
        logger.info("Sentry error tracking enabled")
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry-sdk is not installed")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds baseline security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(self), microphone=(), camera=()"
        )
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


@asynccontextmanager
async def lifespan(_: FastAPI):
    import asyncio

    from app.services.automation import scheduler_loop
    from app.services.jobs import runner

    logger.info(
        "%s v%s starting in %s mode", settings.PROJECT_NAME, __version__, settings.ENVIRONMENT
    )
    # A browser request from an origin not on this list is rejected before it
    # reaches any route, which looks like a generic network failure in the
    # frontend. Log the effective list so it can be checked without a redeploy.
    logger.info("CORS allowed origins: %s", settings.cors_origins)
    scheduler = None
    if settings.RUN_BACKGROUND_WORKERS:
        runner.start()
        scheduler = asyncio.create_task(scheduler_loop(settings.AUTOMATION_INTERVAL_SECONDS))
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.cancel()
            await runner.stop()
        logger.info("%s shutting down", settings.PROJECT_NAME)


def create_app() -> FastAPI:
    _init_sentry()
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=__version__,
        description="Backend API for the Aasrah Humanitarian Response Platform.",
        # The interactive explorer is a complete inventory of the API surface.
        # Useful everywhere except production, where it only helps an attacker.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
        lifespan=lifespan,
    )

    # Rate limiting: per-route via @limiter.limit decorators (each rate-limited
    # endpoint declares a `request: Request` param). No SlowAPIMiddleware: mixing
    # the global middleware with per-route decorators double-injects headers and
    # raises inside slowapi. The decorators alone enforce the limits.
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Security headers on every response.
    app.add_middleware(SecurityHeadersMiddleware)

    # Request IDs, latency logging, in-memory metrics.
    app.add_middleware(ObservabilityMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    register_exception_handlers(app)

    # API routes (versioned)
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # Locally-stored uploads are NOT served as static files. Report photographs
    # and case attachments (medical documents) are personal data about
    # vulnerable people; a static mount makes every stored byte world-readable
    # to anyone who learns or guesses a URL, with no auth and no expiry.
    # They are served by the authorized endpoint in app/api/v1/files.py instead.
    Path(settings.UPLOAD_DIR).resolve().mkdir(parents=True, exist_ok=True)

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {
            "name": settings.PROJECT_NAME,
            "version": __version__,
            "docs": "/docs",
            "api": settings.API_V1_PREFIX,
        }

    @app.get("/metrics", tags=["meta"])
    def metrics_endpoint(_: User = Depends(require_roles(UserRole.ADMIN))) -> dict:
        """In-process request/latency metrics. Admin-only.

        This route sits outside API_V1_PREFIX, so it inherits no router-level
        guard and must declare its own. The same data is served to the admin
        console via /api/v1/admin/monitoring.
        """
        return metrics.snapshot()

    return app


app = create_app()
