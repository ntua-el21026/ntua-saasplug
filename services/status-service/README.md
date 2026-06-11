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

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not query
`status-postgres`, call provider services, or implement the five-minute status
cache.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/status/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
