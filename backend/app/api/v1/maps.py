"""Map / geocoding helper endpoints (proxy to Nominatim)."""

from fastapi import APIRouter, Query, Request

from app.core.rate_limit import limiter
from app.schemas.geo import GeocodeResult, ReverseGeocodeResult
from app.services import geocoding

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("/reverse", response_model=ReverseGeocodeResult)
@limiter.limit("60/minute")
async def reverse(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> ReverseGeocodeResult:
    return await geocoding.reverse_geocode(lat, lon)


@router.get("/search", response_model=list[GeocodeResult])
@limiter.limit("60/minute")
async def search(
    request: Request,
    q: str = Query(..., min_length=2, max_length=200),
    limit: int = Query(5, ge=1, le=10),
) -> list[GeocodeResult]:
    return await geocoding.search(q, limit=limit)
