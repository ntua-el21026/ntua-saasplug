from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from saasplug_events.consumer import ConsumerAction, handle_delivery
from saasplug_events.envelope import EventEnvelope


class FakeChannel:
    def __init__(self) -> None:
        self.acks = []
        self.nacks = []

    def basic_ack(self, **kwargs) -> None:
        self.acks.append(kwargs)

    def basic_nack(self, **kwargs) -> None:
        self.nacks.append(kwargs)


def envelope_body() -> bytes:
    return EventEnvelope(
        event_id=uuid4(),
        event_type="reservation.succeeded",
        event_version=1,
        occurred_at=datetime(2026, 6, 12, 12, 0, tzinfo=UTC),
        correlation_id=uuid4(),
        producer="reservation-service",
        payload={},
    ).to_message_body()


def test_handle_delivery_acks_successful_handler() -> None:
    channel = FakeChannel()
    method = SimpleNamespace(delivery_tag="delivery-1")

    action = handle_delivery(channel, method, None, envelope_body(), lambda _: ConsumerAction.ACK)

    assert action == ConsumerAction.ACK
    assert channel.acks == [{"delivery_tag": "delivery-1"}]
    assert channel.nacks == []


def test_handle_delivery_rejects_invalid_envelope_without_requeue() -> None:
    channel = FakeChannel()
    method = SimpleNamespace(delivery_tag="delivery-1")

    action = handle_delivery(channel, method, None, b"not-json", lambda _: ConsumerAction.ACK)

    assert action == ConsumerAction.REJECT
    assert channel.nacks == [{"delivery_tag": "delivery-1", "requeue": False}]
