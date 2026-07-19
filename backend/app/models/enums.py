"""Enumerations shared across models and schemas."""

import enum


class UserRole(str, enum.Enum):
    CITIZEN = "citizen"
    NGO = "ngo"
    VOLUNTEER = "volunteer"
    ADMIN = "admin"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    CLAIMED = "claimed"
    # Phase 3 rescue lifecycle
    VOLUNTEER_ASSIGNED = "volunteer_assigned"
    VOLUNTEER_ACCEPTED = "volunteer_accepted"
    ON_ROUTE = "on_route"
    REACHED_LOCATION = "reached_location"
    RESCUE_COMPLETED = "rescue_completed"
    SHELTER_ASSIGNED = "shelter_assigned"
    CLOSED = "closed"
    # Retained from Phase 2
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ReportPriority(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    STABLE = "stable"


class SituationType(str, enum.Enum):
    MEDICAL = "medical"
    SHELTER = "shelter"
    FOOD = "food"
    SAFETY = "safety"
    OTHER = "other"


class NotificationType(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class VolunteerStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"


class VolunteerAssignmentMode(str, enum.Enum):
    """How a volunteer chooses to receive rescue assignments.

    INDEPENDENT: available to any nearby verified NGO.
    NGO_AFFILIATED: primarily receives assignments from a preferred NGO
                     (the volunteer's ``ngo_id``); can leave that NGO later.
    """

    INDEPENDENT = "independent"
    NGO_AFFILIATED = "ngo_affiliated"


class AssignmentStatus(str, enum.Enum):
    """A volunteer's response to a case assignment."""

    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    ON_ROUTE = "on_route"
    ARRIVED = "arrived"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REMOVED = "removed"


class AnnouncementAudience(str, enum.Enum):
    """Who an admin announcement is broadcast to."""

    EVERYONE = "everyone"
    NGO = "ngo"
    VOLUNTEER = "volunteer"


class AutomationTrigger(str, enum.Enum):
    """Configurable automation rule triggers (run by the scheduler)."""

    ESCALATE_UNCLAIMED = "escalate_unclaimed"
    EXPAND_RADIUS = "expand_radius"
    VOLUNTEER_REMINDER = "volunteer_reminder"
    CLOSE_INACTIVE = "close_inactive"
    ARCHIVE_COMPLETED = "archive_completed"
    WEEKLY_SUMMARY = "weekly_summary"
