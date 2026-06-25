# reservation-service

## Purpose

Owns EV reservation creation, reservation truth, provider mutation attempts,
idempotency records, point locks, and reservation event outbox state.

## Runtime

- Compose service: `reservation-service`
- Container port: `8000`
- Database: `reservation-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/reservations/*`

## Responsibilities

- Create EV reservations with idempotency-key support.
- Resolve the catalog point before provider mutation.
- Use per-point locks and local conflict checks.
- Call the provider adapter reservation endpoint.
- Store reservation attempts and unknown/reconciliation outcomes.
- Seed reserved status into `status-service` after success.
- Stage reservation domain events in `reservation_event_outbox`.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| EV | `POST /points/{provider_code}/{external_point_id}/reservations` | Create reservation |
| EV | `GET /reservations/me` | Current user's reservations |
| Operator/provider admin | `GET /reservations` | Admin reservation list |
| Operator/provider admin | `GET /reservations/{reservation_id}` | Reservation detail |
| Operator/provider admin | `GET /reservations/{reservation_id}/attempts` | Attempts for one reservation |
| Operator/provider admin | `GET /attempts` | Attempt list |
| Operator | `GET /events/outbox` | Outbox rows |
| Operator | `POST /events/outbox/publish-pending` | Publish pending outbox rows |
| Internal scheduler | `POST /internal/jobs/outbox/publish-pending` | Scheduled outbox publish |
| Internal scheduler | `GET /internal/jobs/freshness` | Internal freshness read |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `reservations` | Reservation truth and estimate snapshots |
| `reservation_attempts` | Provider-call attempts and outcomes |
| `reservation_idempotency_records` | Idempotency keys and stored responses |
| `reservation_point_locks` | Provider point lock rows |
| `reservation_event_outbox` | Pending/published reservation events |

## Messaging

| Direction | Event/routing key/queue | Purpose |
|---|---|---|
| Outbox publish | `reservation.succeeded` | Successful reservation event |
| Outbox publish | `reservation.failed` | Failed reservation event |

The synchronous create request stages outbox rows; scheduler/operator drains
publish them to RabbitMQ.

## Dependencies

- Calls: `catalog-service`, provider adapters, `status-service`, RabbitMQ during
  outbox publishing.
- Called by: frontend through gateway, `scheduler-service`.
- External systems: provider APIs only through provider adapters.

## Tests

```bash
docker compose run --build --rm --no-deps reservation-service pytest -q
```
