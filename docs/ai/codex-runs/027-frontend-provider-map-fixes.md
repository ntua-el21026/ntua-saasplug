# Codex Run 027 - Frontend Provider Map Fixes

## Invocation Prompt

```text
We need to fix some frontend issues in the app:
1. In the provider profile, analytics and settings pages do not load and when we press them a blank page appears and the app crushes
2. The charging points on map are way to small. We need to have a fixed size of points to all zoom levels and to be clearly visible
3. The radius of points displayed is not shown on map. Show it. Also answer to me: how do we limit the points to the radious (pass x,y to api or how). Also, do we use the cached points from catalog?
```

Additional user continuation during the run:

```text
I ran this and got this:peppasmich@MSI:~/NTUA-saasPlug$ npm --version
11.15.0
peppasmich@MSI:~/NTUA-saasPlug$

Continue your job where you left off.
```

## Canonical Task Prompt

N/A. This was a direct one-off bugfix prompt.

## Goal

Fix provider admin frontend crashes on profile/analytics/settings navigation, make map charging-point markers visibly fixed-size across zoom levels, show the catalog radius on the map, and document how radius filtering and cached catalog data work.

## Scope Restatement

Targeted frontend-only changes under `apps/frontend`, plus required AI run documentation. No backend API, provider adapter, database, Docker, or gateway route changes were requested or made.

## Implementation Summary

- Made provider analytics rendering tolerant of `currency: null` from analytics aggregates before any events exist.
- Made provider settings rendering tolerant of provider-registry audit logs where `changed_fields` is the backend object/dict shape instead of a string array.
- Updated frontend API types to match nullable analytics point/currency fields and object-shaped provider audit fields.
- Increased MapLibre marker pixel dimensions and visual weight so markers remain clearly visible independent of zoom.
- Added a visible map radius circle and radius label driven by the same `catalogQueryRadiusKm(bounds.zoom)` value used by the frontend radius filtering logic.
- Added regression tests for provider analytics null currency, provider settings audit field object rendering, provider-admin profile rendering, and map radius label visibility.

## Files Changed

- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/catalog/CatalogMap.tsx`
- `apps/frontend/src/lib/formatting.ts`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/027-frontend-provider-map-fixes.md`

## Tests Run

```bash
/home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run src/test/admin-routing.test.tsx --reporter=verbose
/home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run src/test/catalog-map-ui.test.tsx --reporter=verbose
/home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run --reporter=dot
/home/peppasmich/.nvm/versions/node/v24.16.0/bin/npm run build
```

## Results

- Provider/admin routing regression suite passed: 14 tests.
- Catalog map UI test passed: 1 test.
- Full frontend test suite passed: 20 tests across 4 files.
- Frontend build passed: `tsc --noEmit && vite build`.

## Limitations and Warnings

- `npm` emitted a local environment warning that npm `11.15.0` does not support the Node version resolved by the script environment. The commands still completed successfully.
- Vite emitted the existing large chunk warning for the MapLibre bundle after build.
- In-app Browser visual QA could not be executed because the Browser plugin's required Node REPL JavaScript execution tool was not exposed by tool discovery in this session. Automated React/Vitest rendering tests and the production build were used instead.

## Manual Review Notes

- Radius limiting remains aligned with accepted SPEC behavior: the frontend sends bounds to `/api/catalog/points`, receives cached aggregated catalog rows from `catalog-service`, then applies a frontend circular radius filter using the viewport center and zoom-derived radius.
- No direct provider API calls or internal service-port frontend calls were added.
