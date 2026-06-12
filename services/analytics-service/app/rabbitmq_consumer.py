from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import Settings
from app.ingestion import ingest_event
from saasplug_events.consumer import ConsumerAction, handle_delivery
from saasplug_events.publisher import create_blocking_connection
from saasplug_events.routing import ANALYTICS_EVENTS_QUEUE
from saasplug_events.topology import declare_topology


@dataclass
class ConsumeResult:
    requested_limit: int
    received_count: int = 0
    ack_count: int = 0
    reject_count: int = 0
    requeue_count: int = 0
    created_count: int = 0
    duplicate_count: int = 0
    unsupported_count: int = 0
    invalid_count: int = 0


def declare_rabbitmq_topology(settings: Settings) -> None:
    connection = create_blocking_connection(
        settings.rabbitmq_url,
        settings.rabbitmq_consume_timeout_seconds,
    )
    try:
        declare_topology(connection.channel(), settings.rabbitmq_event_exchange)
    finally:
        connection.close()


def consume_analytics_events(settings: Settings, db: Session, limit: int) -> ConsumeResult:
    connection = create_blocking_connection(
        settings.rabbitmq_url,
        settings.rabbitmq_consume_timeout_seconds,
    )
    try:
        channel = connection.channel()
        declare_topology(channel, settings.rabbitmq_event_exchange)
        return drain_analytics_queue(db, channel, limit)
    finally:
        connection.close()


def drain_analytics_queue(db: Session, channel, limit: int) -> ConsumeResult:
    result = ConsumeResult(requested_limit=limit)
    for _ in range(limit):
        method, properties, body = channel.basic_get(queue=ANALYTICS_EVENTS_QUEUE, auto_ack=False)
        if method is None:
            break
        result.received_count += 1
        handler_called = False

        def handler(envelope):
            nonlocal handler_called
            handler_called = True
            ingest_result = ingest_event(db, envelope)
            if ingest_result.status == "created":
                result.created_count += 1
                return ConsumerAction.ACK
            if ingest_result.status == "duplicate":
                result.duplicate_count += 1
                return ConsumerAction.ACK
            result.unsupported_count += 1
            return ConsumerAction.REJECT

        action = handle_delivery(channel, method, properties, body, handler)
        if action == ConsumerAction.ACK:
            result.ack_count += 1
        elif action == ConsumerAction.REQUEUE:
            result.requeue_count += 1
        else:
            result.reject_count += 1
            if not handler_called:
                result.invalid_count += 1
    return result
