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

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not query
`analytics-postgres`, consume RabbitMQ events, compute aggregates, or export
CSV data.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/analytics/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
