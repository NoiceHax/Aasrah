"""FastAPI application factory and entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.observability import ObservabilityMiddleware, metrics
from app.core.rate_limit import limiter

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
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
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

    # Serve locally-stored uploads (local StorageBackend).
    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {
            "name": settings.PROJECT_NAME,
            "version": __version__,
            "docs": "/docs",
            "api": settings.API_V1_PREFIX,
        }

    @app.get("/metrics", tags=["meta"])
    def metrics_endpoint() -> dict:
        """In-process request/latency metrics (lightweight, no auth)."""
        return metrics.snapshot()

    return app


app = create_app()
