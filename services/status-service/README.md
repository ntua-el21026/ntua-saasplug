# status-service

## Responsibility

`status-service` owns charging-point status lookup, the five-minute status
cache, and status logs.

## Owned database

`status-postgres`

## Exposure

Public through `nginx-gateway` under `/api/status/...`.

## Belongs here

- Status cache implementation.
- Status lookup normalization.
- Status freshness, logging, and cache-behavior tests.

## Must not be placed here

- Catalog search ownership.
- Reservation truth.
- Analytics aggregate ownership.
- Direct frontend-provider communication.

## Future implementation notes

Provider-specific statuses must normalize to the accepted internal values:
`available`, `charging`, `reserved`, `malfunction`, `offline`, and `unknown`.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
