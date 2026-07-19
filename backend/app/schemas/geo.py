"""Geocoding schemas."""

from __future__ import annotations

from pydantic import BaseModel


class GeocodeResult(BaseModel):
    display_name: str
    latitude: float
    longitude: float


class ReverseGeocodeResult(BaseModel):
    display_name: str
    latitude: float
    longitude: float
