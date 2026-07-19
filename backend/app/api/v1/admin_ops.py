"""Admin operations: monitoring, insights, version history, automation rules."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.observability import metrics
from app.db.session import get_db
from app.models.automation import AutomationRule
from app.models.enums import AutomationTrigger, UserRole
from app.schemas.auth import MessageResponse
from app.services import insights, versioning
from app.services.jobs import runner

router = APIRouter(
    prefix="/admin", tags=["admin:ops"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


@router.get("/monitoring")
def monitoring() -> dict:
    """Internal monitoring dashboard data: request metrics + job runner stats."""
    return {"metrics": metrics.snapshot(), "jobs": runner.stats()}


@router.get("/insights")
def platform_insights(db: Session = Depends(get_db)) -> dict:
    return insights.platform_insights(db)


@router.get("/insights/ngo-comparison")
def ngo_comparison(db: Session = Depends(get_db)) -> dict:
    return {"ngos": insights.ngo_comparison(db)}


@router.get("/versions/{entity_type}/{entity_id}")
def entity_history(entity_type: str, entity_id: str, db: Session = Depends(get_db)) -> dict:
    versions = versioning.history(db, entity_type, entity_id)
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "versions": [
            {
                "version": v.version, "change_kind": v.change_kind,
                "actor_id": str(v.actor_id) if v.actor_id else None,
                "snapshot": v.snapshot, "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ],
    }


# --- Automation rules ---

class AutomationRuleIn(BaseModel):
    name: str
    trigger: AutomationTrigger
    enabled: bool = True
    threshold_minutes: int = 30
    config: dict | None = None


class AutomationRuleOut(BaseModel):
    id: uuid.UUID
    name: str
    trigger: AutomationTrigger
    enabled: bool
    threshold_minutes: int
    run_count: int

    class Config:
        from_attributes = True


@router.get("/automation-rules", response_model=list[AutomationRuleOut])
def list_rules(db: Session = Depends(get_db)) -> list[AutomationRuleOut]:
    rows = db.scalars(select(AutomationRule).order_by(AutomationRule.created_at.desc())).all()
    return [AutomationRuleOut.model_validate(r) for r in rows]


@router.post("/automation-rules", response_model=AutomationRuleOut, status_code=201)
def create_rule(body: AutomationRuleIn, db: Session = Depends(get_db)) -> AutomationRuleOut:
    rule = AutomationRule(
        name=body.name, trigger=body.trigger, enabled=body.enabled,
        threshold_minutes=body.threshold_minutes, config=body.config,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return AutomationRuleOut.model_validate(rule)


@router.patch("/automation-rules/{rule_id}", response_model=AutomationRuleOut)
def toggle_rule(rule_id: uuid.UUID, enabled: bool, db: Session = Depends(get_db)) -> AutomationRuleOut:
    rule = db.get(AutomationRule, rule_id)
    if not rule:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Rule not found")
    rule.enabled = enabled
    db.commit()
    db.refresh(rule)
    return AutomationRuleOut.model_validate(rule)


@router.post("/automation-rules/run", response_model=MessageResponse)
def run_now() -> MessageResponse:
    """Trigger due automation rules immediately (also runs on the scheduler)."""
    from app.services.automation import run_due_rules
    runner.enqueue("automation.run_due_rules", run_due_rules)
    return MessageResponse(message="Automation run enqueued")
