# Codex Run 028 - Frontend Responsive Polish

## Invocation Prompt

```text
Also, apply the following changes on top of the previous ones:
1. Make the map and the list next to it more responsive, not it feels too laggy
2. Make all headers like these (Operator workspace, Operator providers, etc) , also see the screenshots disappear (delete them) and leave only the ones below them as headers, as they were redundant. Apply this for all pages and sections of all profiles.
3. Polish the landing page (top bar is stuck on top and has visual artifacts, bottom cards are not good visually, etc.) Deliver a better result. Also, remove redundant info from there as well, I don't want repetitions.
5. In the login page, make sign in and continue with google have same total width as the button below (create ev account)
6. I still cannot see the points on the map.
```

Additional clarification during the run:

```text
Actually, I can see the points, just the map was too long and needed to be scrolled. Make sure the map is not scrolled inside the page... Just fit the height we can see.
```

## Canonical Task Prompt

N/A. This was a direct screenshot/continuation prompt.

## Goal

Apply frontend polish on top of Run 027: make the EV map fit the visible desktop viewport without page scrolling, improve map/list responsiveness, remove redundant uppercase page labels, simplify the landing page, and align login action widths.

## Scope Restatement

Targeted frontend-only changes under `apps/frontend`, plus required AI run documentation. No backend service, gateway route, database, provider adapter, or Docker changes were requested or made.

## Implementation Summary

- Removed the EV map page header and freshness metric strip so the map/list workspace is the first visible content on `/map`.
- Removed the extra `/api/catalog/freshness` request from the EV map page, reducing refresh work during map/filter changes.
- Made the desktop map route viewport-bounded with internal result-list scrolling, so the map itself remains visible without scrolling the page.
- Kept tablet/mobile layouts stacked and scrollable to avoid clipping when the sidebar collapses.
- Converted the map legend into an in-map overlay and hid the redundant canvas header to preserve vertical space.
- Made the loading state inside the results panel compact so it no longer consumes a large block above the list.
- Removed admin `DashboardPage` eyebrow/kicker props such as "Operator workspace" and "Provider analytics".
- Removed visible eyebrow labels from login, profile, provider registration, access denied, and EV point detail surfaces.
- Simplified the landing page by removing the bottom role-entry and benefits card strips, making the top bar non-sticky, and tightening hero/product-preview spacing.
- Made the login `Sign in` and `Continue with Google` action row span the same total width as `Create EV account`.
- Added regression assertions covering removed redundant labels and the updated map first-viewport contract.

## Files Changed

- `apps/frontend/src/components/AccessDenied.tsx`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/admin/AdminUi.tsx`
- `apps/frontend/src/features/auth/LoginPage.tsx`
- `apps/frontend/src/features/auth/ProfilePage.tsx`
- `apps/frontend/src/features/auth/ProviderRegistrationPage.tsx`
- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/features/landing/LandingPage.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/028-frontend-responsive-polish.md`

## Tests Run

```bash
wsl bash -lc 'cd /home/peppasmich/NTUA-saasPlug/apps/frontend && /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npx vitest run --reporter=dot'
wsl -d Ubuntu-24.04 --cd /home/peppasmich/NTUA-saasPlug/apps/frontend /home/peppasmich/.nvm/versions/node/v24.16.0/bin/npm run build
wsl bash -lc 'cd /home/peppasmich/NTUA-saasPlug && git diff --check'
```

## Results

- Frontend Vitest suite passed: 20 tests across 4 files.
- Frontend production build passed: `tsc --noEmit && vite build`.
- `git diff --check` passed.

## Limitations and Warnings

- In-app Browser visual QA could not be executed because the Browser plugin's required Node REPL JavaScript execution tool was not exposed by tool discovery in this session. No regular Playwright browser fallback was used because the Browser workflow was available in principle but blocked at runtime.
- Vite emitted the existing large chunk warning for the MapLibre bundle after build.
- The local PowerShell session could not execute the WSL `npx` path directly, so checks were run through WSL commands. The final build passed with direct `wsl -d Ubuntu-24.04 --cd ... npm run build`.

## Manual Review Notes

- The map behavior still conforms to SPEC-9: bounds are passed to `/api/catalog/points`, points are read from the cached aggregated catalog, and frontend radius filtering remains based on viewport center plus `catalogQueryRadiusKm(bounds.zoom)`.
- No direct provider API calls or internal service-port frontend calls were added.
