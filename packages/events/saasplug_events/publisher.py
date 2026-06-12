from datetime import UTC
from typing import Protocol

from saasplug_events.envelope import EventEnvelope
from saasplug_events.routing import routing_key_for_event


class PublisherError(Exception):
    pass


class EnvelopePublisher(Protocol):
    def publish(self, envelope: EventEnvelope) -> None:
        pass

    def close(self) -> None:
        pass


class BlockingRabbitMQPublisher:
    def __init__(self, connection, exchange_name: str) -> None:
        self.connection = connection
        self.exchange_name = exchange_name
        self.channel = connection.channel()

    def publish(self, envelope: EventEnvelope) -> None:
        routing_key = routing_key_for_event(envelope.event_type)
        try:
            self.channel.basic_publish(
                exchange=self.exchange_name,
                routing_key=routing_key,
                body=envelope.to_message_body(),
                properties=_message_properties(envelope),
                mandatory=True,
            )
        except Exception as exc:
            raise PublisherError(str(exc)) from exc

    def close(self) -> None:
        close = getattr(self.connection, "close", None)
        if callable(close):
            close()


def create_blocking_connection(rabbitmq_url: str, timeout_seconds: float):
    import pika

    parameters = pika.URLParameters(rabbitmq_url)
    parameters.socket_timeout = timeout_seconds
    parameters.blocked_connection_timeout = timeout_seconds
    parameters.connection_attempts = 1
    return pika.BlockingConnection(parameters)


def _message_properties(envelope: EventEnvelope):
    try:
        import pika
    except ImportError:
        return None

    return pika.BasicProperties(
        content_type="application/json",
        delivery_mode=2,
        type=envelope.event_type,
        message_id=str(envelope.event_id),
        correlation_id=str(envelope.correlation_id),
        timestamp=int(envelope.occurred_at.astimezone(UTC).timestamp()),
    )
