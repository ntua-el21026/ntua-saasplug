# Codex Run 041 - Provider Filter and Point Access Polish

## Invocation Prompt

```text
# Files mentioned by the user:

## codex-clipboard-497faa47-d3e8-4f3d-a116-765487c7183b.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-497faa47-d3e8-4f3d-a116-765487c7183b.png

## codex-clipboard-1daae195-11fd-4c16-a08b-b1602f6a824c.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-1daae195-11fd-4c16-a08b-b1602f6a824c.png

## codex-clipboard-7781b552-249c-4b5d-a228-8570f72eabe3.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-7781b552-249c-4b5d-a228-8570f72eabe3.png

## codex-clipboard-5f51f9e7-a996-46c0-9094-dbc94cacbb1d.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-5f51f9e7-a996-46c0-9094-dbc94cacbb1d.png

## My request for Codex:
1. Polish this filters card, with better spacing and organizations and selectable charger type from a list.
2. Then, in the provider profile, do 3 things:
a. replace all subtexts like this "Daily successful reservations by the analytics aggregate cache." or this "Issued and paid invoice status from billing-service." in all pages and cards with proper user-facing ones (that have to do with the provider, not our backend or app implementation or logic, but proper ones)
b. Make column titles black
c. When pressing a point I own i go to this page (last screenshot with access denied). This should not happen!
Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-497faa47-d3e8-4f3d-a116-765487c7183b.png`: No such file or directory (os error 2)Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-1daae195-11fd-4c16-a08b-b1602f6a824c.png`: No such file or directory (os error 2)Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-7781b552-249c-4b5d-a228-8570f72eabe3.png`: No such file or directory (os error 2)Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-5f51f9e7-a996-46c0-9094-dbc94cacbb1d.png`: No such file or directory (os error 2)
```

## Canonical Task Prompt

None. This was a direct UI polish and bugfix prompt.

## Goal

Polish the EV map filter card, replace backend-facing UI copy with user-facing wording, make table column titles visually stronger, and allow provider admins to open their own charging point detail page without exposing EV-only reservation controls.

## Implementation Summary

- Reworked the EV map filter card into a clearer filters panel with header copy, grouped availability chips, a two-column filter grid, and a charger type dropdown.
- Added charger type labels for selected filter chips while preserving the existing `connector` query parameter contract.
- Made shared table headers and definition-list labels use primary text color.
- Replaced backend-facing provider/operator card descriptions with user-facing copy.
- Updated provider registration, profile shortcut, and provider error wording to avoid implementation-specific phrasing.
- Changed point-detail routing so `EV_USER`, `PROVIDER_ADMIN`, and `OPERATOR` can open cached catalog point details.
- Added point-detail authorization inside the page so provider admins can only view points for their own provider.
- Kept reservation creation EV-only and replaced the form with a read-only availability notice for provider/operator accounts.
- Added/updated frontend tests for the filter card, charger type query handling, provider point access, and provider-facing copy.

## Files Changed

- `apps/frontend/README.md`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/domain/ev/index.tsx`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/admin/AdminUi.tsx`
- `apps/frontend/src/features/auth/ProfilePage.tsx`
- `apps/frontend/src/features/auth/ProviderRegistrationPage.tsx`
- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/lib/api.ts`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `apps/frontend/src/test/routing.test.ts`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/041-provider-filter-and-point-access-polish.md`

The working tree already contained additional modified files from earlier runs; those are not listed here as part of this run unless they were touched for this prompt.

## Tests and Checks Run

| Command | Result |
|---|---|
| `curl -I --max-time 5 http://localhost:8080/map` | Passed; nginx returned HTTP 200. |
| `npm test` in `apps/frontend/` | Passed; 4 files, 29 tests. |
| `npm run build` in `apps/frontend/` | Passed; TypeScript and Vite production build completed. Vite reported the existing large chunk warning for the MapLibre bundle. |
| `git diff --check` | Passed. |
| Frontend text audit with `rg` | Passed for the targeted backend-facing phrases; remaining service names are operator system-health identifiers and test fixture data. |

## Live QA Notes

- A live endpoint smoke check confirmed that `http://localhost:8080/map` is served by nginx.
- MCP Node REPL browser automation could not start because the tool returned `sandboxCwd is not a local file URI: file:///home/peppasmich/NTUA-saasPlug`.
- No local `google-chrome`, `chromium`, `chromium-browser`, or `msedge` binary was available for a shell-based headless screenshot fallback.
- Therefore, rendered browser screenshot QA was not completed in this run; UI behavior was covered by the frontend test suite.

## Specification Conformance

- No backend business logic was changed for this prompt.
- The frontend still uses gateway-relative `/api/...` routes.
- Provider-admin point access now follows the accepted role behavior: provider admins can inspect their own provider points, while reservation creation remains EV-user-only.
- No deployment, Vercel action, secret exposure, or `.env` modification was performed.

## Limitations

- Provider point ownership is enforced in the frontend page guard based on the signed-in provider admin's `provider_code`; the backend catalog detail route remains a cached catalog read endpoint as designed.
- Visual screenshot verification was unavailable due the browser tooling limitations listed above.

## Assistant Response Summary

The final response should summarize the filter-card polish, user-facing copy cleanup, black column titles, provider-owned point access fix, validation results, and the browser QA limitation.
