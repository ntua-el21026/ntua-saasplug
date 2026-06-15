# Codex Run 031 - Catalog API Circle Filtering

## Invocation Prompt

```text
Να μην το βλέπουμε, αλλά δεν πρέπει να το καλούμε, δηλαδή να μην επιστρέφει άλλα δεδομένα παραμόνο μέσα στον κύκλο!
```

## Canonical Task Prompt

N/A. This was a direct corrective clarification.

## Goal

Ensure `/api/catalog/points` does not return rows outside the requested circle when the frontend passes `centerLat`, `centerLng`, and `radiusKm`.

## Scope Restatement

Targeted `catalog-service` API filtering and tests, plus required AI run documentation. No database migration, provider adapter, Docker topology, or frontend route contract change was made in this run.

## Implementation Summary

- Replaced radius-as-SQL-approximation with a two-step radius query:
  - SQL bounding-box prefilter for performance.
  - Exact Haversine distance filtering in service code before `total`, `offset`, and `limit`.
- Preserved the existing query contract: `minLat`, `maxLat`, `minLng`, `maxLng`, `centerLat`, `centerLng`, `radiusKm`, `limit`, and `offset`.
- Added a regression test that inserts a point inside the bounding-box prefilter but outside the circle and verifies that the API response excludes it.
- Updated `catalog-service` README to document exact API-side circle filtering.

## Files Changed

- `services/catalog-service/app/routes.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `services/catalog-service/README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/031-catalog-api-circle-filtering.md`

## Tests Run

```bash
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug docker compose run --rm --no-deps catalog-service pytest -q
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug git diff --check
```

## Results

- Catalog-service tests passed: 20 tests.
- `git diff --check` passed.

## Limitations and Warnings

- The user's live browser/runtime could not be inspected from this shell. A WSL request to `localhost:8080` previously failed with connection refused, so live gateway verification was not possible in this run.
- If the Docker stack is already running with an older `catalog-service` image/container, it must be rebuilt/restarted before this API-side filtering change affects `localhost:8080`.

## Manual Review Notes

- This change enforces the user's requirement at the API response layer: out-of-circle catalog rows are removed before response pagination.
- The frontend still passes circle parameters to the gateway catalog route and does not call provider APIs directly.
