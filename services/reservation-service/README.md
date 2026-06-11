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

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
