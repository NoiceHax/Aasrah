"""Shared serializers for NGO endpoints."""

from __future__ import annotations

from app.models.ngo import NGO
from app.schemas.ngo import NgoOut
from app.services.storage import StorageBackend


def ngo_out(ngo: NGO, storage: StorageBackend) -> NgoOut:
    out = NgoOut.model_validate(ngo)
    out.logo_url = storage.url_for(ngo.logo_key) if ngo.logo_key else None
    return out
