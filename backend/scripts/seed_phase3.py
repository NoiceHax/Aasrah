"""Seed Phase 3 demo data: a verified NGO with an owner, volunteers, and nearby
reports. Idempotent. Usage: python -m scripts.seed_phase3"""

from __future__ import annotations

from app.core.logging import configure_logging, get_logger
from app.core.security import hash_password
from app.db.session import SessionLocal

import app.models  # noqa: F401  (register all mappers)
from app.models.enums import (
    ReportPriority,
    ReportStatus,
    SituationType,
    UserRole,
    VolunteerAssignmentMode,
    VolunteerStatus,
)
from app.models.ngo import NGO
from app.models.report import Report
from app.models.user import User
from app.models.volunteer import Volunteer
from app.repositories.user import UserRepository
from app.services.tracking import generate_tracking_id
from app.repositories.report import ReportRepository

configure_logging()
logger = get_logger(__name__)

# Service area centered on lower Manhattan.
NGO_LAT, NGO_LON = 40.7128, -74.0060

NGO_OWNER_EMAIL = "ngo@aasrah.org"
NGO_OWNER_PW = "NgoPass123!"  # noqa: S105  dev seed only

VOLUNTEERS = [
    {"email": "vol1@aasrah.org", "name": "Aisha Bello", "skills": "First Aid, Driving", "role": "Field Responder"},
    {"email": "vol2@aasrah.org", "name": "Tom Reyes", "skills": "Medical, Triage", "role": "Medical Volunteer"},
    {"email": "vol3@aasrah.org", "name": "Lena Park", "skills": "Translation, Coordination", "role": "Dispatch Coordinator"},
]

REPORTS = [
    {"situation": SituationType.MEDICAL, "priority": ReportPriority.CRITICAL, "lat": 40.7140, "lon": -74.0050,
     "desc": "Elderly person collapsed near subway entrance, unresponsive.", "children": False},
    {"situation": SituationType.SHELTER, "priority": ReportPriority.HIGH, "lat": 40.7100, "lon": -74.0090,
     "desc": "Family with two young children displaced after building fire.", "children": True},
    {"situation": SituationType.FOOD, "priority": ReportPriority.MEDIUM, "lat": 40.7200, "lon": -74.0000,
     "desc": "Group needs food and clean water after flooding in the area.", "children": False},
]


def main() -> None:
    db = SessionLocal()
    try:
        users = UserRepository(db)

        owner = users.get_by_email(NGO_OWNER_EMAIL)
        if not owner:
            owner = User(
                email=NGO_OWNER_EMAIL, hashed_password=hash_password(NGO_OWNER_PW),
                full_name="Hope Foundation Admin", role=UserRole.NGO,
                is_active=True, is_verified=True,
            )
            db.add(owner)
            db.flush()
            logger.info("Created NGO owner %s (pw: %s)", NGO_OWNER_EMAIL, NGO_OWNER_PW)

        ngo = db.query(NGO).filter(NGO.name == "Hope Foundation").first()
        if ngo is None:
            ngo = NGO(name="Hope Foundation", focus_area="Disaster Relief", location="Metropolis, NY")
            db.add(ngo)
        ngo.owner_id = owner.id
        ngo.is_verified = True
        ngo.service_latitude = NGO_LAT
        ngo.service_longitude = NGO_LON
        ngo.service_radius_km = 25.0
        ngo.contact_email = "contact@hopefoundation.org"
        db.flush()
        logger.info("Configured NGO Hope Foundation with service area + owner")

        for spec in VOLUNTEERS:
            u = users.get_by_email(spec["email"])
            if not u:
                u = User(
                    email=spec["email"], hashed_password=hash_password("VolPass123!"),
                    full_name=spec["name"], role=UserRole.VOLUNTEER, is_active=True, is_verified=True,
                )
                db.add(u)
                db.flush()
            vol = db.query(Volunteer).filter(Volunteer.user_id == u.id).first()
            if not vol:
                db.add(Volunteer(
                    user_id=u.id, ngo_id=ngo.id, role_title=spec["role"],
                    assignment_mode=VolunteerAssignmentMode.NGO_AFFILIATED,
                    skills=spec["skills"], availability="On-call",
                    status=VolunteerStatus.ACTIVE, is_available=True, latitude=NGO_LAT, longitude=NGO_LON,
                ))
                logger.info("Created volunteer %s", spec["name"])

        repo = ReportRepository(db)
        existing_descs = {r.description for r in db.query(Report).all()}
        for spec in REPORTS:
            if spec["desc"] in existing_descs:
                continue
            db.add(Report(
                tracking_id=generate_tracking_id(repo),
                situation=spec["situation"], priority=spec["priority"],
                status=ReportStatus.PENDING, description=spec["desc"],
                address="Lower Manhattan, NY", latitude=spec["lat"], longitude=spec["lon"],
                children_present=spec["children"], people_count=2 if spec["children"] else 1,
            ))
            logger.info("Created nearby report: %s", spec["desc"][:40])

        db.commit()
        logger.info("Phase 3 seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
