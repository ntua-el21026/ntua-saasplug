from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.config import Settings
from saasplug_events.envelope import EventEnvelope
from saasplug_events.publisher import BlockingRabbitMQPublisher, EnvelopePublisher, create_blocking_connection
from saasplug_events.topology import declare_topology


def build_event_publisher(settings: Settings) -> BlockingRabbitMQPublisher:
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


def publish_best_effort_event(
    settings: Settings,
    *,
    event_type: str,
    payload: dict[str, Any],
    publisher: EnvelopePublisher | None = None,
) -> bool:
    if not settings.rabbitmq_event_publish_enabled:
        return False

    envelope = EventEnvelope(
        event_id=uuid4(),
        event_type=event_type,
        event_version=1,
        occurred_at=datetime.now(UTC),
        correlation_id=uuid4(),
        producer=settings.service_name,
        payload=payload,
    )
    owns_publisher = publisher is None
    active_publisher = publisher
    try:
        if active_publisher is None:
            active_publisher = build_event_publisher(settings)
        active_publisher.publish(envelope)
    except Exception:
        return False
    finally:
        if owns_publisher and active_publisher is not None:
            try:
                active_publisher.close()
            except Exception:
                pass
    return True
