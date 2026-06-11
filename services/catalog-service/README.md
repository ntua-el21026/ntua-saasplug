# catalog-service

## Responsibility

`catalog-service` owns the aggregated normalized charging-point catalog used by
search, map, and point details flows.

## Owned database

`catalog-postgres`

## Exposure

Public through `nginx-gateway` under `/api/catalog/...`.

## Belongs here

- Aggregated catalog API implementation.
- Catalog projections imported from provider snapshots.
- Bounds-based search and point-detail tests and migrations.

## Must not be placed here

- Provider-specific raw API calls in the normal user search path.
- Reservation truth.
- Status cache ownership.
- Cross-service SQL joins.

## Future implementation notes

Map search must use viewport/bounds-based loading, for example
`GET /api/catalog/points?minLat=...&maxLat=...&minLng=...&maxLng=...&zoom=...`.

Application logic is not implemented in this scaffold.

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not query
`catalog-postgres`, import provider snapshots, implement bounds search, or
publish catalog events.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/catalog/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
