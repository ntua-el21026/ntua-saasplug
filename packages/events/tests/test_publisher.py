from datetime import UTC, datetime
from uuid import uuid4

from saasplug_events.envelope import EventEnvelope
from saasplug_events.publisher import BlockingRabbitMQPublisher
from saasplug_events.topology import DEFAULT_EVENT_EXCHANGE


class FakeChannel:
    def __init__(self) -> None:
        self.published = []

    def basic_publish(self, **kwargs) -> None:
        self.published.append(kwargs)


class FakeConnection:
    def __init__(self) -> None:
        self.channel_instance = FakeChannel()
        self.closed = False

    def channel(self) -> FakeChannel:
        return self.channel_instance

    def close(self) -> None:
        self.closed = True


def test_publisher_uses_event_type_as_routing_key_and_persistent_json_body() -> None:
    connection = FakeConnection()
    publisher = BlockingRabbitMQPublisher(connection, DEFAULT_EVENT_EXCHANGE)
    envelope = EventEnvelope(
        event_id=uuid4(),
        event_type="reservation.failed",
        event_version=1,
        occurred_at=datetime(2026, 6, 12, 12, 0, tzinfo=UTC),
        correlation_id=uuid4(),
        producer="reservation-service",
        payload={"reservation_id": "reservation-1"},
    )

    publisher.publish(envelope)

    published = connection.channel_instance.published[0]
    assert published["exchange"] == DEFAULT_EVENT_EXCHANGE
    assert published["routing_key"] == "reservation.failed"
    assert b"reservation.failed" in published["body"]
    assert published["mandatory"] is True
