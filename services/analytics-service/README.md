# analytics-service

## Responsibility

`analytics-service` owns raw usage events, hourly and daily aggregates,
provider analytics, operator analytics, CSV exports, and dashboard freshness
indicators.

## Owned database

`analytics-postgres`

## Exposure

Public through `nginx-gateway` under `/api/analytics/...` for authorized
provider-admin and operator dashboard routes.

## Belongs here

- Event consumption for analytics projections.
- Precomputed aggregate tables and exports.
- Analytics idempotency and dashboard tests.

## Must not be placed here

- Calls to provider APIs.
- Live cross-service joins for dashboards.
- Billing invoice truth.
- Reservation truth.

## Future implementation notes

Dashboards must read precomputed aggregate/cache tables and remain useful when
`reservation-service` is unavailable.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
