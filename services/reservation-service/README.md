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

## Future implementation notes

Reservations must follow:
`frontend -> nginx-gateway -> reservation-service -> provider service -> external provider API`.
Only after the provider call returns should reservation records and events be
created.

Application logic is not implemented in this scaffold.

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not query
`reservation-postgres`, call provider services, store reservations, or publish
reservation events.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/reservations/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
