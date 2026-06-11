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

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
