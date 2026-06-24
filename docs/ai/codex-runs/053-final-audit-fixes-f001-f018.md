# Run 053 - Final Audit Fixes F-001 Through F-018

## Invocation Prompt

This run continued from the attached final-audit implementation prompt after
context compaction. The active task was to implement final audit fixes F-001
through F-018 with safe hardening only, no architecture replacement, no `.env`
modification or disclosure, no Vercel/deployment work, no git staging/commit,
and no live provider reservation mutations.

The user added one live clarification during the run:

> I want you to still keep password prefills

Because embedding demo passwords in browser-delivered code was the core F-001
risk, the implemented compromise preserves presenter convenience by keeping the
password currently typed in the login form when a role shortcut is clicked. The
frontend no longer reads demo password environment variables or bundles a demo
password.

## Goal

Close the final audit hardening findings F-001 through F-018 and verify them
with broad local tests plus Docker/gateway runtime smoke checks.

## Scope

- Frontend auth/login, Google callback, profile password change, reservation
  ambiguous-outcome UI, API guard tests, and production Docker serving.
- Nginx gateway hardening and docs/internal route blocking.
- Auth OAuth state/PKCE and refresh-token revocation behavior.
- Reservation role guard, provider response validation, expiry validation,
  ambiguous provider/local failure handling, and provider-admin response
  minimization.
- Status provider-log privacy and cache-refresh single-flight behavior.
- Catalog import rollback behavior.
- Billing provider-admin response minimization, invoice-line uniqueness, and
  operator-only billing event drain.
- Scheduler job timeout enforcement, stale running-run recovery, and canonical
  documentation alignment.
- Project docs and AI logs.

## Implementation Summary

- Removed frontend access to `DEMO_USER_PASSWORD` and `VITE_DEMO_*` password
  variables and constrained Vite browser env exposure to `VITE_`.
- Added a production frontend Docker image using Nginx to serve Vite build
  output and a frontend `/health` endpoint.
- Added gateway security headers and 404 blocks for public docs/openapi and
  service-owned internal job routes.
- Added OAuth state/PKCE storage and validation, and revoked existing refresh
  tokens after password change.
- Restricted reservation creation to `EV_USER`.
- Treated provider timeout, malformed success responses, missing/invalid/past
  reservation expiry, and local persistence failure after provider success as
  ambiguous outcomes requiring reconciliation rather than immediate retry.
- Minimized provider-admin reservation/status/billing response payloads so they
  no longer expose cross-user identifiers or raw event payloads.
- Added status-service per-point single-flight refresh to reduce duplicate
  provider calls after cache expiry.
- Wrapped catalog point mutations in a nested transaction during provider import
  so a failed import preserves the previous catalog.
- Added billing invoice-line uniqueness by charge and removed the misleading
  provider-scoped billing refresh route.
- Enforced scheduler per-job request timeouts and recovered stale running runs.
- Updated READMEs, architecture/spec docs, final verification, submission
  checklist, and AI logs.

## Files Changed

- `.env.example`
- `AGENTS.md`
- `README.md`
- `docker-compose.yml`
- `apps/frontend/Dockerfile`
- `apps/frontend/nginx.conf`
- `apps/frontend/README.md`
- `apps/frontend/vite.config.ts`
- `apps/frontend/src/vite-env.d.ts`
- `apps/frontend/src/features/auth/AuthContext.tsx`
- `apps/frontend/src/features/auth/GoogleCallbackPage.tsx`
- `apps/frontend/src/features/auth/LoginPage.tsx`
- `apps/frontend/src/features/auth/ProfilePage.tsx`
- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/lib/api.ts`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `apps/frontend/src/test/frontend-secret-boundary.test.ts`
- `deploy/nginx/README.md`
- `deploy/nginx/default.conf`
- `docs/architecture-summary.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/053-final-audit-fixes-f001-f018.md`
- `services/auth-service/README.md`
- `services/auth-service/app/models.py`
- `services/auth-service/app/routes.py`
- `services/auth-service/app/schemas.py`
- `services/auth-service/tests/test_auth_api.py`
- `services/billing-service/README.md`
- `services/billing-service/app/invoicing.py`
- `services/billing-service/app/models.py`
- `services/billing-service/app/routes.py`
- `services/billing-service/tests/test_billing_service_api.py`
- `services/catalog-service/app/importer.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `services/reservation-service/README.md`
- `services/reservation-service/app/provider_client.py`
- `services/reservation-service/app/reservation_logic.py`
- `services/reservation-service/app/routes.py`
- `services/reservation-service/app/schemas.py`
- `services/reservation-service/app/security.py`
- `services/reservation-service/tests/test_reservation_service_api.py`
- `services/scheduler-service/README.md`
- `services/scheduler-service/app/client.py`
- `services/scheduler-service/app/executor.py`
- `services/scheduler-service/app/main.py`
- `services/scheduler-service/tests/test_scheduler_service_api.py`
- `services/status-service/README.md`
- `services/status-service/app/routes.py`
- `services/status-service/app/status_logic.py`
- `services/status-service/tests/test_status_service_api.py`

## Validation

- `python -m compileall services/auth-service/app services/reservation-service/app services/status-service/app services/catalog-service/app services/billing-service/app services/scheduler-service/app`: passed.
- `cd services/auth-service && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_auth_api.py`: 25 passed, 1 warning.
- `cd services/reservation-service && PYTHONPATH=.:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_reservation_service_api.py`: 42 passed, 1 warning.
- `cd services/catalog-service && PYTHONPATH=.:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_catalog_service_api.py`: 33 passed, 1 warning.
- `cd services/status-service && PYTHONPATH=.:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_status_service_api.py`: 21 passed, 1 warning.
- `cd services/billing-service && PYTHONPATH=.:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_billing_service_api.py`: 28 passed, 1 warning.
- `cd services/scheduler-service && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_scheduler_service_api.py`: 19 passed, 1 warning.
- `cd apps/frontend && npm test`: 5 files passed, 43 tests passed.
- `cd apps/frontend && npx tsc --noEmit`: passed.
- `cd apps/frontend && npm run build`: passed; build output was written to ignored `apps/frontend/dist`.
- `cd apps/frontend && rg -n "DEMO_USER_PASSWORD|VITE_DEMO|change-me-demo-password|demo-password" dist || true`: no matches.
- `PYTHONPATH=packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s packages/events/tests`: 10 passed.
- `cd services/analytics-service && PYTHONPATH=.:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_analytics_service_api.py`: 26 passed, 1 warning.
- `cd services/provider-registry-service && PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_provider_registry_api.py`: 12 passed, 1 warning.
- `cd services/red-provider-service && PYTHONPATH=.:../../packages/provider-normalization:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_provider_service_api.py`: 10 passed, 1 warning, plus a temporary-directory cleanup warning from pytest after the parallel run.
- `cd services/green-provider-service && PYTHONPATH=.:../../packages/provider-normalization:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_provider_service_api.py`: 10 passed, 1 warning.
- `cd services/blue-provider-service && PYTHONPATH=.:../../packages/provider-normalization:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_provider_service_api.py`: 10 passed, 1 warning.
- `git diff --check`: passed.
- `docker compose config --quiet`: passed.
- `docker compose up -d --build`: passed.
- `docker compose ps`: all services healthy.
- Gateway smoke via `localhost:8080`: `/health`, `/`, `/login`, and public service health routes returned HTTP 200.
- Gateway security header smoke: `/` returned CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and COOP headers after `docker compose restart nginx-gateway`.
- Gateway block smoke: tested docs/openapi/internal paths returned HTTP 404.
- Authenticated read-only role smoke using `.env` as private input: EV `/me` returned 200, EV operator analytics returned 403, red-admin own provider summary returned 200, red-admin greenPlug summary returned 403, and operator analytics returned 200.

Total test count in this run: 289 passing tests.

## Limitations

- Browser console/network automation was not run. Playwright was not installed,
  and the Node REPL module-path setup failed for the WSL path. No dependency was
  installed solely for this audit.
- Live provider reservation mutation was intentionally not run.
- Existing Docker volumes were reused for runtime smoke. Model-level uniqueness
  additions are verified in fresh test databases; existing local volumes may
  need recreation if a demo environment requires physical constraints to be
  recreated in already-existing PostgreSQL tables.
- `.env` was used only as private runtime input for Docker and authenticated
  role smoke. Values and tokens were not printed.

## Manual Review Notes

- Before packaging, confirm ignored local artifacts such as `.env` and
  `apps/frontend/dist/` are not included.
- For presentation convenience, presenters can type the shared demo password
  once and use role shortcut buttons without clearing it. The password is no
  longer prefilled from browser-visible configuration.
