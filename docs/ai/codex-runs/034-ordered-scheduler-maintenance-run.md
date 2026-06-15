# Run 034 - Ordered Scheduler Maintenance Run

## Invocation Prompt

```text
Good, now also make one action to run them all manually at once (in the proper order).
```

## Goal

Add one operator action that runs the maintenance scheduler jobs manually in
dependency order, while preserving the scheduler control-plane architecture and
service-owned execution.

## Implementation Summary

- Added `ORDERED_MAINTENANCE_JOB_KEYS` to scheduler job definitions.
- Added operator-only `POST /jobs/run-maintenance` in `scheduler-service`.
- The ordered sequence is:
  1. `catalog.import.all`
  2. `reservation.publish-outbox`
  3. `billing.drain-events`
  4. `billing.publish-outbox`
  5. `analytics.consume-events`
  6. `analytics.refresh-aggregates`
- Added a typed frontend response model and a `Run maintenance sequence` button
  on `/operator/sync`.
- Corrected `analytics.refresh-aggregates` default cadence to daily and added a
  seed-migration test for previous two-hour defaults.
- Updated canonical specs, architecture notes, README files, final
  verification, submission checklist, and the AI prompt log.

## Files Changed

- `README.md`
- `apps/frontend/README.md`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `docs/ai/codex-runs/034-ordered-scheduler-maintenance-run.md`
- `docs/ai/prompt-log.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/submission-checklist.md`
- `services/scheduler-service/README.md`
- `services/scheduler-service/app/jobs.py`
- `services/scheduler-service/app/routes.py`
- `services/scheduler-service/app/schemas.py`
- `services/scheduler-service/tests/test_scheduler_service_api.py`

## Tests and Checks Run

| Command | Result |
|---|---|
| `docker compose config --quiet` | Pass |
| `docker compose run --build --rm --no-deps scheduler-service pytest -q` | Pass: 14 tests |
| `cd apps/frontend && npm test -- --run` | Pass: 23 tests |
| `cd apps/frontend && npm run build` | Pass with Vite large-chunk warning |
| `git diff --check` | Pass |
| `docker compose down; docker compose ps -a` | Pass: no Compose containers remained |

## Results

Operators can now run the maintenance chain through one gateway API call and
one UI button. The scheduler records each underlying job as a normal run with
trigger type `manual_sequence`, preserving run history and target service
ownership.

## Warnings and Limitations

- The frontend build still reports Vite's existing large MapLibre chunk warning.
- This action runs the configured internal jobs in order. It does not add a
  distributed transaction or rollback. If one job fails, the response reports
  `completed_with_failures` and includes the individual run statuses.

## Manual Review Notes

The sequence intentionally runs billing before analytics consumption so billing
can publish billing-owned outbox events before analytics drains and refreshes
dashboard aggregates.
