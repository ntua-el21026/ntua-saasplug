# Codex Run 043 - Login, Map, Reservation Message Polish

## Invocation Prompt

```text
# Files mentioned by the user:

## codex-clipboard-31b6ffa7-88d8-42fe-bc89-a105bfd9bf41.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-31b6ffa7-88d8-42fe-bc89-a105bfd9bf41.png

## codex-clipboard-572fb541-e4fb-4513-bcc4-9cc6229a7648.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-572fb541-e4fb-4513-bcc4-9cc6229a7648.png

## codex-clipboard-622ae2df-fcdd-4083-8eed-c72379f66149.png: C:/Users/peppa/AppData/Local/Temp/codex-clipboard-622ae2df-fcdd-4083-8eed-c72379f66149.png

## My request for Codex:
1. In the login screen add quick options for all 3 providers (blue, green and red).
2. In the EV user screen we cannot see the list of points now. Fix it.
3. In the reservation screen I cannot delete 0, to type something else, like 35. Fix it.
4. Make the reservation message close with a circular button with x inside it in the upper right corner of the box. Do so for all such emerging messages of the app.
Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-31b6ffa7-88d8-42fe-bc89-a105bfd9bf41.png`: No such file or directory (os error 2)Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-572fb541-e4fb-4513-bcc4-9cc6229a7648.png`: No such file or directory (os error 2)Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-622ae2df-fcdd-4083-8eed-c72379f66149.png`: No such file or directory (os error 2)
```

## Canonical Task Prompt

None. This was a direct UI bugfix and polish prompt.

## Goal

Polish the login shortcuts, restore EV point-list visibility, allow natural reservation duration editing, and add consistent dismiss controls to reservation and alert messages.

## Implementation Summary

- Added `greenPlug admin` and `bluePlug admin` quick login shortcuts alongside the existing `redPlug admin` shortcut.
- Updated frontend README demo-user documentation to list all three provider admin demo users.
- Changed reservation duration state from numeric-only to string-backed input state so users can clear the field and type a new value such as `35`.
- Reservation submit now parses and validates the duration before sending `duration_minutes`.
- Added a circular top-right `x` close button to the shared modal component and wired the reservation result modal to it.
- Made shared `Alert` messages dismissible with the same circular `x` control, so action/result/error messages across the app can be closed consistently.
- Tightened EV map sidebar layout so the `.point-list` keeps visible internal scroll space under the filters instead of collapsing out of view.
- Added tests for provider login shortcuts and the reservation duration/close interaction.

## Files Changed

- `apps/frontend/README.md`
- `apps/frontend/src/components/Feedback.tsx`
- `apps/frontend/src/components/domain/ev/index.tsx`
- `apps/frontend/src/components/ui/primitives.tsx`
- `apps/frontend/src/features/auth/LoginPage.tsx`
- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/043-login-map-reservation-message-polish.md`

The working tree already contained additional modified files from earlier runs; this run lists only files touched for this prompt.

## Tests and Checks Run

| Command | Result |
|---|---|
| `npm test -- --run src/test/app-smoke.test.tsx src/test/catalog-map-ui.test.tsx src/test/admin-routing.test.tsx` from `apps/frontend/` | Passed: 3 files, 28 tests. |
| `npm test` from `apps/frontend/` | Passed: 4 files, 31 tests. |
| `npm run build` from `apps/frontend/` | Passed: TypeScript and Vite production build completed. Vite reported the existing large MapLibre chunk warning. |
| `git diff --check` | Passed. |
| `curl -I --max-time 5 http://localhost:8080/login` | Passed: nginx returned HTTP 200. |
| `curl -I --max-time 5 http://localhost:8080/map` | Passed: nginx returned HTTP 200. |

## Live QA Notes

- The relevant flows were:
  - `/login` -> provider quick shortcut selection list includes red, green, and blue provider admins.
  - `/map` -> EV point list remains visible and internally scrollable under filters.
  - `/points/:providerCode/:externalPointId` -> duration input can be cleared and replaced; reservation result closes through the top-right circular `x`.
- The supplied screenshots were available through the WSL `/mnt/c/...` paths and were inspected.
- Browser/Node REPL automation could not run because the tool returned `sandboxCwd is not a local file URI: file:///home/peppasmich/NTUA-saasPlug`.
- No local Chrome/Chromium/Edge binary was available for a no-install headless screenshot fallback.

## Specification Conformance

- Frontend calls remain gateway-relative `/api/...`.
- No backend business logic, provider adapters, database migrations, deployment settings, Vercel actions, secrets, or `.env` files were changed.
- The change stays within SPEC-8 and SPEC-9 frontend/auth/reservation UX scope.

## Limitations

- Rendered browser screenshot QA was not completed due the Browser MCP and local browser limitations above.
- The EV list visibility fix is CSS/layout-level and is covered by existing map UI tests plus local gateway smoke, not by a screenshot assertion.

## Assistant Response Summary

The final response should summarize the login shortcuts, EV point-list layout fix, reservation duration edit fix, dismissible message controls, files changed, tests passed, and browser QA limitation.
