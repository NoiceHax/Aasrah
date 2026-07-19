"""Unit tests for pure service helpers."""

import math

from app.services.geo_utils import bounding_box, haversine_km
from app.services.security_sanitize import sanitize_text


def test_haversine_zero_distance():
    assert haversine_km(40.0, -74.0, 40.0, -74.0) == 0.0


def test_haversine_known_distance():
    # NYC City Hall to ~1 km north should be roughly 1 km.
    d = haversine_km(40.7128, -74.0060, 40.7218, -74.0060)
    assert 0.9 < d < 1.1


def test_haversine_symmetric():
    a = haversine_km(40.0, -74.0, 41.0, -75.0)
    b = haversine_km(41.0, -75.0, 40.0, -74.0)
    assert math.isclose(a, b, rel_tol=1e-9)


def test_bounding_box_contains_center():
    min_lat, max_lat, min_lon, max_lon = bounding_box(40.0, -74.0, 10.0)
    assert min_lat < 40.0 < max_lat
    assert min_lon < -74.0 < max_lon


def test_sanitize_strips_control_chars_and_trims():
    assert sanitize_text("  hello\x00world  ") == "helloworld"
    assert sanitize_text(None) is None
    assert sanitize_text("normal text") == "normal text"
