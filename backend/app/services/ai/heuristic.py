"""Heuristic (no-LLM) implementations used when no AI key is configured.

These keep every AI-assisted feature functional offline by deriving results
from the report's own structured fields and simple keyword rules.
"""

from __future__ import annotations

import re

from app.services.ai.schemas import ImageAnalysis, SearchFilters

_MEDICAL_WORDS = ("injur", "bleed", "unconscious", "collapse", "wound", "medical", "sick", "pain", "breathing")
_SHELTER_WORDS = ("shelter", "homeless", "sleeping", "cold", "rain", "exposed", "flood", "displaced")
_FOOD_WORDS = ("food", "hungry", "water", "starv", "malnour")
_CHILD_WORDS = ("child", "children", "kid", "infant", "baby", "toddler", "minor")
_ELDERLY_WORDS = ("elderly", "old man", "old woman", "senior", "aged")


def _has(text: str, words: tuple[str, ...]) -> bool:
    return any(w in text for w in words)


def analyze_text(situation: str, description: str, children_present: bool) -> ImageAnalysis:
    """Best-effort analysis from the report text + situation (no image needed)."""
    t = (description or "").lower()
    needs_medical = situation == "medical" or _has(t, _MEDICAL_WORDS)
    needs_food_or_shelter = situation in ("shelter", "food") or _has(t, _SHELTER_WORDS) or _has(t, _FOOD_WORDS)
    age = "elderly" if _has(t, _ELDERLY_WORDS) else ("child" if _has(t, _CHILD_WORDS) else None)
    return ImageAnalysis(
        age_range=age,
        gender="unknown",
        children_present=children_present or _has(t, _CHILD_WORDS),
        visible_injuries=_has(t, _MEDICAL_WORDS),
        needs_medical=needs_medical,
        needs_food_or_shelter=needs_food_or_shelter,
        description=None,
        confidence={},  # heuristic makes no confidence claims
        source="heuristic",
    )


def summarize(situation: str, description: str, address: str | None, children_present: bool,
              people_count: int | None) -> str:
    """Compose a one-line summary from structured fields."""
    who = "Person"
    t = (description or "").lower()
    if children_present or _has(t, _CHILD_WORDS):
        who = "Family with children" if (people_count or 1) > 1 else "Child"
    elif _has(t, _ELDERLY_WORDS):
        who = "Elderly person"
    need = {
        "medical": "requiring medical assistance",
        "shelter": "requiring shelter",
        "food": "requiring food/water",
        "safety": "in a personal-safety situation",
    }.get(situation, "needing assistance")
    where = f" near {address}" if address else ""
    return f"{who} {need}{where}.".strip()


def parse_search(query: str) -> SearchFilters:
    """Map a natural-language query to structured filters via keyword rules."""
    q = query.lower().strip()
    f = SearchFilters(source="heuristic")

    if _has(q, _CHILD_WORDS):
        f.children_only = True
    if _has(q, _MEDICAL_WORDS) or "medical" in q:
        f.medical_only = True
    if "unclaimed" in q or "unassigned" in q:
        f.unclaimed_only = True
    if "today" in q:
        f.since_hours = 24
    elif "this week" in q or "week" in q:
        f.since_hours = 168
    elif "hour" in q:
        m = re.search(r"(\d+)\s*hour", q)
        if m:
            f.since_hours = int(m.group(1))

    # "waiting more than 3 hours"
    m = re.search(r"(?:more than|over|waiting)\D*(\d+)\s*hour", q)
    if m:
        f.waiting_over_hours = int(m.group(1))

    m = re.search(r"near (?:a |the )?(\w+)", q)
    if m:
        f.near_keyword = m.group(1)

    # Leftover free-text keywords (strip known operator words).
    stop = {"reports", "report", "near", "more", "than", "over", "waiting", "today",
            "this", "week", "hours", "hour", "unclaimed", "from", "the", "a", "with"}
    kw = " ".join(w for w in re.findall(r"[a-z]+", q) if w not in stop)
    f.keywords = kw or None
    return f
