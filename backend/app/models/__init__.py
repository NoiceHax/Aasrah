"""ORM models. Importing this package registers every model on the Base metadata."""

from app.models.announcement import Announcement
from app.models.audit_log import AuditLog
from app.models.automation import AutomationRule
from app.models.case_attachment import CaseAttachment
from app.models.case_timeline import CaseTimelineEvent
from app.models.entity_version import EntityVersion
from app.models.enums import (
    AnnouncementAudience,
    AssignmentStatus,
    AutomationTrigger,
    NotificationType,
    ReportPriority,
    ReportStatus,
    SituationType,
    UserRole,
    VolunteerStatus,
)
from app.models.internal_note import InternalNote
from app.models.ngo import NGO
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.models.report import Report
from app.models.report_image import ReportImage
from app.models.session import Session as AuthSession
from app.models.user import User
from app.models.volunteer import Volunteer
from app.models.volunteer_assignment import VolunteerAssignment

__all__ = [
    "Announcement",
    "AnnouncementAudience",
    "AuditLog",
    "AutomationRule",
    "AutomationTrigger",
    "CaseAttachment",
    "CaseTimelineEvent",
    "EntityVersion",
    "PushSubscription",
    "InternalNote",
    "NGO",
    "Notification",
    "Report",
    "ReportImage",
    "AuthSession",
    "User",
    "Volunteer",
    "VolunteerAssignment",
    "UserRole",
    "ReportStatus",
    "ReportPriority",
    "SituationType",
    "NotificationType",
    "VolunteerStatus",
    "AssignmentStatus",
]
