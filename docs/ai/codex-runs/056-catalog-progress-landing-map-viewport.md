# Run 056 - Catalog Progress, Landing, and Map Viewport

## Invocation Prompt

Direct user prompt:

> 1. In the import actions of operator (catalog health page) show the same
> progress bar we show in the sync page (when performing syncs)
> 2. Polish the first landing page on 8080, to use the new hero image and
> remove all these create account buttons (keep only the one on header) and
> then the body should be the hero map and some text in a card. Remove open
> workspace, etc. Make it more minimal and clean with the image and hero text
> as the center message.
> 3. What is the difference between status checks and point view in provider
> profile? Also, what does the status distribution show?
> 4. Now, that I have 2 rules (global and for red a new one), which one will
> apply for red?
> 5. When we zoom out from the map and then change tabs and then go back to
> map, we must preserve the altered zoom level and not reset it. It is cleaner.
>
> For 3 and 4, just answer in the chat. Consult all screenshots under
> "\\wsl.localhost\Ubuntu-24.04\home\peppasmich\screenshots"

## Goal

Reuse the existing operator progress pattern for catalog imports, simplify the
unauthenticated landing page around the new map asset, and preserve the EV map
viewport during browser-session navigation.

## Implementation Summary

- Reused `SyncOperationProgress` for catalog import actions, including running,
  success, error, accessible progressbar state, and duplicate-action blocking.
- Replaced the landing mockup with the existing EV charging map image and a
  centered minimal copy card. The header retains the only account-creation
  action; the body no longer includes account or workspace buttons.
- Persisted validated catalog bounds in browser session storage so map center,
  radius, and zoom survive route unmount/remount during the same session.
- Added tests for import-progress behavior, minimal landing actions, and map
  viewport restoration.

## Files Changed

- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/features/landing/LandingPage.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `apps/frontend/README.md`
- `docs/ai/prompt-log.md`

## Validation

- `npm test -- --run` in `apps/frontend`: 48 tests passed.
- `npm run build` in `apps/frontend`: passed.
- `git diff --check`: passed.

## Limitations and Manual Review

- The local gateway was not running during this implementation check, so no
  live operator import was triggered and no provider/catalog state changed.
- The Vite development server was started for local UI access after validation.
- The map viewport is intentionally scoped to browser session storage; opening
  a new browser session starts from the normal Athens default.

## SPEC Conformance

The work remains frontend-only, preserves gateway-relative API calls, keeps
catalog imports operator-only, and retains viewport-based catalog loading.
