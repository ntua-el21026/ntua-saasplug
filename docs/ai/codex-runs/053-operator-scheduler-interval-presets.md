# Run 053 - Operator Scheduler Interval Presets

## Invocation Prompt

Add two buttons in the operator Sync page Scheduler control plane: `Apply
minimum`, to apply the minimum permitted value to all jobs for live testing,
and `Reset defaults`, to restore the documented real values. The supplied
screenshot path was unavailable locally, so the written requirement was used.

## Goal

Provide operator-only bulk controls for the existing interval scheduler jobs
without changing cron/manual jobs, provider behavior, or service ownership.

## Canonical Sources Read

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `apps/frontend/README.md`
- `services/scheduler-service/README.md`
- `services/scheduler-service/app/jobs.py`

## Implementation Summary

- Added operator-only scheduler APIs that apply the validated 30-second minimum
  interval or restore values sourced from `DEFAULT_JOBS`.
- Added the two controls to the operator Scheduler control plane and refresh the
  job table after either preset succeeds.
- Added backend authorization/default restoration coverage and frontend route
  coverage.

## Files Changed

- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/README.md`
- `services/scheduler-service/app/routes.py`
- `services/scheduler-service/app/schemas.py`
- `services/scheduler-service/tests/test_scheduler_service_api.py`
- `services/scheduler-service/README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/053-operator-scheduler-interval-presets.md`

## Validation

- `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_scheduler_service_api.py`:
  passed, 20 tests. The Python 3.14/Pydantic v1 compatibility warning remains
  pre-existing.
- `npm test`: passed, 4 frontend test files and 43 tests.
- `npm run build`: passed (`tsc --noEmit && vite build`). The ignored
  `apps/frontend/dist/` build output was regenerated.
- `npm run dev -- --host 127.0.0.1 --port 5173`: started the local Vite server.
  `curl -fsS -o /dev/null -w "%{http_code}\\n" http://127.0.0.1:5173/` returned
  `200`.

## Limitations

- The supplied screenshot path was unavailable locally.
- No live scheduler cadence was changed during validation.
- No provider action, invoice issuance, or reservation mutation is triggered by
  these controls.
