from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import BillingEventOutbox, utcnow
from saasplug_events.envelope import EventEnvelope
from saasplug_events.publisher import BlockingRabbitMQPublisher, EnvelopePublisher, create_blocking_connection
from saasplug_events.topology import declare_topology


@dataclass
class OutboxPublishResult:
    selected_count: int = 0
    published_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    published_event_ids: list[str] = field(default_factory=list)
    failed_event_ids: list[str] = field(default_factory=list)


def stage_outbox_event(
    db: Session,
    event_type: str,
    correlation_id: str,
    aggregate_id: str,
    provider_code: str,
    payload: dict[str, Any],
) -> BillingEventOutbox:
    row = BillingEventOutbox(
        event_type=event_type,
        correlation_id=correlation_id,
        aggregate_id=aggregate_id,
        provider_code=provider_code,
        payload=payload,
        publish_status="pending",
    )
    db.add(row)
    return row


def outbox_row_to_envelope(row: BillingEventOutbox) -> EventEnvelope:
    return EventEnvelope(
        event_id=row.event_id,
        event_type=row.event_type,
        event_version=row.event_version,
        occurred_at=ensure_aware_utc(row.occurred_at),
        correlation_id=row.correlation_id,
        producer=row.producer,
        payload=row.payload,
    )


def ensure_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def declare_rabbitmq_topology(settings: Settings) -> None:
    connection = create_blocking_connection(
        settings.rabbitmq_url,
        settings.rabbitmq_publish_timeout_seconds,
    )
    try:
        declare_topology(connection.channel(), settings.rabbitmq_event_exchange)
    finally:
        connection.close()


def build_billing_publisher(settings: Settings) -> BlockingRabbitMQPublisher:
    connection = create_blocking_connection(
        settings.rabbitmq_url,
        settings.rabbitmq_publish_timeout_seconds,
    )
    try:
        declare_topology(connection.channel(), settings.rabbitmq_event_exchange)
    except Exception:
        connection.close()
        raise
    return BlockingRabbitMQPublisher(connection, settings.rabbitmq_event_exchange)


def publish_pending_outbox(
    db: Session,
    publisher: EnvelopePublisher,
    limit: int,
) -> OutboxPublishResult:
    rows = db.scalars(
        select(BillingEventOutbox)
        .where(BillingEventOutbox.publish_status == "pending")
        .order_by(BillingEventOutbox.created_at.asc())
        .limit(limit),
    ).all()
    result = OutboxPublishResult(selected_count=len(rows))
    for row in rows:
        if row.publish_status != "pending":
            result.skipped_count += 1
            continue
        row.publish_attempts += 1
        row.last_publish_attempt_at = utcnow()
        try:
            publisher.publish(outbox_row_to_envelope(row))
        except Exception as exc:
            row.last_publish_error = str(exc)[:1000]
            result.failed_count += 1
            result.failed_event_ids.append(row.event_id)
        else:
            row.publish_status = "published"
            row.published_at = utcnow()
            row.last_publish_error = None
            result.published_count += 1
            result.published_event_ids.append(row.event_id)
    db.commit()
    return result
