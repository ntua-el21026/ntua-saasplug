# Run 032 - Event Scheduler Cadence and Operator Controls

## Invocation Prompt

```text
1. Implement the missing half events (Event Intended meaning Current state
usage.search_performed User searched the catalog/map Contract exists, live emitter not clearly wired
usage.point_viewed User opened a charging point Contract exists, live emitter not clearly wired
status.point_checked User checked charger status Contract exists, live emitter not clearly wired
catalog.points.imported Catalog import completed Contract/ingest logic exists, live publisher not clearly confirmed)

2. We need to change the intervals of the jobs to:
a. catalog.import.all: every day
b. analytics.consume-events: every 2 hours
c. analytics.refresh-aggregates: every day (also explain difference with b)
d. billing.drain-events: every 12 hours
e. billing.publish-outbox: every 12 hours (explain difference with d)
f. reservation.publish-outbox (explain it only)

Then, make sure that the operator can call all of these live and also change the interval from the UI (important).
```

Follow-up prompt:

```text
Also, document all the changes in the specifications of the app and any other docs
```

## Goal

Wire the remaining documented usage/status/catalog events into live service
flows, adjust scheduler default intervals, expose operator interval editing in
the existing scheduler UI, and update canonical documentation. The change must
preserve the accepted architecture: live user actions remain synchronous and
RabbitMQ publishing is best-effort asynchronous propagation only.

## Implementation Summary

- Added best-effort RabbitMQ event publishing to `catalog-service` for:
  - `usage.search_performed` on the first page of catalog searches.
  - `usage.point_viewed` when a catalog point detail is opened.
  - `catalog.points.imported` after successful provider catalog imports.
- Added best-effort RabbitMQ event publishing to `status-service` for:
  - `status.point_checked` after successful status lookups.
  - `status.point_checked` error envelopes when provider status checks fail.
- Kept RabbitMQ publishing non-blocking for user-facing reads. Publisher setup,
  publish failures, and close failures are swallowed and reported as an internal
  false return value.
- Added catalog/status event publishing configuration with safe `.env.example`
  defaults and Docker Compose wiring.
- Updated catalog/status Dockerfiles so the shared event package is available in
  those images.
- Changed scheduler default interval jobs:
  - `catalog.import.all`: every day.
  - `analytics.consume-events`: every 2 hours.
  - `analytics.refresh-aggregates`: every day.
  - `billing.drain-events`: every 12 hours.
  - `billing.publish-outbox`: every 12 hours.
  - `reservation.publish-outbox`: remains every 60 seconds because it releases
    reservation outcome events after synchronous provider calls.
- Preserved operator-edited scheduler intervals during default job reseeding.
- Added operator UI controls for editing interval-based and cron-based scheduler
  job schedules while preserving manual run, pause/resume, and run-history
  behavior.
- Updated frontend catalog/detail calls to include the access token when
  available, so emitted usage events can include authenticated user context.
- Updated service, frontend, package, architecture, specification, final
  verification, and submission checklist documentation.

## Files Changed

- `.env.example`
- `README.md`
- `apps/frontend/README.md`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `docker-compose.yml`
- `docs/ai/codex-runs/032-event-scheduler-cadence-and-operator-controls.md`
- `docs/ai/prompt-log.md`
- `docs/architecture-summary.md`
- `docs/diagrams/final/sequence-analytics-billing-events.puml`
- `docs/final-verification.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/submission-checklist.md`
- `packages/events/README.md`
- `services/analytics-service/README.md`
- `services/billing-service/README.md`
- `services/catalog-service/Dockerfile`
- `services/catalog-service/README.md`
- `services/catalog-service/app/config.py`
- `services/catalog-service/app/event_publisher.py`
- `services/catalog-service/app/routes.py`
- `services/catalog-service/app/security.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `services/scheduler-service/README.md`
- `services/scheduler-service/app/jobs.py`
- `services/scheduler-service/tests/test_scheduler_service_api.py`
- `services/status-service/Dockerfile`
- `services/status-service/README.md`
- `services/status-service/app/config.py`
- `services/status-service/app/event_publisher.py`
- `services/status-service/app/routes.py`
- `services/status-service/tests/test_status_service_api.py`

## Tests and Checks Run

| Command | Result |
|---|---|
| `docker compose config --quiet` | Pass |
| `cd apps/frontend && npm test -- --run` | Pass: 21 tests |
| `cd apps/frontend && npm run build` | Pass with Vite large-chunk warning |
| `docker compose run --build --rm --no-deps scheduler-service pytest -q` | Pass: 12 tests |
| `docker compose run --build --rm --no-deps catalog-service pytest -q` | Pass: 24 tests |
| `docker compose run --build --rm --no-deps status-service pytest -q` | Pass: 17 tests |
| `docker run --rm -v /home/peppasmich/NTUA-saasPlug:/repo -w /repo python:3.12-slim sh -c 'python -m pip install --quiet pytest /repo/packages/events; PYTHONPATH=packages/events python -m pytest packages/events/tests -q'` | Pass: 10 tests |
| `plantuml -checkonly docs/diagrams/final/*.puml` | Pass |
| `git diff --check` | Pass |

## Results

The requested events are now emitted from live service paths without changing
backend architecture or making user-facing requests depend on RabbitMQ. The
operator scheduler UI can manually run jobs, pause/resume jobs, inspect run
history, and change job schedules through the existing scheduler API.

## Warnings and Limitations

- The frontend production build reports Vite's existing large MapLibre chunk
  warning. The build still succeeds.
- Host direct Python pytest remains unreliable in this workspace because the
  default `python` points to Python 3.14 and previously hit a pytest/Pydantic
  capture issue. Service tests were run in project Docker images and the shared
  event tests were run in an isolated Python 3.12 container.
- RabbitMQ event publishing for catalog/status is intentionally best effort. A
  broker outage must not block map search, point detail, or status lookup.

## Manual Review Notes

- `analytics.consume-events` drains queued raw events into analytics storage.
  `analytics.refresh-aggregates` recomputes precomputed dashboard aggregates
  from stored analytics events. The first step ingests event data; the second
  step refreshes read-model summaries.
- `billing.drain-events` consumes reservation events and creates billing
  charges. `billing.publish-outbox` publishes billing lifecycle events that were
  produced by billing itself. The first step brings external reservation events
  into billing; the second step publishes billing-owned outbound events.
- `reservation.publish-outbox` remains frequent because reservation success or
  failure is produced immediately after synchronous provider calls and should be
  propagated promptly to analytics and billing.
