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

Prompt 08 implements:

- reservation truth persistence in `reservations`;
- successful, failed, and unknown reservation attempt persistence in
  `reservation_attempts`;
- pending staged events in `reservation_event_outbox`;
- catalog point resolution through `catalog-service` before provider calls;
- synchronous reservation calls to the relevant internal provider service;
- JWT-compatible role and provider scoping;
- safe normalized error responses that do not expose raw provider errors.

The event outbox is staged data only. Prompt 08 does not publish to RabbitMQ.

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
```

Access rules:

- `EV_USER` can create reservations and read their own reservations.
- `OPERATOR` can create reservations for administrative/testing workflows and
  can inspect all reservations, attempts, and pending outbox events.
- `PROVIDER_ADMIN` cannot create EV-user reservations and can inspect only
  reservations/attempts for the provider in the JWT claims.

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
```

`RABBITMQ_URL` is present for stack consistency. Prompt 08 does not publish
reservation events to RabbitMQ.

## Tests

```bash
docker compose run --build --rm --no-deps reservation-service pytest -q
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
