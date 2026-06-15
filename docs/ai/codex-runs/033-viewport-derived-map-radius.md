# Codex Run 033 - Viewport-Derived Map Radius

## Invocation Prompt

Direct continuation after corrective map-radius screenshots and clarification:

```text
Go ahead and finish your job
```

The active user request context was to fully resolve the EV map issue where
catalog results and markers still appeared outside the visible circle, and to
make the circle occupy a stable, fully visible percentage of the map viewport
while loading and displaying all points inside it and only inside it.

## Goal

- Make the frontend API query, list filtering, marker rendering, and drawn
  circle use the same search circle.
- Derive that circle from the actual MapLibre viewport instead of a fixed
  zoom-to-radius table.
- Keep the catalog API contract as server-side radius filtering, not visual
  hiding only.
- Preserve gateway-only frontend API calls.

## Implementation Summary

- Added `radiusKm` to frontend `Bounds` so the search circle is explicit state.
- Updated catalog query construction to send the explicit `radiusKm` from the
  same `Bounds` object used for list/map filtering and the radius layer.
- Changed the MapLibre integration to compute radius from rendered viewport
  pixels using `project`/`unproject`, keeping the circle a stable percentage of
  the visible map across zoom levels.
- Switched the default EV map result limit to `all`, while still using
  paginated API calls, so the normal map displays every point inside the circle.
- Updated tests and the MapLibre test mock for viewport-derived radius behavior.
- Updated frontend README documentation for the map radius/query contract.

## Files Changed

- `apps/frontend/README.md`
- `apps/frontend/src/features/catalog/CatalogMap.tsx`
- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/lib/routing.ts`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `apps/frontend/src/test/setup.ts`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/033-viewport-derived-map-radius.md`

## Tests Run

| Command | Result |
|---|---|
| `npm exec vitest run src/test/routing.test.ts src/test/catalog-map-ui.test.tsx -- --reporter=dot` | Passed, 3 tests |
| `npm run build` | Passed; Vite emitted the existing MapLibre chunk-size warning |
| `docker compose run --rm --no-deps catalog-service pytest -q` | Passed, 24 tests |
| `npm run test -- --run --reporter=dot` | Passed, 21 tests |
| `git diff --check` | Passed |

## Results

- The frontend now calls `/api/catalog/points` with the same `centerLat`,
  `centerLng`, and `radiusKm` that it uses to draw the map circle.
- The API-side exact Haversine filtering from run 031 remains the server-side
  guard that prevents out-of-circle rows from being returned for radius queries.
- The list and map markers are filtered against the same explicit circle state.
- The radius is no longer a large fixed value at high zoom; it is derived from
  the visible map viewport.

## Limitations

- Browser plugin tooling was searched for but no callable Browser tool was
  exposed in this session. Validation therefore used Vitest, TypeScript/Vite
  build, and catalog-service API tests rather than live in-browser screenshot
  QA.
- A running local Docker/frontend stack may still show old behavior until the
  changed frontend and catalog-service containers are rebuilt/restarted.

## Manual Review Notes

- Confirm in the browser after rebuilding that zooming keeps the full circle
  visible and that the Network request for `/api/catalog/points` includes
  `centerLat`, `centerLng`, and the viewport-derived `radiusKm`.
