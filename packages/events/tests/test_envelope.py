from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from saasplug_events.envelope import EventEnvelope


def envelope() -> EventEnvelope:
    return EventEnvelope(
        event_id=uuid4(),
        event_type="reservation.succeeded",
        event_version=1,
        occurred_at=datetime(2026, 6, 12, 12, 0, tzinfo=UTC),
        correlation_id=uuid4(),
        producer="reservation-service",
        payload={"reservation_id": "reservation-1"},
    )


def test_envelope_serializes_and_round_trips_json_body() -> None:
    original = envelope()

    parsed = EventEnvelope.from_message_body(original.to_message_body())

    assert parsed == original
    assert parsed.occurred_at.tzinfo is not None


def test_envelope_rejects_naive_occurred_at() -> None:
    with pytest.raises(ValidationError):
        EventEnvelope(
            event_id=uuid4(),
            event_type="reservation.succeeded",
            event_version=1,
            occurred_at=datetime(2026, 6, 12, 12, 0),
            correlation_id=uuid4(),
            producer="reservation-service",
            payload={},
        )
