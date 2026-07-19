"""Rate limiting via slowapi (in-memory; swap to Redis for multi-process prod)."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# headers_enabled=False: with per-route @limiter.limit decorators (and no
# SlowAPIMiddleware), slowapi's header injection requires every decorated
# endpoint to declare a `response: Response` param, raising otherwise. We don't
# need RateLimit-* response headers in Phase 2, so injection is disabled.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT_DEFAULT],
    headers_enabled=False,
)
