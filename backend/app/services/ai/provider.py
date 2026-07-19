"""AI provider: NVIDIA NIM (OpenAI-compatible) with a heuristic fallback.

Public functions are synchronous-friendly wrappers that the background job
runner calls off the request path. Any provider error, timeout, or missing key
silently degrades to the heuristic implementation so features never hard-fail.
"""

from __future__ import annotations

import base64
import json
import re

from app.core.config import settings
from app.core.logging import get_logger
from app.services.ai import heuristic
from app.services.ai.schemas import ImageAnalysis, SearchFilters

logger = get_logger(__name__)

_client = None


def _get_client():
    """Lazily build the OpenAI client pointed at NIM. None if no key."""
    global _client
    if not settings.ai_enabled:
        return None
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(
            base_url=settings.AI_BASE_URL,
            api_key=settings.NVIDIA_API_KEY,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
    return _client


def _extract_json(text: str) -> dict | None:
    """Pull the first JSON object out of a model response (which may include prose)."""
    if not text:
        return None
    # Strip code fences.
    text = re.sub(r"```(?:json)?", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def _chat(model: str, messages: list[dict]) -> str | None:
    """Single non-streaming completion; returns content or None on failure."""
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            top_p=0.9,
            max_tokens=1024,
            stream=False,
        )
        return resp.choices[0].message.content
    except Exception as exc:  # network/timeout/model errors → fall back
        logger.warning("AI call failed (%s); using heuristic fallback", exc)
        return None


# --- Public API ---

def analyze_image(
    image_bytes: bytes,
    content_type: str,
    *,
    situation: str,
    description: str,
    children_present: bool,
) -> ImageAnalysis:
    """Vision analysis of a report image, falling back to text heuristics."""
    client = _get_client()
    if client is None:
        return heuristic.analyze_text(situation, description, children_present)

    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type or 'image/jpeg'};base64,{b64}"
    prompt = (
        "You are assisting humanitarian responders. Analyze the person in this image "
        "and respond with ONLY a JSON object with keys: age_range (elderly|adult|child|infant|unknown), "
        "gender (male|female|unknown), children_present (bool), visible_injuries (bool), "
        "needs_medical (bool), needs_food_or_shelter (bool), description (short string), "
        "confidence (object mapping each key to 0..1). Be conservative; this assists, never decides."
    )
    content = _chat(
        settings.AI_VISION_MODEL,
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
    )
    data = _extract_json(content or "")
    if not data:
        return heuristic.analyze_text(situation, description, children_present)
    try:
        return ImageAnalysis(
            age_range=data.get("age_range"),
            gender=data.get("gender", "unknown"),
            children_present=bool(data.get("children_present", children_present)),
            visible_injuries=bool(data.get("visible_injuries", False)),
            needs_medical=bool(data.get("needs_medical", situation == "medical")),
            needs_food_or_shelter=bool(data.get("needs_food_or_shelter", False)),
            description=data.get("description"),
            confidence={k: float(v) for k, v in (data.get("confidence") or {}).items()
                        if isinstance(v, (int, float))},
            source="ai",
        )
    except (ValueError, TypeError):
        return heuristic.analyze_text(situation, description, children_present)


def summarize_report(
    *, situation: str, description: str, address: str | None,
    children_present: bool, people_count: int | None,
) -> str:
    """Generate a concise one-line report summary."""
    client = _get_client()
    if client is None:
        return heuristic.summarize(situation, description, address, children_present, people_count)

    prompt = (
        "Summarize this humanitarian report in ONE concise sentence (max 25 words), "
        "factual and neutral. Respond with only the sentence.\n\n"
        f"Situation: {situation}\nPeople: {people_count}\nChildren present: {children_present}\n"
        f"Address: {address}\nDetails: {description}"
    )
    content = _chat(settings.AI_TEXT_MODEL, [{"role": "user", "content": prompt}])
    if not content:
        return heuristic.summarize(situation, description, address, children_present, people_count)
    # Take the first non-empty line, trim quotes.
    line = next((ln.strip().strip('"') for ln in content.splitlines() if ln.strip()), "")
    return line or heuristic.summarize(situation, description, address, children_present, people_count)


def parse_search_query(query: str) -> SearchFilters:
    """Parse a natural-language search query into structured filters."""
    client = _get_client()
    if client is None:
        return heuristic.parse_search(query)

    prompt = (
        "Convert this search request into ONLY a JSON object with optional keys: "
        "keywords (string), status (string), children_only (bool), medical_only (bool), "
        "unclaimed_only (bool), since_hours (int), waiting_over_hours (int), near_keyword (string). "
        "Omit keys that don't apply.\n\nRequest: " + query
    )
    content = _chat(settings.AI_TEXT_MODEL, [{"role": "user", "content": prompt}])
    data = _extract_json(content or "")
    if not data:
        return heuristic.parse_search(query)
    try:
        return SearchFilters(
            keywords=data.get("keywords"),
            status=data.get("status"),
            children_only=bool(data.get("children_only", False)),
            medical_only=bool(data.get("medical_only", False)),
            unclaimed_only=bool(data.get("unclaimed_only", False)),
            since_hours=data.get("since_hours"),
            waiting_over_hours=data.get("waiting_over_hours"),
            near_keyword=data.get("near_keyword"),
            source="ai",
        )
    except (ValueError, TypeError):
        return heuristic.parse_search(query)
