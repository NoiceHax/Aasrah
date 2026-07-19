"""Lightweight observability: request IDs, latency logging, in-memory metrics.

Production would export to Prometheus/OTel; here we keep an in-process metrics
registry exposed at /metrics and attach a request id + timing to every request.
"""

from __future__ import annotations

import time
import uuid
from collections import defaultdict
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import get_logger

logger = get_logger("aasrah.request")


class Metrics:
    """Thread-safe counters + latency aggregates keyed by route template."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.request_count: dict[str, int] = defaultdict(int)
        self.error_count: dict[str, int] = defaultdict(int)
        self.latency_ms_total: dict[str, float] = defaultdict(float)
        self.status_count: dict[int, int] = defaultdict(int)

    def observe(self, route: str, status_code: int, duration_ms: float) -> None:
        with self._lock:
            self.request_count[route] += 1
            self.latency_ms_total[route] += duration_ms
            self.status_count[status_code] += 1
            if status_code >= 500:
                self.error_count[route] += 1

    def snapshot(self) -> dict:
        with self._lock:
            routes = {}
            for route, count in self.request_count.items():
                routes[route] = {
                    "requests": count,
                    "errors": self.error_count.get(route, 0),
                    "avg_latency_ms": round(self.latency_ms_total[route] / count, 2) if count else 0,
                }
            return {
                "routes": routes,
                "status_codes": dict(self.status_count),
                "total_requests": sum(self.request_count.values()),
                "total_errors": sum(self.error_count.values()),
            }


metrics = Metrics()


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        start = time.perf_counter()
        # Route template (not the concrete path) keeps cardinality bounded.
        route = request.scope.get("route")
        route_label = getattr(route, "path", request.url.path)

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            metrics.observe(route_label, 500, duration_ms)
            logger.exception("rid=%s %s %s -> 500 (%.1fms)",
                             request_id, request.method, request.url.path, duration_ms)
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        metrics.observe(route_label, response.status_code, duration_ms)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-ms"] = f"{duration_ms:.1f}"
        logger.info("rid=%s %s %s -> %d (%.1fms)",
                    request_id, request.method, request.url.path, response.status_code, duration_ms)
        return response
