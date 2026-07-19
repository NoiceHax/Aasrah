"""Typed results returned by the AI provider (advisory only)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ImageAnalysis(BaseModel):
    """Vision-extracted observations. Every field is a suggestion an NGO can override."""

    age_range: str | None = None  # e.g. "elderly", "adult", "child", "infant"
    gender: str | None = None  # "male" | "female" | "unknown"
    children_present: bool = False
    visible_injuries: bool = False
    needs_medical: bool = False
    needs_food_or_shelter: bool = False
    description: str | None = None
    # 0..1 confidence per prediction (sparse; only what the model is sure about).
    confidence: dict[str, float] = Field(default_factory=dict)
    source: str = "heuristic"  # "ai" | "heuristic"


class SearchFilters(BaseModel):
    """Structured filters parsed from a natural-language query."""

    keywords: str | None = None
    status: str | None = None
    children_only: bool = False
    medical_only: bool = False
    unclaimed_only: bool = False
    since_hours: int | None = None
    waiting_over_hours: int | None = None
    near_keyword: str | None = None  # e.g. "hospital", "station"
    source: str = "heuristic"
