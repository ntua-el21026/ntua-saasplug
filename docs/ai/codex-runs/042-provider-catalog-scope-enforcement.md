# Codex Run 042 - Provider Catalog Scope Enforcement

## Invocation Prompt

```text
Κάθε provider όταν συνδέεται θα πρέπει στη λίστα των σημείων να βλέπει μόνο τα δικά του!
```

## Canonical Task Prompt

None. This was a direct corrective implementation prompt.

## Goal

Ensure that every signed-in provider admin sees only charging points belonging to their own provider in the provider points list.

## Implementation Summary

- Added catalog-service provider-scope enforcement for authenticated `PROVIDER_ADMIN` requests to `GET /points`.
- Provider admins without a provider scope now receive `403`.
- Provider admins requesting another provider through `providerCode` now receive `403`.
- Provider admins without an explicit `providerCode` query are automatically scoped to their own `provider_code` from the JWT.
- Added frontend fail-closed filtering on provider dashboard and provider points data before render.
- Filtered provider points availability freshness rows to the signed-in provider.
- Added backend tests for provider-scoped catalog listing and rejecting another provider filter.
- Added frontend routing/UI test proving the provider points page requests `providerCode=redPlug` and hides mixed green provider rows for a red provider admin.
- Updated catalog-service README authorization documentation.

## Files Changed

- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `services/catalog-service/README.md`
- `services/catalog-service/app/routes.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/042-provider-catalog-scope-enforcement.md`

The working tree already contained additional modified files from earlier runs; those are not listed here as part of this run unless they were touched for this prompt.

## Tests and Checks Run

| Command | Result |
|---|---|
| `PYTHONPATH=/home/peppasmich/NTUA-saasPlug/packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest tests/test_catalog_service_api.py -q -s --tb=short` from `services/catalog-service/` | Passed: 27 tests, 1 Python 3.14/Pydantic compatibility warning. |
| `npm test -- --run src/test/admin-routing.test.tsx` from `apps/frontend/` | Passed: 20 tests. |
| `npm test` from `apps/frontend/` | Passed: 4 files, 30 tests. |
| `npm run build` from `apps/frontend/` | Passed: TypeScript and Vite production build completed. Vite reported the existing MapLibre large chunk warning. |
| `git diff --check` | Passed. |
| `curl -I --max-time 5 http://localhost:8080/provider/points` | Passed: nginx returned HTTP 200. |

## Live QA Notes

- The flow under test was: `/provider/points` -> signed-in provider admin state -> point inventory must render only the signed-in provider's rows.
- Rendered browser automation was not completed because the Browser/Node REPL tool failed with `sandboxCwd is not a local file URI: file:///home/peppasmich/NTUA-saasPlug`.
- No local browser fallback was used; behavior is covered by focused frontend tests and gateway endpoint smoke.

## Specification Conformance

- Conforms to SPEC-1 and SPEC-9: provider admins are always scoped to their own provider and cannot view other providers.
- Frontend calls remain gateway-relative `/api/...` routes.
- No provider adapter, provider API, database migration, deployment, Vercel action, or secret handling was changed.

## Limitations

- The provider points detail page already had frontend own-provider protection from the previous run; this run adds list endpoint enforcement and provider list fail-closed rendering.
- Host direct `pytest -q` without the documented workaround still hits the known local Python 3.14 pytest capture issue; the service-local workaround passed.

## Assistant Response Summary

The final response should state that provider point lists are now scoped at both backend and frontend layers, list changed files, mention tests passed, and note the browser automation limitation.
