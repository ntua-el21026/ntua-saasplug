from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import BillingSummarySnapshot, CatalogHealthSnapshot, UsageEvent
from saasplug_events.envelope import EventEnvelope
from saasplug_events.routing import EventType

IngestStatus = Literal["created", "duplicate", "unsupported"]


SUPPORTED_EVENT_TYPES = {
    EventType.USAGE_SEARCH_PERFORMED.value,
    EventType.USAGE_POINT_VIEWED.value,
    EventType.STATUS_POINT_CHECKED.value,
    EventType.RESERVATION_SUCCEEDED.value,
    EventType.RESERVATION_FAILED.value,
    EventType.CATALOG_POINTS_IMPORTED.value,
    EventType.BILLING_CHARGE_CREATED.value,
    EventType.BILLING_INVOICE_ISSUED.value,
    EventType.BILLING_INVOICE_PAID.value,
}


@dataclass(frozen=True)
class IngestResult:
    event_id: str
    event_type: str
    status: IngestStatus
    message: str | None = None


def ingest_event(db: Session, envelope: EventEnvelope) -> IngestResult:
    event_id = str(envelope.event_id)
    if envelope.event_type not in SUPPORTED_EVENT_TYPES:
        return IngestResult(
            event_id=event_id,
            event_type=envelope.event_type,
            status="unsupported",
            message=f"Unsupported event type: {envelope.event_type}",
        )

    existing = db.scalar(select(UsageEvent).where(UsageEvent.event_id == event_id))
    if existing is not None:
        return IngestResult(event_id=event_id, event_type=envelope.event_type, status="duplicate")

    event = usage_event_from_envelope(envelope)
    db.add(event)
    add_projection_snapshots(db, envelope, event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return IngestResult(event_id=event_id, event_type=envelope.event_type, status="duplicate")
    return IngestResult(event_id=event_id, event_type=envelope.event_type, status="created")


def ingest_events(db: Session, envelopes: list[EventEnvelope]) -> list[IngestResult]:
    return [ingest_event(db, envelope) for envelope in envelopes]


def usage_event_from_envelope(envelope: EventEnvelope) -> UsageEvent:
    payload = envelope.payload
    return UsageEvent(
        event_id=str(envelope.event_id),
        event_type=envelope.event_type,
        event_version=envelope.event_version,
        occurred_at=ensure_aware_utc(envelope.occurred_at),
        correlation_id=str(envelope.correlation_id),
        producer=envelope.producer,
        user_id=string_value(payload, "user_id", "userId", "actor_user_id", "actorUserId"),
        provider_code=string_value(payload, "provider_code", "providerCode"),
        internal_point_id=string_value(
            payload,
            "internal_point_id",
            "internalPointId",
            "normalized_point_id",
            "normalizedPointId",
            "point_id",
            "pointId",
        ),
        external_point_id=string_value(payload, "external_point_id", "externalPointId"),
        point_name=string_value(payload, "point_name", "pointName", "display_name", "displayName", "name"),
        reservation_id=string_value(payload, "reservation_id", "reservationId"),
        status=string_value(payload, "status", "result_status", "resultStatus", "provider_status", "providerStatus"),
        amount=float_value(
            payload,
            "amount",
            "charge_amount",
            "chargeAmount",
            "fee_amount",
            "feeAmount",
            "invoice_amount",
            "invoiceAmount",
            "total_amount",
            "totalAmount",
        ),
        currency=string_value(payload, "currency", "invoice_currency", "invoiceCurrency"),
        payload=payload,
    )


def add_projection_snapshots(db: Session, envelope: EventEnvelope, event: UsageEvent) -> None:
    if envelope.event_type == EventType.CATALOG_POINTS_IMPORTED.value:
        db.add(
            CatalogHealthSnapshot(
                event_id=event.event_id,
                provider_code=event.provider_code,
                active_count=int_value(
                    event.payload,
                    "active_count",
                    "activeCount",
                    "catalog_active_count",
                    "catalogActiveCount",
                ),
                stale_count=int_value(
                    event.payload,
                    "stale_count",
                    "staleCount",
                    "catalog_marked_stale_count",
                    "catalogMarkedStaleCount",
                ),
                imported_count=int_value(
                    event.payload,
                    "imported_count",
                    "importedCount",
                    "catalog_upserted_count",
                    "catalogUpsertedCount",
                    "provider_fetched_count",
                    "providerFetchedCount",
                ),
                latest_import_status=string_value(
                    event.payload,
                    "status",
                    "latest_import_status",
                    "latestImportStatus",
                ),
                occurred_at=event.occurred_at,
                payload=event.payload,
            ),
        )
    elif envelope.event_type in {
        EventType.BILLING_CHARGE_CREATED.value,
        EventType.BILLING_INVOICE_ISSUED.value,
        EventType.BILLING_INVOICE_PAID.value,
    }:
        amount = event.amount
        invoiced_amount = amount if envelope.event_type == EventType.BILLING_INVOICE_ISSUED.value else None
        paid_amount = amount if envelope.event_type == EventType.BILLING_INVOICE_PAID.value else None
        unpaid_amount = amount if envelope.event_type == EventType.BILLING_INVOICE_ISSUED.value else None
        db.add(
            BillingSummarySnapshot(
                event_id=event.event_id,
                provider_code=event.provider_code,
                event_type=event.event_type,
                invoice_id=string_value(event.payload, "invoice_id", "invoiceId"),
                invoiced_amount=invoiced_amount,
                paid_amount=paid_amount,
                unpaid_amount=unpaid_amount,
                currency=event.currency,
                status=string_value(event.payload, "status", "invoice_status", "invoiceStatus"),
                occurred_at=event.occurred_at,
                payload=event.payload,
            ),
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


def int_value(payload: dict[str, Any], *keys: str) -> int | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return None


def float_value(payload: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = payload.get(key)
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None
