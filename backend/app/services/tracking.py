"""Human-friendly tracking ID generation (e.g. AR-9402)."""

from __future__ import annotations

import secrets

from app.repositories.report import ReportRepository

_PREFIX = "AR"


def generate_tracking_id(repo: ReportRepository, *, max_attempts: int = 10) -> str:
    """Generate a unique, short, human-readable tracking ID.

    Format: AR-XXXXXX where X is a base-32 (Crockford-ish, no ambiguous chars)
    character. Collision-checked against the DB; retries on the rare clash.
    """
    alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O/1/I/L
    for _ in range(max_attempts):
        suffix = "".join(secrets.choice(alphabet) for _ in range(6))
        candidate = f"{_PREFIX}-{suffix}"
        if not repo.tracking_id_exists(candidate):
            return candidate
    raise RuntimeError("Could not generate a unique tracking ID")
