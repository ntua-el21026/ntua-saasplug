# reservation-service

## Responsibility

`reservation-service` owns reservation truth and the synchronous reservation
flow through the relevant provider service.

## Owned database

`reservation-postgres`

## Exposure

Public through `nginx-gateway` under `/api/reservations/...`.

## Belongs here

- Reservation API implementation.
- Provider-service calls for reservation attempts.
- Reservation persistence, events, and tests.

## Must not be placed here

- Queue-first reservation provider calls.
- Billing charge truth.
- Analytics aggregate truth.
- Provider-local raw payload storage.

## Implemented behavior

Reservations must follow:
`frontend -> nginx-gateway -> reservation-service -> provider service -> external provider API`.
Only after the provider call returns should reservation records and events be
created or staged.

The service implements:

- reservation truth persistence in `reservations`;
- successful, failed, and unknown reservation attempt persistence in
  `reservation_attempts`;
- pending staged events in `reservation_event_outbox`;
- catalog point resolution through `catalog-service` before provider calls;
- synchronous reservation calls to the relevant internal provider service;
- JWT-compatible role and provider scoping;
- safe normalized error responses that do not expose raw provider errors.

RabbitMQ publishing for staged outbox rows is triggered separately from the
reservation provider-call path so user-facing reservation creation does not
depend on RabbitMQ delivery.

## Endpoints

```text
GET /
GET /health
GET /ready
POST /points/{provider_code}/{external_point_id}/reservations
GET /reservations/me
GET /reservations
GET /reservations/{reservation_id}
GET /reservations/{reservation_id}/attempts
GET /attempts
GET /events/outbox
POST /events/outbox/publish-pending
```

Access rules:

- `EV_USER` can create reservations and read their own reservations.
- `OPERATOR` can create reservations for administrative/testing workflows and
  can inspect all reservations, attempts, pending outbox events, and trigger
  pending outbox publishing.
- `PROVIDER_ADMIN` cannot create EV-user reservations and can inspect only
  reservations/attempts for the provider in the JWT claims.

## RabbitMQ outbox publishing

Reservation events are stored first in `reservation_event_outbox` with the
common event envelope fields:

```text
event_id
event_type
event_version
occurred_at
correlation_id
producer
payload
```

Operators can publish pending rows after the reservation result is already
persisted:

```bash
curl -X POST \
  "http://localhost:8080/api/reservations/events/outbox/publish-pending?limit=50" \
  -H "Authorization: Bearer <operator-access-token>"
```

On successful RabbitMQ publish, the row is marked `published` and
`published_at` is set. On failure, the row remains `pending`,
`publish_attempts` is incremented, and `last_publish_error` plus
`last_publish_attempt_at` are recorded for retry visibility.

The publisher declares the shared RabbitMQ topology before publishing. Optional
startup topology declaration is available through
`RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP=true`; startup declaration is non-fatal.

`scheduler-service` can call the internal outbox publishing endpoint over the
Docker network; live reservation creation remains synchronous and is not
queued through RabbitMQ.

Internal scheduler endpoints:

```text
POST /internal/jobs/outbox/publish-pending
GET  /internal/jobs/freshness
```

The Nginx gateway returns HTTP 404 for `/api/reservations/internal/...`; these
routes are not browser-facing APIs.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/reservations/health
```

Reservation creation through the gateway:

```bash
curl -X POST \
  http://localhost:8080/api/reservations/points/redPlug/101/reservations \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"duration_minutes":60}'
```

## Configuration

```text
DATABASE_URL
JWT_SECRET
RESERVATION_CATALOG_SERVICE_URL
RESERVATION_PROVIDER_TIMEOUT_SECONDS
RED_PROVIDER_SERVICE_URL
GREEN_PROVIDER_SERVICE_URL
BLUE_PROVIDER_SERVICE_URL
RABBITMQ_URL
RABBITMQ_EVENT_EXCHANGE
RABBITMQ_PUBLISH_TIMEOUT_SECONDS
RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP
RESERVATION_OUTBOX_PUBLISH_BATCH_SIZE
SCHEDULER_INTERNAL_TOKEN
```

`RABBITMQ_EVENT_EXCHANGE` defaults to `saasplug.events`.

## Tests

```bash
docker compose run --build --rm --no-deps reservation-service pytest -q
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
