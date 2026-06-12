from dataclasses import dataclass

from saasplug_events.routing import (
    ANALYTICS_EVENTS_DLQ,
    ANALYTICS_EVENTS_QUEUE,
    BILLING_RESERVATIONS_DLQ,
    BILLING_RESERVATIONS_QUEUE,
    CATALOG_PROVIDER_SNAPSHOTS_DLQ,
    CATALOG_PROVIDER_SNAPSHOTS_QUEUE,
    EventType,
)

DEFAULT_EVENT_EXCHANGE = "saasplug.events"
DEFAULT_DEAD_LETTER_EXCHANGE = "saasplug.events.dlx"


@dataclass(frozen=True)
class QueueBinding:
    queue: str
    routing_key: str


@dataclass(frozen=True)
class QueueDefinition:
    name: str
    dlq_name: str
    bindings: tuple[QueueBinding, ...]


QUEUE_DEFINITIONS = (
    QueueDefinition(
        name=ANALYTICS_EVENTS_QUEUE,
        dlq_name=ANALYTICS_EVENTS_DLQ,
        bindings=(
            QueueBinding(ANALYTICS_EVENTS_QUEUE, "usage.*"),
            QueueBinding(ANALYTICS_EVENTS_QUEUE, EventType.STATUS_POINT_CHECKED.value),
            QueueBinding(ANALYTICS_EVENTS_QUEUE, "reservation.*"),
            QueueBinding(ANALYTICS_EVENTS_QUEUE, EventType.CATALOG_POINTS_IMPORTED.value),
            QueueBinding(ANALYTICS_EVENTS_QUEUE, "billing.invoice.*"),
        ),
    ),
    QueueDefinition(
        name=BILLING_RESERVATIONS_QUEUE,
        dlq_name=BILLING_RESERVATIONS_DLQ,
        bindings=(
            QueueBinding(BILLING_RESERVATIONS_QUEUE, EventType.RESERVATION_SUCCEEDED.value),
            QueueBinding(BILLING_RESERVATIONS_QUEUE, EventType.RESERVATION_FAILED.value),
        ),
    ),
    QueueDefinition(
        name=CATALOG_PROVIDER_SNAPSHOTS_QUEUE,
        dlq_name=CATALOG_PROVIDER_SNAPSHOTS_DLQ,
        bindings=(
            QueueBinding(CATALOG_PROVIDER_SNAPSHOTS_QUEUE, EventType.PROVIDER_POINTS_SNAPSHOT_READY.value),
        ),
    ),
)


def declare_topology(
    channel,
    exchange_name: str = DEFAULT_EVENT_EXCHANGE,
    dead_letter_exchange: str = DEFAULT_DEAD_LETTER_EXCHANGE,
) -> None:
    channel.exchange_declare(exchange=exchange_name, exchange_type="topic", durable=True)
    channel.exchange_declare(exchange=dead_letter_exchange, exchange_type="direct", durable=True)
    for queue_definition in QUEUE_DEFINITIONS:
        channel.queue_declare(queue=queue_definition.dlq_name, durable=True)
        channel.queue_bind(
            queue=queue_definition.dlq_name,
            exchange=dead_letter_exchange,
            routing_key=queue_definition.dlq_name,
        )
        channel.queue_declare(
            queue=queue_definition.name,
            durable=True,
            arguments={
                "x-dead-letter-exchange": dead_letter_exchange,
                "x-dead-letter-routing-key": queue_definition.dlq_name,
            },
        )
        for binding in queue_definition.bindings:
            channel.queue_bind(
                queue=binding.queue,
                exchange=exchange_name,
                routing_key=binding.routing_key,
            )
