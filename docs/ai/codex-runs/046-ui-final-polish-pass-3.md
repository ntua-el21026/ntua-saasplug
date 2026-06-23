# Codex Run 046 - UI Final Polish Pass 3

## Invocation Prompt

Direct user prompt:

```text
Good, now regarding the profile of the providers, make these changes:
1. In charging points I cannot see the filter to select entries (the previous implementation). We must choose how many to fetch. Then, delete the right card (availability checks)
2. In analytics page: a. Make this "Process pending activity events and rebuild provider summaries." go to the next line b. put a filter to select date range for the analytics to be show (affects everything)
3. In invoices page make this "Process pending billing events before reviewing invoice balances." go to the next line as well
4. Generally, make all text provider facing, like "Provider Settings" -> "Your Settings", all substrings (like the 2 examples above) to be user facing and commercial, not like backend facing or app facing.
5. Make the titles of all analytics cards on very top (in all users all profiles) have a title as big as the value displayed in font size and with different color. All cards in general.
6. Make the titles of the page have a unique (same for all of them) different color (not black) in all pages of all users the same. The same color must be applied in card titles (all of the cards in the app).

Work professionally.
Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-22c2375f-9938-4369-a420-cfe93ae97870.png`: No such file or directory (os error 2)
Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-4b72c8b0-7208-4ecf-86aa-23ae317007f4.png`: No such file or directory (os error 2)
Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-05fbf976-9b40-4639-ad5d-f4b542974e37.png`: No such file or directory (os error 2)
```

## Canonical Task Prompt

None. This was a direct invocation prompt.

## Goal

Complete the third UI final polish pass for provider-facing pages and shared card/page title styling.

## Implementation Summary

- Added provider charging-point fetch-size presets for 20, 40, 60, 80, 100, and full list.
- Removed the provider points "Availability checks" card and kept the page focused on charging-point inventory.
- Added provider analytics date-range controls and passed the same inclusive `from`/`to` range to provider summary, trends, top-points, and status-distribution endpoints.
- Updated `analytics-service` provider aggregate queries to filter daily aggregate rows by the requested date range.
- Reworked provider-facing copy across provider dashboard, charging points, analytics, invoices, invoice detail, export, and settings pages.
- Added shared accent styling for page titles, card titles, modal/card headers, and metric-card labels.
- Updated frontend and analytics-service documentation.
- Added frontend and backend regression coverage for the new provider point fetch-size behavior and analytics date-range filtering.
- Closed GitHub issue `#23` and verified the Project v2 item is `Done`.

## Files Changed

- `apps/frontend/README.md`
- `apps/frontend/src/design/theme.css`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `services/analytics-service/README.md`
- `services/analytics-service/app/routes.py`
- `services/analytics-service/tests/test_analytics_service_api.py`

## Tests Run

```bash
npm test -- src/test/admin-routing.test.tsx --run
```

Result: `23 passed`.

```bash
PYTHONPATH=.:../../packages/events pytest -q -s tests/test_analytics_service_api.py
```

Result: `24 passed`.

```bash
npm run build
```

Result: passed. Vite emitted the existing chunk-size warning for the MapLibre bundle.

```bash
git diff --check
```

Result: passed.

## Limitations and Notes

- The supplied screenshots were unavailable in the local filesystem, so changes were implemented from the written requirements.
- Browser-level visual inspection was not run in this pass; validation was via focused React tests, backend API tests, TypeScript build, and diff checks.
- The full worktree still includes earlier uncommitted changes from previous polish passes; this run intentionally touched only the files listed above.

## Manual Review Notes

- Frontend API calls remain gateway-relative under `/api/...`.
- Provider analytics date filtering is backend-backed; the frontend no longer only filters already-loaded rows.
- The provider points page still uses cached catalog data through `catalog-service`; the new selector controls the catalog query `limit` and paginated full-list fetch behavior.
