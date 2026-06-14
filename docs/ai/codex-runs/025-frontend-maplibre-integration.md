# Run 025 - Frontend MapLibre Integration

## Invocation Prompt

Direct continuation prompt:

```text
Can you implement everything yourself?
```

This continued the prior discussion about adding a free map service to show
charging points on an actual map.

## Goal

Implement the real-map frontend integration without changing backend services,
architecture, provider adapters, secrets, deployment, or environment files.

## Scope

- Frontend-only implementation.
- Keep all charging-point reads through gateway-relative `/api/catalog/*`
  routes.
- Preserve bounds-based catalog loading.
- Do not call provider APIs from the browser.
- Do not modify `.env` or print secrets.

## Implementation Summary

- Added `maplibre-gl` to the frontend.
- Replaced the handcrafted SVG/CSS catalog map surface with a MapLibre GL JS
  map using the public OpenFreeMap style
  `https://tiles.openfreemap.org/styles/liberty`.
- Kept catalog point retrieval through existing bounds-based
  `/api/catalog/points` calls.
- Added provider-colored DOM markers and selected-point quick details on top of
  the real map.
- Wired map move/zoom events back into the catalog viewport state.
- Lazy-loaded MapLibre on the map route to keep the primary app bundle smaller.
- Added a deterministic MapLibre mock for frontend unit tests.
- Updated frontend README map documentation.

## Files Changed

- `apps/frontend/package.json`
- `apps/frontend/package-lock.json`
- `apps/frontend/README.md`
- `apps/frontend/src/main.tsx`
- `apps/frontend/src/features/catalog/CatalogMap.tsx`
- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/setup.ts`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `docs/ai/codex-runs/025-frontend-maplibre-integration.md`
- `docs/ai/prompt-log.md`

The working tree already contained frontend UI changes in `AppShell`,
`components/domain/ev`, `CatalogPage`, `CatalogMap`, `routing`, and styles before
this run. This run worked with those changes rather than reverting them.

## Validation

- `npm test -- --run` from `apps/frontend/`
  - Passed: 4 test files, 13 tests.
- `npm run build` from `apps/frontend/`
  - Passed.
  - Warning: generated `maplibre-gl` chunk is larger than Vite's default 500 kB
    warning threshold. The renderer is lazy-loaded on the map route.
- `curl -I --max-time 5 http://localhost:5173/map`
  - Passed: HTTP 200 from the already-running local Vite server.

## Limitations And Warnings

- Browser automation was not available in this session because tool discovery
  did not expose the required Node REPL browser execution tool.
- `npm install maplibre-gl` reported existing npm audit findings:
  2 moderate, 3 high, and 1 critical vulnerability. They were not remediated in
  this run because dependency audit remediation can introduce unrelated package
  changes and was not requested.
- OpenFreeMap currently offers a free public instance without API keys, but it
  does not provide an SLA guarantee.

## Manual Review Notes

- Verify `/map` visually in the browser through the running frontend or gateway.
- Confirm that real provider/catalog data includes meaningful coordinates; if
  provider records use synthetic coordinates, the map will correctly render those
  synthetic locations.
