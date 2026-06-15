# saasPlug Submission Checklist

Use this checklist before packaging or presenting the final course submission.

## Canonical Sources

| Item | Status | Evidence |
|---|---|---|
| Repository instructions present | Done | `AGENTS.md` |
| Accepted specifications present | Done | `docs/specs/SPECIFICATIONS.md` |
| Assignment materials preserved | Done | `docs/assignment/` |
| Lecture materials preserved | Done | `docs/lectures/` |
| Provider OpenAPI YAML preserved | Done | `docs/assignment/providers/yaml/` |

## Architecture and Runtime

| Item | Status | Evidence |
|---|---|---|
| One role-based frontend app | Done | `apps/frontend/` |
| Nginx gateway | Done | `deploy/nginx/default.conf` |
| FastAPI backend services | Done | `services/` |
| RabbitMQ event infrastructure | Done | `packages/events/` |
| Live usage/status/catalog import event producers | Done | `services/catalog-service/`, `services/status-service/`, and `packages/events/README.md` |
| Separate PostgreSQL container per stateful service | Done | `docker-compose.yml` |
| Scheduler control plane | Done | `services/scheduler-service/` and `scheduler-postgres` |
| No MongoDB in MVP | Done | No MongoDB runtime files present |
| No dedicated orchestrator service | Done | No orchestrator container/service present |
| Provider services are internal | Done | Gateway does not expose provider-service routes |
| Scheduler internal job endpoints are internal | Done | Gateway exposes `/api/scheduler/*` only and returns 404 for `/api/catalog/internal/`, `/api/analytics/internal/`, `/api/billing/internal/`, and `/api/reservations/internal/` |

## Service Coverage

| Service | Status | Evidence |
|---|---|---|
| `auth-service` | Done | `services/auth-service/README.md` |
| `provider-registry-service` | Done | `services/provider-registry-service/README.md` |
| `red-provider-service` | Done | `services/red-provider-service/README.md` |
| `green-provider-service` | Done | `services/green-provider-service/README.md` |
| `blue-provider-service` | Done | `services/blue-provider-service/README.md` |
| `catalog-service` | Done | `services/catalog-service/README.md` |
| `status-service` | Done | `services/status-service/README.md` |
| `reservation-service` | Done | `services/reservation-service/README.md` |
| `analytics-service` | Done | `services/analytics-service/README.md` |
| `billing-service` | Done | `services/billing-service/README.md` |
| `scheduler-service` | Done | `services/scheduler-service/README.md` |

## Frontend Coverage

| Area | Status | Evidence |
|---|---|---|
| Login/register/logout/session | Done | `apps/frontend/README.md` |
| EV map/search/list/details/status/reservations/profile | Done | `apps/frontend/README.md` |
| Provider dashboard/points/analytics/invoices/export/settings | Done | `apps/frontend/README.md` |
| Operator dashboard/providers/analytics/catalog/invoices/pricing/sync/system | Done | `apps/frontend/README.md` |
| Operator scheduler health/jobs/manual runs/run history | Done | `apps/frontend/src/features/admin/AdminPages.tsx` |
| Operator scheduler interval and cron editing | Done | `apps/frontend/src/features/admin/AdminPages.tsx` |
| Operator ordered maintenance sequence | Done | `/operator/sync` calls `/api/scheduler/jobs/run-maintenance` through the gateway |
| Gateway-only frontend API calls | Done | `apps/frontend/src/lib/api.ts` and final static checks |

## Final Documentation

| Item | Status | Evidence |
|---|---|---|
| Root README finalized | Done | `README.md` |
| Architecture summary | Done | `docs/architecture-summary.md` |
| Final verification report | Done | `docs/final-verification.md` |
| Submission checklist | Done | `docs/submission-checklist.md` |
| Final diagram README | Done | `docs/diagrams/final/README.md` |
| AI prompt log updated | Done | `docs/ai/prompt-log.md` |
| README documentation polish | Done | `docs/ai/codex-runs/023-readme-documentation-polish.md` |

## Final UML Diagrams

| Diagram | Status | File |
|---|---|---|
| Use case | Done | `docs/diagrams/final/use-case.puml` |
| Component | Done | `docs/diagrams/final/component.puml` |
| Deployment | Done | `docs/diagrams/final/deployment.puml` |
| Data model | Done | `docs/diagrams/final/data-model.puml` |
| Search/reservation activity | Done | `docs/diagrams/final/activity-search-reservation.puml` |
| Provider sync activity | Done | `docs/diagrams/final/activity-provider-sync.puml` |
| Invoice/payment activity | Done | `docs/diagrams/final/activity-invoice-payment.puml` |
| Login sequence | Done | `docs/diagrams/final/sequence-login.puml` |
| Map search sequence | Done | `docs/diagrams/final/sequence-search-map.puml` |
| Status lookup sequence | Done | `docs/diagrams/final/sequence-status-lookup.puml` |
| Reservation sequence | Done | `docs/diagrams/final/sequence-reservation.puml` |
| Provider sync/catalog import sequence | Done | `docs/diagrams/final/sequence-provider-sync-catalog-import.puml` |
| Analytics/billing events sequence | Done | `docs/diagrams/final/sequence-analytics-billing-events.puml` |

## Verification

| Item | Status | Evidence |
|---|---|---|
| Frontend tests | Done | `docs/final-verification.md` |
| Frontend build | Done | `docs/final-verification.md` |
| Shared event package tests | Done | `docs/final-verification.md` |
| Docker Compose config | Done | `docs/final-verification.md` |
| Docker Compose startup and health | Done | `docs/final-verification.md` |
| Gateway health smoke | Done | `docs/final-verification.md` |
| Authenticated EV/provider/operator smoke | Done | `docs/final-verification.md` |
| Final static forbidden-pattern checks | Done | `docs/ai/codex-runs/014-final-docs-uml.md` |
| Phase A finalization audit | Done with warning | `docs/ai/codex-runs/015-finalization-project-audit.md` |
| GitHub finalization project setup | Done | GitHub Project #2 with Phase A-D issues |
| PlantUML validation and render | Done | `docs/final-verification.md` |
| Dockerized backend service tests | Done | `docs/final-verification.md` |
| Phase B live environment verification | Done with warnings | `docs/ai/codex-runs/016-live-env-verification.md` |
| Phase C scheduler control-plane implementation | Done | `docs/ai/codex-runs/018-scheduler-control-plane-implementation.md` |
| Phase C gateway internal-job hardening | Done | `docs/final-verification.md` |
| Phase D application test expansion | Done | `docs/ai/codex-runs/019-phase-d-test-expansion.md` |
| Comprehensive test expansion | Done with warning | 184 verified tests; transient catalog/status startup retry documented in `docs/ai/codex-runs/020-comprehensive-test-expansion-and-project-closure.md` |
| Finalization GitHub Project #2 closure | Done | Project `saasPlug Finalization and Hardening` closed after Phase A-D completion |
| Final verification-only audit | Done with warnings | 184 verified tests and full Docker/gateway/authenticated/scheduler smokes documented in `docs/ai/codex-runs/021-final-verification-only.md` |
| Final audit/documentation Project #3 setup | Done | GitHub Project `saasPlug Final Audit and Documentation` contains issue #19 for this audit and issue #20 for full README documentation |
| Live `.env` full verification | Done with warnings | Live provider reads, live `.env` Docker/gateway/auth/scheduler/catalog/status checks, and 184 tests documented in `docs/ai/codex-runs/022-live-env-full-verification.md` |
| Final audit issue #19 | Done | Issue #19 closed and moved to `Done` in GitHub Project #3 |
| README documentation issue #20 | Done | Issue #20 closed and moved to `Done` in GitHub Project #3 after README polish validation |
| Usage/status/catalog event and scheduler cadence update | Done with warning | Live event emitters, editable scheduler intervals, and targeted validation documented in `docs/ai/codex-runs/032-event-scheduler-cadence-and-operator-controls.md` |
| Ordered scheduler maintenance run | Done | Single operator action and ordered scheduler API documented in `docs/ai/codex-runs/034-ordered-scheduler-maintenance-run.md` |

## Manual Review Notes

- Use `.env.example` only as a template. Do not submit a real `.env`.
- Prompt 15 found a local ignored root `.env` file during verification. It was
  not read, modified, printed, or committed by the audit, but it should be
  removed before packaging if the submission process copies ignored files.
- Live external provider behavior depends on real provider credentials outside
  the committed repository.
- Prompt 16 verified live provider read-only list and detail/status checks for
  redPlug, greenPlug, and bluePlug with Bearer provider auth. Live reservation
  mutations were intentionally not run.
- Prompt 16 closed Phase B issue #16 and moved its Project #2 item to `Done`.
- Prompt 18 added scheduler-service as a control plane only. Business logic and
  data ownership remain inside catalog, analytics, billing, and reservation
  services.
- Phase C hardening returns 404 for gateway attempts to reach service-owned
  internal job prefixes while preserving `/api/scheduler/*` and scheduler
  Docker-internal job execution.
- Prompt 19 expanded service-local, frontend, shared event, and root gateway
  tests. Phase D issue #17 was closed and moved to `Done`.
- Prompt 20 expanded the suite to 184 verified tests, kept `.env` untracked,
  validated gateway/authenticated/scheduler smokes, and closed GitHub Project
  #2 after all Phase A-D work was complete.
- Prompt 21 reran final verification using `.env.example` to avoid reading the
  local ignored `.env`, confirmed 184 tests and Docker/gateway/authenticated
  scheduler smokes, skipped live provider checks because credentials were not
  exported outside `.env`, and created GitHub Project #3 with audit and README
  documentation tasks.
- Prompt 22 reran final verification with the live local `.env` as private
  runtime input, verified live provider read-only checks for all three
  providers, verified live catalog/status reads through service-owned flows,
  closed issue #19, and left issue #20 open. Full browser Google OAuth callback
  and live reservation mutation remained skipped by safety/tooling policy.
- Prompt 23 completed the repository-wide README documentation polish, removed
  stale prompt/process wording from user-facing README files, confirmed 35
  generated/cache-free README files, closed issue #20, and moved its GitHub
  Project #3 item to `Done`.
- Prompt 32 wired the remaining best-effort usage/status/catalog event
  publishers, changed scheduler default cadence, added operator schedule
  editing in the scheduler UI, and updated canonical specs and service docs.
- Prompt 34 added one operator action to run the maintenance job chain in
  dependency order through scheduler-service while preserving service-owned
  execution.
- Browser automation and Figma validation were not performed in Prompt 14
  because no callable browser tool or usable Figma source was available.
