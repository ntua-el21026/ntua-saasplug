# Codex Run 038 - Google EV Sign-In, Password Changes, and Profile Polish

## Invocation Prompt

Direct user request received on 2026-06-22:

```text
1. Let's tackle an issue with login with Google now.
It must behave like this for start: allow only EV users to login with google (not operator or admin).
So if someone tries to login with google and has no account it should register them as an ev user and then if they log in again to sign in the same account. Fix and document this.

2. After you finish the above task with Google, also configure and document this:
Now, we must add functionality in the microservice that also handles login.
We must support password change for users (ev, providers, operator).
It must be in their profile page.
It will be supported and shown in the profile only on the ev users that have not logged in with google.

3. Polish the profile page of all users (ev, provider, operator) so that we have user facing text (not app facing like this "Your signed-in identity and access level." or "Role-aware entry points for your current session." that reveal our backend app) but polished messages towards each user category. Also, make the left column titles of "Profile details" of all users black (like email, roles, etc.). Also, make it say role, as it is one each time.

Work thoroughly and deliver a polished result for all 3 tasks.
```

The referenced local image could not be read by the environment, so the task was completed from the textual requirements.

## Canonical Task Prompt

N/A. This was a direct one-off implementation prompt.

## Goal

Implement EV-only Google sign-in behavior, add backend password change support, expose password changes only for eligible EV profiles, and polish profile copy for EV, provider-admin, and operator users.

## Implementation Summary

- Added auth metadata to users: `auth_provider`, optional `google_subject`, and `last_login_method`.
- Added idempotent startup schema migration for the new auth columns.
- Implemented EV-only Google sign-in:
  - unknown Google email creates an `EV_USER` account;
  - existing EV email signs into the same account;
  - existing `OPERATOR` or `PROVIDER_ADMIN` emails are rejected;
  - local demo simulation remains available only when real Google OAuth is not configured.
- Added configured Google OAuth code exchange using Google token and userinfo endpoints.
- Added a React Google callback route at `/login/google/callback` that completes backend code exchange and stores the frontend session.
- Added `POST /auth/password` for local password accounts.
- Updated the frontend profile page with user-facing role-specific text, singular `Role`, black profile detail labels, and an EV-only password form hidden for Google sessions.
- Updated auth-service, frontend, and SPEC documentation for the Google and password behavior.

## Files Changed

Run-owned changes included:

- `services/auth-service/app/models.py`
- `services/auth-service/app/database.py`
- `services/auth-service/app/seed.py`
- `services/auth-service/app/schemas.py`
- `services/auth-service/app/routes.py`
- `services/auth-service/tests/test_auth_api.py`
- `services/auth-service/README.md`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/features/auth/AuthContext.tsx`
- `apps/frontend/src/features/auth/GoogleCallbackPage.tsx`
- `apps/frontend/src/features/auth/LoginPage.tsx`
- `apps/frontend/src/features/auth/ProfilePage.tsx`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `apps/frontend/README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/038-google-ev-password-profile.md`

The worktree already contained additional modified and untracked files from prior runs; they were left intact.

## Tests and Checks

- `docker compose run --rm --no-deps auth-service pytest -q`
  - Result: passed, `18 passed`.
- `npm run test -- --run --reporter=dot` from `apps/frontend/`
  - Result: passed, `27 passed`.
- `npm run build` from `apps/frontend/`
  - Result: passed. Vite reported the existing MapLibre chunk-size warning.
- `docker compose up -d --build auth-service frontend nginx-gateway`
  - Result: completed. Dependent services were rebuilt/recreated by Compose.
- `docker compose restart nginx-gateway`
  - Result: completed. Required because nginx had cached upstream container IPs after service recreation.
- `curl http://localhost:8080/api/auth/health`
  - Result: returned `{"service":"auth-service","status":"healthy"}`.
- Gateway Google login smoke:
  - Result: `/api/auth/auth/google/login?redirect_uri=http://localhost:8080/login/google/callback` returned a Google authorization URL with host `accounts.google.com`, scope `openid email profile`, and the expected frontend callback redirect URI.

## Results

The requested behavior is implemented and documented. Local automated tests cover Google EV provisioning/reuse/rejection rules, configured OAuth redirect and callback exchange behavior, local password changes for EV/provider/operator accounts, Google-only password rejection, and frontend profile/callback behavior.

## Limitations

- Full real Google browser login could not be completed without an interactive external Google account flow. The authorization URL and backend exchange path were validated by tests and gateway smoke checks.
- Browser MCP visual QA could not initialize in this WSL workspace because the browser tool rejected the workspace path metadata. HTTP gateway smoke and frontend unit/build checks were used instead.
- Real Google OAuth deployment requires the Google client to allow `http://localhost:8080/login/google/callback` or the corresponding deployed frontend callback URL.

## Manual Review Notes

- The frontend calls only gateway-relative `/api/...` paths.
- The changes conform to SPEC-8 and SPEC-9 updates made in this run.
- No secrets were added to repository files.
