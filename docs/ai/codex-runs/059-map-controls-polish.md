# Codex Run 059 - Map Controls Polish

## Invocation Prompt

Direct user prompt:

> Check the screenshot in the screenshots folder an make these changes in the map:
> 1. Remove N,W,E,S from the left side and also + and -
> 2. On the right side, make full screen on and of arrows button, just on top of +.
> Do only this change, fast.

Follow-up prompt:

> Also answer, based on the new screenshot  in the folder as well: when we tap on a point as ev user that is blue and it is reserved, shouldnt this pie diagram updated and show also reserved?

## Goal

Remove the custom EV map pan/zoom pad shown on the left side of the map, keep native MapLibre zoom controls on the right, and make the existing map fullscreen toggle an icon button positioned above the native zoom-in button.

## Implementation Summary

- Removed the custom `MapFloatingControls` rendering from the EV catalog page.
- Converted the fullscreen toggle from a text pill into an accessible icon button with separate enter/exit glyphs.
- Offset the native MapLibre top-right controls so fullscreen sits above zoom.
- Removed the now-unused `MapFloatingControls` component and its CSS.
- Updated the MapLibre test mock to expose native zoom-in/zoom-out buttons.
- Updated catalog map UI tests to assert the removed custom controls are absent and to use the native zoom controls.

## Files Changed

- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/components/domain/ev/index.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/setup.ts`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/059-map-controls-polish.md`

## Tests Run

- `npm test -- src/test/catalog-map-ui.test.tsx`
  - Result: passed, 5 tests.
- `npm run build`
  - Result: passed.

## Specification Conformance

The change is frontend-only and preserves the accepted gateway, catalog, status, and reservation architecture. The EV map still uses local catalog search through the existing frontend flow.

## Limitations

No browser screenshot capture was run for this small targeted change. The user-provided screenshots under `/home/peppasmich/screenshots` were inspected locally.
