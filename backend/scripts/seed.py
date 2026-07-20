"""Seed baseline data: an admin user and a couple of placeholder NGOs.

Idempotent; safe to run multiple times. Usage: python -m scripts.seed
"""

from __future__ import annotations

from app.core.logging import configure_logging, get_logger
from app.core.security import hash_password
from app.db.session import SessionLocal

# Import the full models package so every mapper (and relationship target like
# AuthSession) is registered before SQLAlchemy configures mappers.
import app.models  # noqa: F401
from app.models.enums import UserRole
from app.models.ngo import NGO
from app.models.user import User
from app.repositories.user import UserRepository

configure_logging()
logger = get_logger(__name__)

ADMIN_EMAIL = "admin@aasrah.org"
ADMIN_PASSWORD = "ChangeMe123!"  # noqa: S105  dev seed only

# No placeholder NGOs. These used to be seeded here as `is_verified=True`, which
# meant fictional orgs ("Hope Foundation", "Rescue International") showed up in
# the *public* verified-NGO directory as if they were real partners -- a
# credibility problem the moment a real NGO looks at the live site. Real NGOs
# are created and verified by an admin, never seeded. `scripts.seed_phase3` still
# creates a demo NGO, but that is an explicit, separately-invoked demo path and
# must not be run against a deployment you are showing to partners.
SEED_NGOS: list[dict] = []


def main() -> None:
    db = SessionLocal()
    try:
        users = UserRepository(db)

        admin = users.get_by_email(ADMIN_EMAIL)
        if not admin:
            admin = User(
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                full_name="Aasrah Admin",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)
            logger.info("Created admin user %s (password: %s)", ADMIN_EMAIL, ADMIN_PASSWORD)
        else:
            logger.info("Admin user already exists; skipping.")

        existing = {n.name for n in db.query(NGO).all()}
        for spec in SEED_NGOS:
            if spec["name"] not in existing:
                db.add(NGO(is_verified=True, **spec))
                logger.info("Created NGO %s", spec["name"])

        db.commit()
        logger.info("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
