# events

## Purpose

`packages/events` contains the shared RabbitMQ event contracts and helper
primitives for saasPlug.

It provides the common event envelope, routing-key constants, queue/DLQ topology
definitions, publisher helpers, consumer acknowledgement primitives, and
idempotency helpers used by backend services.

## Exchange

Business events use one topic exchange:

```text
saasplug.events
```

The exchange name defaults to `saasplug.events` and can be overridden with
`RABBITMQ_EVENT_EXCHANGE`.

## Event envelope

All events use this envelope:

```json
{
  "event_id": "uuid",
  "event_type": "reservation.succeeded",
  "event_version": 1,
  "occurred_at": "2026-06-10T15:20:00Z",
  "correlation_id": "uuid",
  "producer": "reservation-service",
  "payload": {}
}
```

`occurred_at` must be timezone-aware UTC. Consumers must treat delivery as
at-least-once and use `event_id` for idempotency.

## Routing keys

The routing key is the event type. Canonical event types include:

```text
provider.sync.requested
provider.points.snapshot_ready
catalog.points.imported
usage.search_performed
usage.point_viewed
status.point_checked
reservation.succeeded
reservation.failed
billing.charge_created
billing.invoice_issued
billing.invoice_paid
```

## Queue and DLQ topology

The reusable topology declares:

```text
analytics.events
analytics.events.dlq
billing.reservations
billing.reservations.dlq
catalog.provider_snapshots
catalog.provider_snapshots.dlq
```

Bindings:

```text
analytics.events <- usage.*
analytics.events <- status.point_checked
analytics.events <- reservation.*
analytics.events <- catalog.points.imported
analytics.events <- billing.charge_created
analytics.events <- billing.invoice.*
billing.reservations <- reservation.succeeded
billing.reservations <- reservation.failed
billing.reservations <- usage.point_viewed
catalog.provider_snapshots <- provider.points.snapshot_ready
```

DLQs are connected through a separate direct dead-letter exchange named
`saasplug.events.dlx`. This is not a business-event exchange; it is only broker
failure plumbing.

## Publisher behavior

`BlockingRabbitMQPublisher` publishes persistent JSON messages with the event
type as routing key. Services should publish only after their source-of-truth
state is committed.

Current live producers:

| Producer | Events |
|---|---|
| `catalog-service` | `usage.search_performed`, `usage.point_viewed`, `catalog.points.imported` |
| `status-service` | `status.point_checked` |
| `reservation-service` | `reservation.succeeded`, `reservation.failed` |
| `billing-service` | `billing.charge_created`, `billing.invoice_issued`, `billing.invoice_paid` |

Catalog and status usage events are best-effort propagation after the
corresponding read/import/log operation has completed. They must not make the
live user request fail if RabbitMQ is temporarily unavailable.

## Consumer behavior

`handle_delivery` parses the envelope and maps handler results to explicit
RabbitMQ acknowledgement behavior:

- `ack`: event processed successfully;
- `requeue`: transient failure, retry later;
- `reject`: non-retryable failure, route to DLQ when queue policy allows.

`billing.reservations` is the bounded billing drain queue. It receives
reservation events and `usage.point_viewed` because billing can optionally
charge point-view events.

## Idempotency

Consumers must persist processed `event_id` values in their own database before
or atomically with side effects. The in-memory helper is for tests and local
primitives only; production consumers must use service-owned persistence such as
unique constraints.

## Tests

```bash
PYTHONPATH=packages/events python -m pytest packages/events/tests -q
```

The package tests use fake channels and do not require a live RabbitMQ server.
