# Run 026 - Login Provider Entry Polish

## Invocation Prompt

Direct user prompt:

```text
Remove secure session badge and

[Sign in](http://localhost:8080/login)
/
[Create EV account](http://localhost:8080/register)
/
[Provider entry](http://localhost:8080/provider-register)

buttons in the bottom.
Also, make the layout better, make try a role black and also a button to register (only ev user).
Operators only should be able to register providers.
```

The user also supplied a screenshot of the login screen.

## Goal

Polish the frontend login entry screen and make provider registration an
operator-only frontend route without changing backend behavior, architecture, or
environment files.

## Scope

- Frontend-only changes.
- No backend service changes.
- No `.env` access or modification.
- No secrets printed.

## Implementation Summary

- Removed the shared bottom auth navigation links from `AuthLayout`.
- Removed the login panel's `Secure session` badge.
- Added a single full-width `Create EV account` action on the login panel.
- Kept provider-entry links off public login and landing entry surfaces.
- Changed the role shortcut section label to primary black text.
- Restricted `/provider-register` to authenticated `OPERATOR` users through the
  existing frontend route guards.
- Updated provider registration copy and actions to reflect operator ownership.
- Added route tests for anonymous, EV user, provider admin, and operator access
  to provider registration.

## Files Changed

- `apps/frontend/src/App.tsx`
- `apps/frontend/src/features/auth/AuthLayout.tsx`
- `apps/frontend/src/features/auth/LoginPage.tsx`
- `apps/frontend/src/features/auth/ProviderRegistrationPage.tsx`
- `apps/frontend/src/features/landing/LandingPage.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `docs/ai/codex-runs/026-login-provider-entry-polish.md`
- `docs/ai/prompt-log.md`

## Validation

- `npm test -- --run` from `apps/frontend/`
  - Passed: 4 test files, 17 tests.
- `npm run build` from `apps/frontend/`
  - Passed.
  - Warning: Vite reports the lazy-loaded MapLibre chunk exceeds the default
    500 kB warning threshold.

## Limitations And Warnings

- Browser automation was not available through the required runtime in this
  session, so visual verification was limited to code inspection and automated
  frontend checks.
- The MapLibre chunk-size warning is unrelated to this login polish change and
  remains expected after the map integration.
