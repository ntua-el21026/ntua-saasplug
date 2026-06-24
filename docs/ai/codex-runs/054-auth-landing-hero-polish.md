# Run 054 - Auth Landing Hero Polish

## 1. Run Metadata

| Field | Value |
|---|---|
| Run ID | 054 |
| Date/time | 2026-06-24 Europe/Athens |
| Working directory | `/home/peppasmich/NTUA-saasPlug` |
| Repository branch | `main` |
| Commit before run | `d5fc01c` |
| Commit after run | Not committed |
| Status | completed_with_warnings |

## 2. Invocation Prompt

```text
The png is under "\\wsl.localhost\Ubuntu-24.04\home\peppasmich\screenshots". Go and apply all fixes.

Save (copy) the image somewhere in our codebase.
```

The immediate preceding user request specified the targeted changes:

```text
In the landing page (see screenshot), make the following changes:
1. Remove this text "Enter the presenter-provided password once; role shortcuts keep the current password field value."
2. Make this "Try a role" larger, as large as user type titles below in the cards
3. Put the card "Gateway-only SaaS cockpit
Catalog, reservations, analytics, invoices, and sync controls in one role-aware frontend." much more up and change the photo on the left with the last screenshot attached here (Hero) and make the card larger.

Also, make this slogan "Gateway-only SaaS cockpit
Catalog, reservations, analytics, invoices, and sync controls in one role-aware frontend." something better and more commercial for the ev users.
```

## 3. Canonical Task Prompt

No canonical prompt file was used. This was a direct implementation prompt.

## 4. Goal

Polish the shared auth landing hero without changing login behavior, role
shortcut behavior, authentication, routes, or gateway access.

## 5. Canonical Sources Read

| File | Purpose |
|---|---|
| `AGENTS.md` | Repository implementation and logging rules. |
| `docs/specs/SPECIFICATIONS.md` | Frontend and gateway-only constraints. |
| `apps/frontend/README.md` | Auth route and frontend asset conventions. |
| `apps/frontend/src/features/auth/AuthLayout.tsx` | Shared authentication hero layout. |
| `apps/frontend/src/features/auth/LoginPage.tsx` | Role shortcut heading and password guidance text. |
| `apps/frontend/src/styles/app.css` | Existing auth layout tokens and responsive rules. |
| `/home/peppasmich/screenshots/Hero.png` | User-provided source image. |

## 6. Files Changed

### Created

| File | Purpose |
|---|---|
| `apps/frontend/src/assets/auth/ev-charging-map-hero.png` | Repository-owned copy of the supplied EV map hero image. |
| `design-qa.md` | Required visual QA record. |
| `docs/ai/codex-runs/054-auth-landing-hero-polish.md` | This run record. |

### Modified

| File | Summary |
|---|---|
| `apps/frontend/src/features/auth/AuthLayout.tsx` | Replaced the CSS map placeholder with the copied image and EV-focused hero copy. |
| `apps/frontend/src/features/auth/LoginPage.tsx` | Removed the presenter-password guidance line. |
| `apps/frontend/src/styles/app.css` | Raised and enlarged the hero showcase, updated image sizing, and aligned the role heading scale. |
| `apps/frontend/src/test/app-smoke.test.tsx` | Protected the new visual copy and removed text against regression. |
| `docs/ai/prompt-log.md` | Recorded this direct implementation run. |

## 7. Commands Run

| Command | Result | Notes |
|---|---|---|
| `npm test -- --reporter=verbose` | Passed | 5 test files, 44 tests. |
| `npm test -- --reporter=verbose` (intermediate rerun) | Transient failure | An unrelated scheduler interval assertion received the default interval once; the exact test and the final complete rerun passed. |
| `npm test -- --reporter=verbose -t "lets operators update an interval job schedule"` | Passed | 1 selected test passed. |
| `npx tsc --noEmit` | Passed | No TypeScript errors. |
| `npm run build` | Passed | Production asset bundle contains the copied image. |
| `docker compose up -d --build frontend` | Passed | Rebuilt and recreated only the frontend service. |
| `docker compose ps frontend nginx-gateway` | Passed | Both services healthy. |
| `curl http://localhost:8080/login` | Passed | HTTP 200. |
| In-app browser bootstrap | Blocked | Runtime rejected the Node REPL browser initialization before capture. |

## 8. Implementation Summary

- Copied the supplied Hero map screenshot to a tracked frontend asset path.
- Replaced the CSS-drawn map in the shared auth hero with that image.
- Moved the showcase from the bottom of the left column to immediately after
  the introduction and enlarged it for desktop.
- Replaced internal SaaS-operation copy with EV-user-oriented discovery,
  availability, and reservation copy.
- Removed the visible password guidance while retaining the existing behavior:
  role shortcuts still preserve the current password input value.

## 9. Tests and Checks

The targeted frontend suite, type check, production build, Docker frontend
rebuild, gateway route smoke, and diff check were run. The runtime browser
visual comparison remains unavailable; details are recorded in `design-qa.md`.

## 10. Limitations, Warnings, and Blockers

- The mandatory in-app browser visual capture could not initialize in this
  environment, so exact rendered comparison is blocked. No browser fallback
  was used because the product-design workflow requires the in-app browser.
- One complete Vitest rerun produced a transient failure in the pre-existing
  scheduler interval test. The isolated test and the next complete 44-test run
  passed without changing scheduler code.
- The added PNG is 931 KiB and is intentionally retained as a source asset to
  keep the frontend build self-contained.
- The working tree contained unrelated `services/status-service/app/*`
  modifications when final checks ran. They were inspected only to establish
  that they were outside this auth-landing scope and were not changed by this
  run.

## 11. GitHub Project / Issue / Milestone Actions

Not applicable.

## 12. Final Status

```text
COMPLETED_WITH_WARNINGS
```

The requested implementation and automated checks are complete. Manual visual
review remains necessary because browser capture could not start.

## 13. Next Recommended Action

```text
Open http://localhost:8080/login at a desktop viewport and verify the new hero
image crop and card placement against Hero.png.
```
