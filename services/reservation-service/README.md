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
The provider reservation call remains synchronous and is never queued through
RabbitMQ. Before calling the provider, the service may create durable
idempotency, point-lock, and attempt-journal rows so duplicate requests and
ambiguous provider-success/local-failure states can be inspected. Reservation
result rows and outbox events are created or staged only after the provider
call returns.

The service implements:

- reservation truth persistence in `reservations`;
- successful, failed, and unknown reservation attempt persistence in
  `reservation_attempts`;
- request idempotency persistence in `reservation_idempotency_records`;
- short-lived point-level reservation guards in `reservation_point_locks`;
- pending staged events in `reservation_event_outbox`;
- catalog point resolution through `catalog-service` before provider calls;
- synchronous reservation calls to the relevant internal provider service;
- reservation-time snapshots for EV display: cost/kWh, charger capacity,
  estimated energy, estimated cost, estimate currency, and estimate basis;
- JWT-compatible role and provider scoping;
- safe normalized error responses that do not expose raw provider errors.

Reservation creation accepts an `Idempotency-Key` header. If the request body
also contains `idempotency_key`, it must match the header. Replaying the same
user, endpoint, request payload, and idempotency key returns the existing
result without another provider call. Reusing a key for a different request,
submitting while the same key is still in progress, or attempting to reserve a
point with an active local successful reservation returns HTTP 409.

Provider-side unavailable/reserved/missing-point failures are normalized to
HTTP 409 with a user-safe message. Provider timeouts remain HTTP 504 with an
unknown reservation/attempt state, `retry_allowed=false`, and
`reconciliation_required=true`. If the provider reports success but returns a
missing, malformed, timezone-naive, or past `reservation_ends_at`, the service
records an `unknown` non-billable reservation with no active expiry instead of
creating an indefinitely active local reservation. If the provider reports
success but local persistence fails, the pre-provider-call attempt journal is
marked `unknown` with failure metadata; the service does not perform live
compensating provider mutations.

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
- `OPERATOR` cannot create EV reservations; operators can inspect all
  reservations, attempts, pending outbox events, and trigger pending outbox
  publishing.
- `PROVIDER_ADMIN` cannot create EV-user reservations and can inspect only
  reservations/attempts for the provider in the JWT claims.

Provider-admin reservation and attempt responses are shaped to omit direct EV
identifiers, EV emails, raw requester claims, provider reservation IDs, and
other internal reservation identifiers. Operators retain richer internal
visibility for troubleshooting.

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

Confirmed-success reservation event payloads include the reservation identity,
user ID, provider code, point IDs, requested duration, provider status,
provider reservation ID, reservation end time, `price_per_kwh_eur`, charger
capacity in kW, estimated energy in kWh, estimated cost in EUR, estimate
currency, and estimate basis. Unknown reservation outcomes are not emitted as
successful billable events.

The estimate basis is `rated_power_duration_estimate`:

```text
estimated_energy_kwh = charger_capacity_kw * requested_duration_minutes / 60
estimated_cost_eur = price_per_kwh_eur * estimated_energy_kwh
```

Estimates are stored only when cost/kWh, charger power, and duration are valid.
Missing, negative, or non-finite provider cost/kWh and missing or non-positive
charger power remain `null`; the service does not treat unavailable estimate
inputs as zero.

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
  -H "Idempotency-Key: <client-generated-uuid>" \
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
SAASPLUG_STRICT_SECRETS
APP_ENV
```

`RABBITMQ_EVENT_EXCHANGE` defaults to `saasplug.events`.
When `SAASPLUG_STRICT_SECRETS=true` or `APP_ENV` is production-like, unsafe
placeholder JWT, scheduler-token, and RabbitMQ credential values are rejected
at startup.

## Tests

```bash
docker compose run --build --rm --no-deps reservation-service pytest -q
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
