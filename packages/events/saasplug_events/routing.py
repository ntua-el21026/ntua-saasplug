from enum import StrEnum


class EventType(StrEnum):
    PROVIDER_SYNC_REQUESTED = "provider.sync.requested"
    PROVIDER_POINTS_SNAPSHOT_READY = "provider.points.snapshot_ready"
    CATALOG_POINTS_IMPORTED = "catalog.points.imported"
    USAGE_SEARCH_PERFORMED = "usage.search_performed"
    USAGE_POINT_VIEWED = "usage.point_viewed"
    STATUS_POINT_CHECKED = "status.point_checked"
    RESERVATION_SUCCEEDED = "reservation.succeeded"
    RESERVATION_FAILED = "reservation.failed"
    BILLING_CHARGE_CREATED = "billing.charge_created"
    BILLING_INVOICE_ISSUED = "billing.invoice_issued"
    BILLING_INVOICE_PAID = "billing.invoice_paid"


ALL_EVENT_TYPES = tuple(event_type.value for event_type in EventType)

EVENT_TYPE_TO_ROUTING_KEY = {event_type.value: event_type.value for event_type in EventType}

ANALYTICS_EVENTS_QUEUE = "analytics.events"
ANALYTICS_EVENTS_DLQ = "analytics.events.dlq"
BILLING_RESERVATIONS_QUEUE = "billing.reservations"
BILLING_RESERVATIONS_DLQ = "billing.reservations.dlq"
CATALOG_PROVIDER_SNAPSHOTS_QUEUE = "catalog.provider_snapshots"
CATALOG_PROVIDER_SNAPSHOTS_DLQ = "catalog.provider_snapshots.dlq"


def routing_key_for_event(event_type: str) -> str:
    try:
        return EVENT_TYPE_TO_ROUTING_KEY[event_type]
    except KeyError as exc:
        raise ValueError(f"Unsupported event type: {event_type}") from exc
