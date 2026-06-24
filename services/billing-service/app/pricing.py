from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import PROVIDER_CODES, Settings
from app.models import PricingRule
from app.schemas import PricingRuleCreate, PricingRulePatch, PricingRuleResponse


def validate_provider_code(provider_code: str) -> None:
    if provider_code not in PROVIDER_CODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_type": "unsupported_provider",
                "message": f"Unsupported provider code: {provider_code}",
            },
        )


def seed_default_pricing(db: Session, settings: Settings) -> PricingRule:
    existing = db.scalar(
        select(PricingRule)
        .where(PricingRule.provider_code.is_(None), PricingRule.active.is_(True))
        .order_by(PricingRule.created_at.desc()),
    )
    if existing is not None:
        return existing

    rule = PricingRule(
        provider_code=None,
        name="Global default pricing",
        active=True,
        currency=settings.default_currency,
        reservation_success_fee=settings.default_reservation_success_fee,
        point_view_fee=settings.default_point_view_fee,
        point_view_fee_enabled=settings.default_point_view_fee_enabled,
        reservation_failure_fee=settings.default_reservation_failure_fee,
        created_by_email="system",
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def create_pricing_rule(
    db: Session,
    body: PricingRuleCreate,
    created_by_email: str,
) -> PricingRule:
    if body.provider_code:
        validate_provider_code(body.provider_code)
    if body.active:
        deactivate_conflicting_rules(db, body.provider_code)
    rule = PricingRule(
        provider_code=body.provider_code,
        name=body.name,
        active=body.active,
        currency=body.currency,
        reservation_success_fee=body.reservation_success_fee,
        point_view_fee=body.point_view_fee,
        point_view_fee_enabled=body.point_view_fee_enabled,
        reservation_failure_fee=body.reservation_failure_fee,
        created_by_email=created_by_email,
    )
    db.add(rule)
    db.flush()
    if rule.active and rule.provider_code is not None:
        deactivate_global_rules_if_every_provider_has_specific_rule(db)
    db.commit()
    db.refresh(rule)
    return rule


def update_pricing_rule(db: Session, rule: PricingRule, body: PricingRulePatch) -> PricingRule:
    if body.active is True:
        deactivate_conflicting_rules(db, rule.provider_code, excluding_rule_id=rule.id)

    for field_name in body.model_fields_set:
        value = getattr(body, field_name)
        if value is not None:
            setattr(rule, field_name, value)
    db.flush()
    if rule.active and rule.provider_code is not None:
        deactivate_global_rules_if_every_provider_has_specific_rule(db)
    db.commit()
    db.refresh(rule)
    return rule


def deactivate_conflicting_rules(
    db: Session,
    provider_code: str | None,
    excluding_rule_id: str | None = None,
) -> None:
    if provider_code is None:
        deactivate_all_active_rules(db, excluding_rule_id=excluding_rule_id)
    else:
        deactivate_active_rules_for_scope(db, provider_code, excluding_rule_id=excluding_rule_id)


def deactivate_all_active_rules(db: Session, excluding_rule_id: str | None = None) -> None:
    query = select(PricingRule).where(PricingRule.active.is_(True))
    if excluding_rule_id:
        query = query.where(PricingRule.id != excluding_rule_id)
    for rule in db.scalars(query).all():
        rule.active = False


def deactivate_active_rules_for_scope(
    db: Session,
    provider_code: str | None,
    excluding_rule_id: str | None = None,
) -> None:
    query = select(PricingRule).where(PricingRule.active.is_(True))
    if provider_code is None:
        query = query.where(PricingRule.provider_code.is_(None))
    else:
        query = query.where(PricingRule.provider_code == provider_code)
    if excluding_rule_id:
        query = query.where(PricingRule.id != excluding_rule_id)
    for rule in db.scalars(query).all():
        rule.active = False


def deactivate_global_rules_if_every_provider_has_specific_rule(db: Session) -> None:
    active_provider_codes = set(
        db.scalars(
            select(PricingRule.provider_code).where(
                PricingRule.active.is_(True),
                PricingRule.provider_code.is_not(None),
            ),
        ).all(),
    )
    if set(PROVIDER_CODES).issubset(active_provider_codes):
        deactivate_active_rules_for_scope(db, None)


def get_effective_pricing_rule(db: Session, provider_code: str, settings: Settings | None = None) -> PricingRule:
    validate_provider_code(provider_code)
    provider_rule = db.scalar(
        select(PricingRule)
        .where(PricingRule.provider_code == provider_code, PricingRule.active.is_(True))
        .order_by(PricingRule.updated_at.desc()),
    )
    if provider_rule is not None:
        return provider_rule

    global_rule = db.scalar(
        select(PricingRule)
        .where(PricingRule.provider_code.is_(None), PricingRule.active.is_(True))
        .order_by(PricingRule.updated_at.desc()),
    )
    if global_rule is not None:
        return global_rule

    if settings is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_type": "pricing_not_configured", "message": "No active pricing rule is configured"},
        )
    return seed_default_pricing(db, settings)


def pricing_rule_snapshot(rule: PricingRule) -> dict:
    return {
        "pricing_rule_id": rule.id,
        "provider_code": rule.provider_code,
        "name": rule.name,
        "currency": rule.currency,
        "reservation_success_fee": money_string(rule.reservation_success_fee),
        "point_view_fee": money_string(rule.point_view_fee),
        "point_view_fee_enabled": rule.point_view_fee_enabled,
        "reservation_failure_fee": money_string(rule.reservation_failure_fee),
    }


def pricing_rule_response(rule: PricingRule) -> PricingRuleResponse:
    return PricingRuleResponse(
        id=rule.id,
        provider_code=rule.provider_code,
        name=rule.name,
        active=rule.active,
        currency=rule.currency,
        reservation_success_fee=Decimal(str(rule.reservation_success_fee)),
        point_view_fee=Decimal(str(rule.point_view_fee)),
        point_view_fee_enabled=rule.point_view_fee_enabled,
        reservation_failure_fee=Decimal(str(rule.reservation_failure_fee)),
        created_by_email=rule.created_by_email,
        created_at=rule.created_at.isoformat(),
        updated_at=rule.updated_at.isoformat(),
    )


def money_string(value) -> str:
    return f"{Decimal(str(value)):.2f}"
