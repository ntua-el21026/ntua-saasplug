from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import PROVIDER_CODES, Settings
from app.event_publisher import stage_outbox_event
from app.models import BillingEvent, ChargeRecord
from app.pricing import get_effective_pricing_rule, money_string, pricing_rule_snapshot
from saasplug_events.envelope import EventEnvelope
from saasplug_events.routing import EventType

IngestStatus = Literal["charged", "skipped", "duplicate", "unsupported", "failed"]

SUPPORTED_EVENT_TYPES = {
    EventType.RESERVATION_SUCCEEDED.value,
    EventType.RESERVATION_FAILED.value,
    EventType.USAGE_POINT_VIEWED.value,
}


@dataclass(frozen=True)
class BillingIngestResult:
    event_id: str
    event_type: str
    status: IngestStatus
    charge_id: str | None = None
    message: str | None = None


@dataclass(frozen=True)
class ChargeSpec:
    charge_type: str
    amount: Decimal
    skip_message: str | None = None


def ingest_event(db: Session, envelope: EventEnvelope, settings: Settings) -> BillingIngestResult:
    event_id = str(envelope.event_id)
    existing = db.scalar(select(BillingEvent).where(BillingEvent.event_id == event_id))
    if existing is not None:
        return BillingIngestResult(
            event_id=event_id,
            event_type=envelope.event_type,
            status="duplicate",
            message="Event already ingested",
        )

    provider_code = string_value(envelope.payload, "provider_code", "providerCode")
    billing_event = base_billing_event(envelope, provider_code)

    if envelope.event_type not in SUPPORTED_EVENT_TYPES:
        billing_event.result = "unsupported"
        billing_event.error_message = f"Unsupported event type: {envelope.event_type}"
        db.add(billing_event)
        db.commit()
        return BillingIngestResult(
            event_id=event_id,
            event_type=envelope.event_type,
            status="unsupported",
            message=billing_event.error_message,
        )

    if provider_code not in PROVIDER_CODES:
        billing_event.result = "failed"
        billing_event.error_message = "Missing or unsupported provider_code"
        db.add(billing_event)
        db.commit()
        return BillingIngestResult(
            event_id=event_id,
            event_type=envelope.event_type,
            status="failed",
            message=billing_event.error_message,
        )

    rule = get_effective_pricing_rule(db, provider_code, settings)
    spec = charge_spec_for_event(envelope.event_type, rule)
    if spec.skip_message is not None:
        billing_event.result = "skipped"
        db.add(billing_event)
        db.commit()
        return BillingIngestResult(
            event_id=event_id,
            event_type=envelope.event_type,
            status="skipped",
            message=spec.skip_message,
        )

    charge = ChargeRecord(
        source_event_id=event_id,
        provider_code=provider_code,
        event_type=envelope.event_type,
        charge_type=spec.charge_type,
        amount=spec.amount,
        currency=rule.currency,
        status="unbilled",
        reservation_id=string_value(envelope.payload, "reservation_id", "reservationId"),
        internal_point_id=string_value(
            envelope.payload,
            "internal_point_id",
            "internalPointId",
            "normalized_point_id",
            "normalizedPointId",
            "point_id",
            "pointId",
        ),
        external_point_id=string_value(envelope.payload, "external_point_id", "externalPointId"),
        user_id=string_value(envelope.payload, "user_id", "userId", "actor_user_id", "actorUserId"),
        occurred_at=ensure_aware_utc(envelope.occurred_at),
        pricing_rule_id=rule.id,
        pricing_rule_snapshot=pricing_rule_snapshot(rule),
        raw_event_payload=envelope.payload,
    )
    billing_event.result = "charged"
    db.add(billing_event)
    db.add(charge)
    try:
        db.flush()
        stage_charge_created_event(db, charge, envelope)
        db.commit()
    except IntegrityError:
        db.rollback()
        return BillingIngestResult(
            event_id=event_id,
            event_type=envelope.event_type,
            status="duplicate",
            message="Event already ingested",
        )
    db.refresh(charge)
    return BillingIngestResult(
        event_id=event_id,
        event_type=envelope.event_type,
        status="charged",
        charge_id=charge.id,
    )


def base_billing_event(envelope: EventEnvelope, provider_code: str | None) -> BillingEvent:
    return BillingEvent(
        event_id=str(envelope.event_id),
        event_type=envelope.event_type,
        event_version=envelope.event_version,
        producer=envelope.producer,
        correlation_id=str(envelope.correlation_id),
        occurred_at=ensure_aware_utc(envelope.occurred_at),
        provider_code=provider_code,
        reservation_id=string_value(envelope.payload, "reservation_id", "reservationId"),
        internal_point_id=string_value(
            envelope.payload,
            "internal_point_id",
            "internalPointId",
            "normalized_point_id",
            "normalizedPointId",
            "point_id",
            "pointId",
        ),
        external_point_id=string_value(envelope.payload, "external_point_id", "externalPointId"),
        result="failed",
        payload=envelope.payload,
    )


def charge_spec_for_event(event_type: str, rule) -> ChargeSpec:
    if event_type == EventType.RESERVATION_SUCCEEDED.value:
        return ChargeSpec("reservation_success", Decimal(str(rule.reservation_success_fee)))
    if event_type == EventType.USAGE_POINT_VIEWED.value:
        if not rule.point_view_fee_enabled:
            return ChargeSpec("point_view", Decimal("0.00"), "Point-view fee is disabled")
        return ChargeSpec("point_view", Decimal(str(rule.point_view_fee)))
    if event_type == EventType.RESERVATION_FAILED.value:
        amount = Decimal(str(rule.reservation_failure_fee))
        if amount <= Decimal("0.00"):
            return ChargeSpec("reservation_failure", amount, "Reservation failures are not charged")
        return ChargeSpec("reservation_failure", amount)
    return ChargeSpec("unsupported", Decimal("0.00"), "Unsupported event type")


def stage_charge_created_event(db: Session, charge: ChargeRecord, source: EventEnvelope) -> None:
    payload = {
        "charge_id": charge.id,
        "source_event_id": charge.source_event_id,
        "provider_code": charge.provider_code,
        "event_type": charge.event_type,
        "charge_type": charge.charge_type,
        "amount": money_string(charge.amount),
        "currency": charge.currency,
        "status": charge.status,
        "reservation_id": charge.reservation_id,
        "internal_point_id": charge.internal_point_id,
        "external_point_id": charge.external_point_id,
        "user_id": charge.user_id,
    }
    stage_outbox_event(
        db,
        EventType.BILLING_CHARGE_CREATED.value,
        str(source.correlation_id),
        charge.id,
        charge.provider_code,
        payload,
    )


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def string_value(payload: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        if isinstance(value, (int, float, bool)):
            return str(value)
    return None
