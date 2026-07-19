"""Geocoding via OpenStreetMap Nominatim (proxied server-side).

Proxying keeps the required User-Agent header attached and avoids browser CORS
and rate-limit issues. Be a good citizen of the public Nominatim instance.
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.exceptions import AppError
from app.schemas.geo import GeocodeResult, ReverseGeocodeResult

_HEADERS = {"User-Agent": settings.NOMINATIM_USER_AGENT}
_TIMEOUT = httpx.Timeout(10.0)


async def reverse_geocode(lat: float, lon: float) -> ReverseGeocodeResult:
    params = {"lat": lat, "lon": lon, "format": "jsonv2"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
        try:
            resp = await client.get(f"{settings.NOMINATIM_BASE_URL}/reverse", params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AppError("Geocoding service unavailable", code="geocoding_error",
                           status_code=502) from exc
    data = resp.json()
    return ReverseGeocodeResult(
        display_name=data.get("display_name", f"{lat:.5f}, {lon:.5f}"),
        latitude=float(data.get("lat", lat)),
        longitude=float(data.get("lon", lon)),
    )


async def search(query: str, *, limit: int = 5) -> list[GeocodeResult]:
    params = {"q": query, "format": "jsonv2", "limit": limit}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
        try:
            resp = await client.get(f"{settings.NOMINATIM_BASE_URL}/search", params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise AppError("Geocoding service unavailable", code="geocoding_error",
                           status_code=502) from exc
    return [
        GeocodeResult(
            display_name=item["display_name"],
            latitude=float(item["lat"]),
            longitude=float(item["lon"]),
        )
        for item in resp.json()
    ]
