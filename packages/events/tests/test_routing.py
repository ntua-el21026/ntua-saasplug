import pytest

from saasplug_events.routing import ALL_EVENT_TYPES, EventType, routing_key_for_event


def test_event_type_is_routing_key() -> None:
    for event_type in ALL_EVENT_TYPES:
        assert routing_key_for_event(event_type) == event_type


def test_required_event_types_are_present() -> None:
    assert EventType.RESERVATION_SUCCEEDED.value == "reservation.succeeded"
    assert EventType.RESERVATION_FAILED.value == "reservation.failed"
    assert EventType.BILLING_INVOICE_PAID.value == "billing.invoice_paid"


def test_unknown_event_type_is_rejected() -> None:
    with pytest.raises(ValueError):
        routing_key_for_event("unknown.event")
