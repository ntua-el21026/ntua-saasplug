# Codex Run 030 - Map Radius Marker Correction

## Invocation Prompt

```text
I can still see points outside the circle. Fix it!

Also, make the points have the color of the provider

Continue your job, also make the points in the map have the color of their provider.

Also, maybe call the api with the circle, to minimize results fetched and therefore have responsive UI.
Make it as responsive as we can
```

## Canonical Task Prompt

N/A. This was a direct corrective screenshot prompt.

## Goal

Prevent charging-point markers and list entries from appearing outside the visible radius circle, ensure map markers use provider-specific colors, and reduce unnecessary catalog fetching for responsive map/list interaction.

## Scope Restatement

Targeted frontend changes under `apps/frontend`, plus required AI run documentation. The existing catalog API center/radius query contract from Run 029 was preserved; no backend or Docker topology changes were made in this run.

## Implementation Summary

- Added a visual-safe radius helper so rendered markers/list rows are filtered slightly inside the mathematical radius. This prevents fixed-size marker circles and shadows from visually protruding outside the radius line.
- Applied the visual-safe radius filter in `CatalogPage` before rendering both the result list and `CatalogMap`.
- Added the same radius guard inside `CatalogMap` so stale or unfiltered parent props cannot render outside-radius markers.
- Changed the default result limit from `all` to `160` to reduce first-load marker/list work while preserving the user's ability to choose `all`.
- Changed catalog loading so non-`all` result limits fetch only the requested first page instead of fetching every page under the radius.
- Set provider marker colors through an explicit `--map-marker-color` style property on each marker and retained provider metadata in marker dataset attributes for regression tests/debugging.
- Added a UI regression test where the mocked catalog API returns an outside-radius point; the test verifies that it is not rendered and that red/green/blue marker colors are applied.

## Files Changed

- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/features/catalog/CatalogMap.tsx`
- `apps/frontend/src/lib/routing.ts`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/030-map-radius-marker-correction.md`

## Tests Run

```bash
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug/apps/frontend /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run src/test/routing.test.ts src/test/catalog-map-ui.test.tsx --reporter=dot
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug/apps/frontend /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npm run build
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug/apps/frontend /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run --reporter=dot
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug git diff --check
```

## Results

- Focused routing/map UI tests passed: 3 tests across 2 files.
- Frontend production build passed: `tsc --noEmit && vite build`.
- Full frontend Vitest suite passed: 20 tests across 4 files.
- `git diff --check` passed.

## Limitations and Warnings

- Live Browser visual QA was not executed because a callable localhost/browser inspection tool was not exposed in this session. A gateway request from WSL to `localhost:8080` also failed with connection refused, so the user's running browser instance could not be inspected from the shell.
- The frontend commands still emit the existing npm/Node warning: npm `11.15.0` does not support Node.js `v18.19.1`.
- Vite still emits the existing large chunk warning for the MapLibre bundle.

## Manual Review Notes

- The frontend still calls only gateway routes.
- Catalog fetching still uses viewport bounds plus center/radius query parameters.
- The extra client-side visual-safe radius guard is intentionally stricter than the API's mathematical radius because fixed-size markers can otherwise visually extend past the radius line even when their coordinate center is inside it.
