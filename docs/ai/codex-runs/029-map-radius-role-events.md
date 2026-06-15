# Codex Run 029 - Map Radius, Role Badges, and Event Audit

## Invocation Prompt

```text
1. Why does it show points out of the map?
The list and the points should be only inside the circle. Load only points inside it.
2. Why does it say demo map coordinates in the list?
3. Create a dedicated badge for each user type (ev, operator, provider) like the highlighted place in the second screenshot up left in the side menu, with badge and color unique to them.
4. Then, when you finish tell me this: where do we have rabbitmq queues? I make clicks, etc. and should go to analytics, etc to update them. List all of these and how often they run and all caches duration and where they are. Do we have manual overrides to test the behaviour live and if yes, how?
```

## Canonical Task Prompt

N/A. This was a direct screenshot/continuation prompt.

## Goal

Fix the EV map so the rendered circle, fetched catalog rows, list rows, and markers use the same radius contract; remove the visible demo-coordinate badge from list cards; add role-specific sidebar badges; and audit RabbitMQ queues, scheduled propagation, cache durations, and live-test overrides.

## Scope Restatement

Targeted frontend changes under `apps/frontend`, one catalog API change under `services/catalog-service`, focused tests, service README updates, and required AI run documentation. No provider adapter, database migration, Docker topology, or real RabbitMQ topology change was made.

## Implementation Summary

- Added `centerLat`, `centerLng`, and `radiusKm` to the frontend catalog points request.
- Added catalog-service radius query parameters and SQL filtering so `/api/catalog/points` can return only rows inside the requested center radius before total/pagination.
- Kept frontend `pointWithinCatalogRadius` filtering as a defensive client-side check on all fetched pages.
- Replaced the old CSS-only radius overlay with a MapLibre GeoJSON circle layer generated from the same center/radius values.
- Removed the `Demo map coordinates` list badge from EV charging point cards.
- Added a shared sidebar role badge with unique EV user, provider admin, and operator color treatments.
- Updated frontend tests for radius query params and MapLibre source/layer mocks.
- Added catalog-service API tests for center-radius filtering and partial-radius validation.

## Files Changed

- `apps/frontend/src/components/domain/ev/index.tsx`
- `apps/frontend/src/components/layout/index.tsx`
- `apps/frontend/src/features/catalog/CatalogMap.tsx`
- `apps/frontend/src/lib/routing.ts`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `apps/frontend/src/test/routing.test.ts`
- `apps/frontend/src/test/setup.ts`
- `services/catalog-service/README.md`
- `services/catalog-service/app/routes.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/029-map-radius-role-events.md`

## Tests Run

```bash
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug/apps/frontend /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run --reporter=dot
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug/apps/frontend /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npm run build
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug docker compose run --rm --no-deps catalog-service pytest -q
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug git diff --check
```

## Results

- Frontend Vitest suite passed: 20 tests across 4 files.
- Frontend production build passed: `tsc --noEmit && vite build`.
- Catalog-service container tests passed: 18 tests.
- `git diff --check` passed.

## RabbitMQ and Cache Audit Summary

- Shared RabbitMQ contracts and topology live in `packages/events`.
- Declared queues are `analytics.events`, `billing.reservations`, and `catalog.provider_snapshots`, each with a DLQ.
- Implemented event publishers currently exist in `reservation-service` and `billing-service` via service-local outbox tables and explicit publish endpoints/jobs.
- Implemented RabbitMQ drains currently exist in `analytics-service` and `billing-service`.
- `usage.search_performed` and `usage.point_viewed` exist in the shared contracts and manual ingest/drain logic, but no frontend/API click-search emitter was found in this run.
- `catalog.points.imported` exists in the contracts and analytics ingestion supports it, but `catalog-service` currently documents and implements no RabbitMQ business publisher/consumer.
- `status-service` owns the only explicit TTL cache found: `STATUS_CACHE_TTL_SECONDS=300`.
- Catalog and analytics use persistent read models/aggregate tables refreshed by jobs, not TTL-expiring cache entries.

## Limitations and Warnings

- In-app Browser visual QA could not be executed because tool discovery did not expose a callable localhost/browser inspection tool in this session. Validation was performed with frontend unit tests, production build, catalog-service API tests, and CSS/source inspection.
- The frontend npm commands emitted the existing environment warning: npm `11.15.0` does not support the active Node.js `v18.19.1`. Commands still completed successfully.
- Vite emitted the existing MapLibre large chunk warning.
- The RabbitMQ audit is code/config based; no live broker queue depth inspection was performed.

## Manual Review Notes

- The map flow still conforms to the accepted SPEC: frontend calls `/api/catalog/points` through the gateway, reads from the local aggregated catalog, and does not call provider APIs directly.
- Radius filtering is now passed to the API as center plus radius, while bounds remain present for viewport scoping.
- The visible circle is no longer a CSS approximation independent from data filtering.
