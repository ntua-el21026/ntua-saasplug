from saasplug_events.routing import (
    ANALYTICS_EVENTS_DLQ,
    ANALYTICS_EVENTS_QUEUE,
    BILLING_RESERVATIONS_DLQ,
    BILLING_RESERVATIONS_QUEUE,
    CATALOG_PROVIDER_SNAPSHOTS_DLQ,
    CATALOG_PROVIDER_SNAPSHOTS_QUEUE,
)
from saasplug_events.topology import DEFAULT_EVENT_EXCHANGE, declare_topology


class FakeChannel:
    def __init__(self) -> None:
        self.exchange_declarations = []
        self.queue_declarations = []
        self.bindings = []

    def exchange_declare(self, **kwargs) -> None:
        self.exchange_declarations.append(kwargs)

    def queue_declare(self, **kwargs) -> None:
        self.queue_declarations.append(kwargs)

    def queue_bind(self, **kwargs) -> None:
        self.bindings.append(kwargs)


def test_declare_topology_declares_exchange_queues_dlqs_and_bindings() -> None:
    channel = FakeChannel()

    declare_topology(channel)

    assert {"exchange": DEFAULT_EVENT_EXCHANGE, "exchange_type": "topic", "durable": True} in channel.exchange_declarations
    declared_queues = {declaration["queue"] for declaration in channel.queue_declarations}
    assert {
        ANALYTICS_EVENTS_QUEUE,
        ANALYTICS_EVENTS_DLQ,
        BILLING_RESERVATIONS_QUEUE,
        BILLING_RESERVATIONS_DLQ,
        CATALOG_PROVIDER_SNAPSHOTS_QUEUE,
        CATALOG_PROVIDER_SNAPSHOTS_DLQ,
    }.issubset(declared_queues)
    primary_queue_declarations = [
        declaration for declaration in channel.queue_declarations if declaration["queue"] == BILLING_RESERVATIONS_QUEUE
    ]
    assert primary_queue_declarations[0]["arguments"]["x-dead-letter-routing-key"] == BILLING_RESERVATIONS_DLQ
    assert {
        "queue": BILLING_RESERVATIONS_QUEUE,
        "exchange": DEFAULT_EVENT_EXCHANGE,
        "routing_key": "reservation.succeeded",
    } in channel.bindings
    assert {
        "queue": ANALYTICS_EVENTS_QUEUE,
        "exchange": DEFAULT_EVENT_EXCHANGE,
        "routing_key": "reservation.*",
    } in channel.bindings
    assert {
        "queue": ANALYTICS_EVENTS_QUEUE,
        "exchange": DEFAULT_EVENT_EXCHANGE,
        "routing_key": "billing.charge_created",
    } in channel.bindings
