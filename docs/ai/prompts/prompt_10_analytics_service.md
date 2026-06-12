# Prompt 10 - Analytics Service

## 1. Task

Implement the `analytics-service` MVP baseline for saasPlug.

This prompt must implement only the analytics-service scope. It must use the existing repository state after Prompt 09:

- `auth-service` issues JWT access tokens with roles and provider scope.
- `provider-registry-service` owns provider metadata.
- provider services own provider-local snapshots and provider API calls.
- `catalog-service` owns the aggregated catalog and cached point details.
- `status-service` owns status cache and status-check logs.
- `reservation-service` owns reservation truth and now stages/publishes reservation events through the shared RabbitMQ event infrastructure.
- `packages/events` owns the shared RabbitMQ event envelope, routing constants, topology declarations, publisher/consumer primitives, and idempotency helpers.

The goal of this prompt is to make `analytics-service` consume events, store raw usage events idempotently, compute precomputed aggregates, serve provider/operator analytics dashboards, and export provider usage logs as CSV.

Do **not** implement billing-service business logic. Do **not** create charges, invoices, payments, pricing rules, or billing truth. Analytics may store billing/invoice snapshot-like event projections when billing events are received, but these must be clearly treated as analytics projections, not financial source of truth.

---

## 2. Mandatory sources to read first

Before editing code, read and follow:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/prompts/README.md`
4. `docs/ai/codex-runs/_template.md`
5. `docs/ai/prompt-log.md`
6. `docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md`
7. `packages/events/README.md`
8. `packages/events/saasplug_events/envelope.py`
9. `packages/events/saasplug_events/routing.py`
10. `packages/events/saasplug_events/topology.py`
11. `packages/events/saasplug_events/consumer.py`
12. `packages/events/saasplug_events/idempotency.py`
13. `services/analytics-service/README.md`
14. `services/analytics-service/app/main.py`
15. `services/auth-service/app/security.py`
16. `services/provider-registry-service/app/security.py` or equivalent JWT helpers, if useful
17. `services/catalog-service/app/schemas.py` and `services/status-service/app/schemas.py`, for analytics payload context only
18. `services/reservation-service/app/event_publisher.py`
19. `services/reservation-service/app/models.py`
20. `docker-compose.yml`
21. `.env.example`
22. `deploy/nginx/default.conf`

Also inspect the existing `analytics-service` scaffold, Dockerfile, requirements, and tests directory if present.

---

## 3. Canonical architecture constraints

Follow the accepted specifications exactly:

- `analytics-service` owns analytics projections only.
- `analytics-service` uses `analytics-postgres` only.
- `analytics-service` must not query other service databases.
- `analytics-service` must not call provider APIs.
- `analytics-service` must not own reservation truth, billing truth, catalog truth, or status truth.
- Dashboards must read precomputed aggregate/cache tables, not perform live cross-service joins.
- RabbitMQ is allowed and expected for event ingestion.
- Use the shared `packages/events` event envelope and routing constants.
- Use idempotent event ingestion. Duplicate event IDs must not create duplicate usage rows or duplicate aggregate counts.
- Keep all repository files in English.
- Keep `.env.example` placeholder-only.
- Do not create `.env`.
- Do not add a scheduler/orchestrator container.
- Do not add new runtime services.
- Do not implement frontend screens.

---

## 4. Implementation scope

Implement `analytics-service` with the following behavior.

### 4.1 Analytics-owned persistence

Use SQLAlchemy with the existing MVP startup-table-creation pattern used by prior services.

Create analytics-owned models/tables for at least:

```text
usage_events
provider_hourly_metrics
provider_daily_metrics
point_daily_metrics
operator_daily_metrics
catalog_health_snapshots
billing_summary_snapshots
export_jobs
```

The exact SQLAlchemy class names may follow local style, but the underlying purpose must be clear.

`usage_events` must include at least:

```text
id
event_id unique
event_type
event_version
occurred_at
ingested_at
correlation_id
producer
user_id
provider_code
internal_point_id
external_point_id
point_name
reservation_id
status
amount
currency
payload JSON
```

Use `event_id` uniqueness for idempotency.

Aggregate/cache tables must support provider dashboard, operator dashboard, trends, top points, status distribution, and freshness queries. They may be simple MVP models, but they must be real persisted tables, not in-memory counters.

### 4.2 Event ingestion

Implement event ingestion from canonical `EventEnvelope` objects.

Supported event types must include at least:

```text
usage.search_performed
usage.point_viewed
status.point_checked
reservation.succeeded
reservation.failed
catalog.points.imported
billing.charge_created
billing.invoice_issued
billing.invoice_paid
```

For billing event types, only store analytics projections/snapshots. Do not create billing truth.

Ingestion must:

- validate the common event envelope,
- map known payload fields to `usage_events`,
- preserve the full payload JSON,
- be idempotent by `event_id`,
- not fail permanently on unknown optional payload fields,
- reject or log unsupported event types clearly,
- return deterministic ingest results such as `created`, `duplicate`, or `unsupported`.

### 4.3 RabbitMQ consumer path

Use `packages/events` and RabbitMQ queue `analytics.events`.

Implement a testable consumer/drain function that can consume a limited batch of events from RabbitMQ and ingest them into `analytics-postgres`.

Expose an operator-only endpoint for manual/demo ingestion from RabbitMQ, for example:

```text
POST /events/consume?limit=...
```

This endpoint must:

- require an operator JWT,
- declare topology if needed or use the shared topology helpers,
- consume up to the requested limit from `analytics.events`,
- ack successfully ingested or duplicate events,
- reject/nack unsupported or invalid events according to the shared consumer helper behavior,
- return counts by result.

Do not create a new worker container, scheduler, or orchestrator service.

If you add optional startup topology declaration to `analytics-service`, it must be non-fatal and configurable, as done for reservation-service.

### 4.4 Manual ingest endpoint for deterministic tests

Add an operator-only JSON endpoint for deterministic local tests and demos, for example:

```text
POST /events/ingest
```

It should accept one canonical event envelope or a list of envelopes and ingest them with the same core ingestion function used by the RabbitMQ consumer path.

This endpoint is allowed only for operator/testing/demo use. Document it as an MVP/debug endpoint, not a public production event ingestion API.

### 4.5 Aggregation

Implement aggregate refresh logic.

Expose an operator-only endpoint such as:

```text
POST /aggregates/refresh
```

It must recompute/update aggregate/cache tables from `usage_events`.

Minimum aggregates:

1. Provider hourly metrics:
   - provider code
   - hour bucket
   - searches
   - point views
   - status checks
   - successful reservations
   - failed reservations
   - generated/observed fees or charges as analytics snapshot values only, if events provide them
   - last computed timestamp

2. Provider daily metrics:
   - provider code
   - day bucket
   - same main counters as hourly
   - conversion rate or fields sufficient to compute it

3. Point daily metrics:
   - provider code
   - normalized/internal point ID when available
   - external point ID
   - point name snapshot if available
   - point views
   - successful reservations
   - failed reservations
   - status checks

4. Operator daily metrics:
   - day bucket
   - total searches
   - total point views
   - total status checks
   - successful reservations
   - failed reservations
   - global conversion numerator/denominator

5. Catalog health snapshots:
   - from `catalog.points.imported` events when present
   - provider code
   - active/stale/imported counts where available
   - latest catalog import status where available

6. Billing summary snapshots:
   - from billing event payloads when future billing events arrive
   - provider code
   - invoiced/paid/unpaid values where available
   - must be documented as analytics snapshot/projection, not billing truth.

Manual refresh can truncate/rebuild aggregate rows for MVP if simpler and deterministic, as long as it remains idempotent and documented.

### 4.6 Provider analytics API

Expose provider dashboard endpoints under the existing gateway route `/api/analytics/...`.

Suggested endpoints:

```text
GET /provider/summary
GET /provider/trends/daily
GET /provider/top-points
GET /provider/status-distribution
GET /provider/freshness
GET /provider/export.csv
```

Provider-admin JWT rules:

- provider admins can only access their own provider analytics,
- provider-admin requests must use their JWT provider scope,
- provider admins must not pass an arbitrary provider code to access another provider.

Operator JWT rules:

- operators can request a specific provider via query parameter where applicable,
- operators can view all providers where applicable.

Provider summary should include at least:

```text
provider_code
total_searches
total_point_views
total_status_checks
successful_reservations
failed_reservations
reservation_conversion_rate or null/"N/A"-equivalent when denominator is zero
top_viewed_points
top_reserved_points
status_distribution
data_freshness
last_event_ingested_at
last_aggregate_computed_at
```

### 4.7 Operator analytics API

Expose operator-only endpoints such as:

```text
GET /operator/summary
GET /operator/provider-comparison
GET /operator/trends/daily
GET /operator/catalog-health
GET /operator/freshness
```

Operator summary should include at least:

```text
total_providers_seen
active_providers_seen if derivable from events/snapshots, otherwise documented as projection-limited
total_searches
total_point_views
total_status_checks
successful_reservations
failed_reservations
global_conversion_rate or null/"N/A"-equivalent
provider_comparison
daily_trends
catalog_health
last_event_ingested_at
last_aggregate_computed_at
analytics_delay_notice
```

Do not call provider-registry-service, catalog-service, billing-service, or reservation-service live to fill these dashboards. Use only analytics-owned tables/projections.

### 4.8 CSV export

Implement provider usage-log CSV export.

Endpoint suggestion:

```text
GET /exports/usage.csv?providerCode=...&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Access rules:

- Provider admins can export only their own provider logs.
- Operators can export all providers or filter by provider.

CSV columns must include at least:

```text
occurred_at,event_type,provider_code,internal_point_id,external_point_id,point_name,user_id,reservation_id,status,amount,currency,details
```

`details` may contain compact JSON text from the payload.

Persist an `export_jobs` or export-log record for each export request, including actor email/role/provider scope and row count.

### 4.9 Auth and scoping

Use the same JWT verification pattern as prior services.

Roles:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

Analytics dashboard/export endpoints must be role-gated:

- EV users should not access provider/operator analytics.
- Provider admins can access only their own provider projections.
- Operators can access all provider/operator projections.

### 4.10 Documentation

Update:

- `services/analytics-service/README.md`
- root `README.md`
- `.env.example`
- `docker-compose.yml` if needed
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/010-analytics-service.md`

Document:

- tables owned by analytics-service,
- event ingestion flow,
- RabbitMQ consumer/drain endpoint,
- manual ingest endpoint if implemented,
- aggregate refresh behavior,
- dashboard endpoints,
- CSV export,
- role/provider scoping,
- limitations and non-goals.

If `docs/project_info/*` is auto-generated by repository tooling again, do not hand-edit it unless necessary. If it changes, mention it in the run report.

---

## 5. Required tests

Add deterministic tests for `analytics-service`.

Tests must cover at least:

1. Health endpoint still works.
2. Operator can ingest canonical event envelope(s).
3. Duplicate `event_id` ingestion is idempotent.
4. Unsupported event types are handled deterministically.
5. Aggregate refresh computes provider totals.
6. Reservation success/failure events update relevant metrics.
7. Status checked events update status-check and distribution metrics.
8. Provider admin can access only own provider analytics.
9. Provider admin cannot access another provider's analytics/export.
10. EV user cannot access provider/operator analytics.
11. Operator can access global/operator analytics.
12. CSV export returns required columns and records an export job.
13. RabbitMQ consumer/drain logic can be tested with fake/stub messages or a fake channel without needing live RabbitMQ.
14. The shared `packages/events` package remains importable in the analytics-service container.

Do not rely on live external provider APIs.

---

## 6. Required validation commands

Run and report at least:

```bash
docker compose run --build --rm --no-deps analytics-service pytest -q
```

```bash
docker compose run --rm --no-deps analytics-service python -m pytest /tmp/packages/events/tests -q
```

If the exact `/tmp/packages/events/tests` path is not applicable because of Dockerfile layout, use the correct copied package-test path and document it.

```bash
git diff --check
```

```bash
docker compose config
```

```bash
docker compose up -d --build
```

```bash
docker compose ps
```

```bash
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/analytics/health
```

Also perform a lightweight gateway smoke test that:

1. logs in as operator through `auth-service`,
2. ingests a deterministic event or consumes a deterministic RabbitMQ event if practical,
3. refreshes aggregates,
4. reads operator/provider analytics,
5. exports CSV.

Then clean up:

```bash
docker compose down -v
docker compose ps -a
test ! -f .env
```

---

## 7. GitHub issue/project actions

After all Prompt 10 acceptance criteria pass:

1. Inspect GitHub issue `#10`.
2. Comment with a concise completion summary and the run report path:

```text
docs/ai/codex-runs/010-analytics-service.md
```

3. Close issue `#10` as completed.
4. Verify or update its GitHub Project item to `Done`.

If any GitHub issue/project mutation fails:

- report the failure clearly in the Codex final response,
- record it in `docs/ai/codex-runs/010-analytics-service.md`,
- do not create fallback Markdown project-management artifacts unless explicitly requested.

---

## 8. Explicit non-goals

Do **not** implement:

- billing-service business logic,
- pricing rules,
- charge records,
- invoice generation,
- invoice payment flow,
- financial source-of-truth logic,
- frontend screens,
- provider API calls,
- live cross-service dashboard joins,
- reservation-service changes except if strictly needed to keep event-contract imports stable; avoid reservation changes if possible,
- catalog-service changes,
- status-service changes,
- new runtime containers,
- orchestrator/scheduler services,
- distributed transactions,
- real secrets,
- `.env`,
- fallback Markdown project-management artifacts.

---

## 9. Acceptance criteria

Prompt 10 is acceptable only if:

1. `analytics-service` has real owned persistence for raw usage events and aggregate/cache tables.
2. Event ingestion uses the shared `packages/events` envelope/contracts.
3. Event ingestion is idempotent by `event_id`.
4. Analytics can consume/drain from RabbitMQ queue `analytics.events`, at least through a controlled operator endpoint or testable function.
5. Manual deterministic event ingestion exists for tests/demos.
6. Aggregate refresh computes provider/operator/point metrics from analytics-owned `usage_events`.
7. Provider dashboard endpoints exist and enforce provider-admin scoping.
8. Operator dashboard endpoints exist and are operator-only.
9. CSV export exists with the required columns and access control.
10. No billing source-of-truth logic is implemented.
11. No cross-service DB access is introduced.
12. No provider APIs are called from analytics-service.
13. Tests pass in Docker.
14. Compose config and full stack health checks pass.
15. AI logs and prompt log are updated.
16. GitHub issue `#10` is closed and its Project item is Done, unless a GitHub mutation failure is clearly reported.

---

## 10. Final response format for Codex

Return a concise final report with:

1. Final status: `COMPLETED`, `COMPLETED_WITH_WARNINGS`, or `FAILED`.
2. Files created.
3. Files modified.
4. Validation commands and results.
5. GitHub issue/project actions and results.
6. Warnings or limitations.
7. Explicit confirmation that no out-of-scope billing/frontend/provider/cross-service logic was implemented.
8. Next recommended action:

```text
Review the Prompt 10 diff, then proceed to Prompt 11 for billing-service.
```
