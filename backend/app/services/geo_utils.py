"""Geographic helpers (distance calculations)."""

from __future__ import annotations

import math


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points, in kilometers."""
    radius = 6371.0  # Earth radius (km)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return radius * 2 * math.asin(math.sqrt(a))


def bounding_box(lat: float, lon: float, radius_km: float) -> tuple[float, float, float, float]:
    """Rough lat/lon bounding box for a radius: used to pre-filter in SQL
    before the exact haversine check. Returns (min_lat, max_lat, min_lon, max_lon)."""
    lat_delta = radius_km / 111.0  # ~111 km per degree latitude
    # Guard against division by zero near the poles.
    cos_lat = max(math.cos(math.radians(lat)), 0.01)
    lon_delta = radius_km / (111.0 * cos_lat)
    return (lat - lat_delta, lat + lat_delta, lon - lon_delta, lon + lon_delta)
