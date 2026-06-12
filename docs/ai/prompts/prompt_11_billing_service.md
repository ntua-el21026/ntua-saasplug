# Prompt 11 - Billing Service

## 1. Task

Implement **only** the `billing-service` MVP scope for the saasPlug project.

This prompt must be executed after Prompt 10 has completed successfully.

The billing service is the financial source of truth for pricing rules, charge records, invoices, invoice lines, and mock payments. It must consume billing-relevant events through the shared RabbitMQ event infrastructure and expose role-scoped billing APIs through the existing Nginx gateway route.

Do **not** implement frontend screens, analytics business logic, provider adapters, real payment integration, real tax/accounting compliance, or new runtime containers.

---

## 2. Mandatory canonical context

Before making changes, read and follow:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/prompt-log.md
docs/ai/codex-runs/010-analytics-service.md
packages/events/README.md
packages/events/saasplug_events/envelope.py
packages/events/saasplug_events/routing.py
packages/events/saasplug_events/topology.py
packages/events/saasplug_events/publisher.py
packages/events/saasplug_events/consumer.py
packages/events/saasplug_events/idempotency.py
services/billing-service/README.md
services/billing-service/app/main.py
services/billing-service/Dockerfile
services/billing-service/requirements.txt
services/analytics-service/README.md
services/analytics-service/app/schemas.py
services/reservation-service/app/models.py
services/reservation-service/app/event_publisher.py
docker-compose.yml
.env.example
deploy/nginx/default.conf
```

Also inspect relevant tests from existing services to preserve established patterns:

```text
services/analytics-service/tests/test_analytics_service_api.py
services/reservation-service/tests/test_reservation_service_api.py
services/status-service/tests/test_status_service_api.py
```

If any mandatory file is missing, report the issue before proceeding unless this prompt explicitly asks you to create it.

---

## 3. Canonical specification anchors

Follow the accepted specification decisions, especially:

- `billing-service` owns pricing rules, charge records, invoices, invoice lines, and payments.
- `billing-postgres` is the financial source of truth.
- Charges are created from events.
- `reservation.succeeded` creates a reservation success charge.
- `usage.point_viewed` creates a point-view charge only if enabled by the active pricing rule.
- `reservation.failed` creates no charge by default.
- Charge records must be idempotent by `source_event_id`.
- Only the operator can issue official invoices.
- Provider admins can view and pay issued invoices for their own provider.
- Mock payment is full-invoice only.
- No real payment gateway, refunds, partial payments, subscriptions, complex tiers, or tax/accounting compliance.
- Billing may publish billing events such as `billing.charge_created`, `billing.invoice_issued`, and `billing.invoice_paid`.
- Analytics may consume billing events/snapshots, but analytics is not billing truth.
- Do not use RabbitMQ for direct frontend actions.
- Do not create a scheduler, orchestrator, worker container, or distributed transaction mechanism.

---

## 4. Required implementation scope

### 4.1 Replace the billing scaffold with a real FastAPI service

Replace the current health-only `billing-service` scaffold with a service that keeps:

```text
GET /
GET /health
GET /ready
```

and adds the billing API routes described below.

Use the same service-local structure used by recent services:

```text
services/billing-service/app/config.py
services/billing-service/app/database.py
services/billing-service/app/models.py
services/billing-service/app/schemas.py
services/billing-service/app/security.py
services/billing-service/app/event_ingestion.py
services/billing-service/app/event_publisher.py
services/billing-service/app/pricing.py
services/billing-service/app/invoicing.py
services/billing-service/app/routes.py
```

Reasonable equivalent names are acceptable if the service remains clear and maintainable.

### 4.2 Database ownership and startup initialization

Use `billing-postgres` through `DATABASE_URL`.

Maintain the current MVP pattern used by previous services: initialize owned SQLAlchemy tables at startup. Do not introduce Alembic unless the repository has already standardized on it.

Create billing-owned tables equivalent to:

```text
pricing_rules
charge_records
billing_events
invoices
invoice_lines
payments
billing_event_outbox
```

Minimum required behavior:

- `pricing_rules`
  - Global default pricing rule.
  - Provider-specific override rules.
  - Active/inactive status.
  - Currency, default `EUR`.
  - Reservation success fee.
  - Point view fee and point-view enabled flag.
  - Reservation failure fee, default `0.00`.
  - Created/updated metadata.

- `charge_records`
  - Unique `source_event_id` for idempotency.
  - Provider code.
  - Event type.
  - Charge type, e.g. `reservation_success`, `point_view`, `reservation_failure`.
  - Amount, currency.
  - Status: `unbilled`, `invoiced`, `paid`, `void`.
  - Optional reservation/point/user references from event payload.
  - Snapshot of pricing rule used.
  - Raw event payload snapshot.

- `billing_events`
  - Idempotent record of consumed event envelopes.
  - `event_id` unique.
  - Event type, producer, correlation ID, occurred/ingested timestamps.
  - Provider code and useful extracted references.
  - Result: `charged`, `skipped`, `duplicate`, `unsupported`, or `failed`.
  - Error metadata where relevant.

- `invoices`
  - Provider code.
  - Invoice number.
  - Billing period start/end.
  - Subtotal, tax amount, total amount, currency.
  - Status: `draft`, `issued`, `paid`, `cancelled`.
  - Issued/paid timestamps.
  - Created by operator metadata where available.

- `invoice_lines`
  - Invoice ID.
  - Charge ID.
  - Description.
  - Amount, currency.
  - Source event ID.

- `payments`
  - Invoice ID.
  - Provider code.
  - Amount, currency.
  - Status, e.g. `succeeded`.
  - Mock payment reference.
  - Paid by user metadata.

- `billing_event_outbox`
  - Canonical event envelope fields.
  - Event type: `billing.charge_created`, `billing.invoice_issued`, `billing.invoice_paid`.
  - Publish status/attempt/error metadata.

### 4.3 Seed default pricing

Seed pricing idempotently at startup:

```text
global default active rule
reservation_success_fee = 0.50 EUR
point_view_fee = 0.01 EUR
point_view_fee_enabled = true
reservation_failure_fee = 0.00 EUR
```

Provider-specific overrides must be supported by API but do not need to be seeded unless useful for tests.

### 4.4 Event ingestion

Implement canonical event ingestion using `packages/events`.

Supported event types:

```text
reservation.succeeded
reservation.failed
usage.point_viewed
```

Behavior:

- `reservation.succeeded`
  - Create exactly one unbilled charge per unique `event_id`.
  - Use provider-specific active pricing if present; otherwise use global active pricing.
  - Use reservation success fee.
  - Stage a `billing.charge_created` outbox event.

- `usage.point_viewed`
  - Create exactly one unbilled charge per unique `event_id` only if point-view fee is enabled by the active pricing rule.
  - If disabled, record the event as skipped without creating a charge.
  - Stage a `billing.charge_created` outbox event only when a charge is created.

- `reservation.failed`
  - By default, record the event as skipped and create no charge.
  - If a future pricing rule has a positive failure fee, the design may allow charging, but the MVP default must remain no charge.

- Duplicate events must not create duplicate charges, duplicate invoice lines, or duplicate outbox events.

- Unsupported event types must return deterministic `unsupported` ingestion results and must not create charges.

### 4.5 RabbitMQ billing queue drain

Use the shared RabbitMQ package from `packages/events`.

Implement an operator-only endpoint that drains a bounded number of events from the billing queue:

```text
POST /events/drain
```

It should read from the billing queue defined by the shared event package, currently `billing.reservations`, and process messages using the shared envelope and consumer helper.

Required properties:

- Bounded batch size from request or environment.
- Safe handling of invalid envelopes.
- Ack successfully handled messages.
- Reject invalid/unsupported poison messages where appropriate.
- Requeue only transient processing failures where that is clearly safe.
- Return a deterministic summary of processed, charged, skipped, duplicate, unsupported, failed counts.

Do not create a new worker, scheduler, or runtime container. Manual drain endpoint is enough for this prompt.

If the existing shared event topology does not bind `usage.point_viewed` to a billing queue, make the smallest necessary update to `packages/events` so the billing service can consume supported point-view events. Update package tests accordingly. Do not redesign the topology.

### 4.6 Billing event publishing

Implement billing outbox publishing using `packages/events`.

Required billing event types:

```text
billing.charge_created
billing.invoice_issued
billing.invoice_paid
```

Expose an operator-only endpoint:

```text
POST /events/outbox/publish-pending
```

Behavior:

- Convert pending billing outbox rows to canonical `EventEnvelope` messages.
- Publish to the configured `saasplug.events` exchange.
- Mark successful rows as published.
- Preserve failed rows as pending with attempt/error metadata.
- Declare topology before publishing where appropriate, reusing the existing shared infrastructure pattern.

Do not implement analytics logic here. Publishing billing events is allowed because billing owns billing events and analytics may consume them later.

### 4.7 Pricing APIs

Implement role-scoped pricing endpoints.

Suggested endpoints:

```text
GET  /pricing/rules
POST /pricing/rules
PATCH /pricing/rules/{rule_id}
GET  /pricing/effective/{provider_code}
```

Authorization:

- `OPERATOR`
  - Can list all rules.
  - Can create/update global and provider-specific rules.
  - Can read effective pricing for any provider.

- `PROVIDER_ADMIN`
  - Can read effective pricing for own provider only.
  - Cannot create or update pricing rules.

- `EV_USER`
  - No billing access.

### 4.8 Charge APIs

Implement role-scoped charge endpoints.

Suggested endpoints:

```text
GET /charges
GET /charges/{charge_id}
```

Authorization:

- `OPERATOR` can view all charges or filter by provider/date/status.
- `PROVIDER_ADMIN` can view own provider charges only.
- `EV_USER` cannot view charges.

### 4.9 Invoice APIs

Implement invoice issuance and viewing.

Suggested endpoints:

```text
POST /invoices/issue
GET  /invoices
GET  /invoices/{invoice_id}
```

Issue invoice request should include at least:

```text
provider_code
period_start
period_end
```

Behavior:

- Operator-only invoice issuance.
- Include unbilled charges for the provider whose source event occurred inside the billing period.
- Create invoice lines from those charges.
- Set charge status to `invoiced`.
- Use status `issued` by default; no draft workflow is required unless simple.
- Tax amount should be `0.00` by default unless the request explicitly provides a simple display-only tax amount.
- Generate deterministic invoice numbers, for example `INV-YYYYMMDD-<provider>-<sequence>`.
- Stage a `billing.invoice_issued` outbox event.
- If no unbilled charges exist for the period, return a clear 400 or 409 response.

Authorization:

- `OPERATOR` can issue and view all invoices.
- `PROVIDER_ADMIN` can view own provider invoices.
- `EV_USER` cannot view invoices.

### 4.10 Mock payment API

Implement full-invoice mock payment only.

Suggested endpoint:

```text
POST /invoices/{invoice_id}/pay
```

Behavior:

- Invoice must be `issued` and unpaid.
- Full payment only; no partial payments.
- Create a payment record for the full invoice total.
- Set invoice status to `paid`.
- Set all invoice charges to `paid`.
- Stage a `billing.invoice_paid` outbox event.
- Re-paying an already paid invoice must return a deterministic conflict response.

Authorization:

- `PROVIDER_ADMIN` can pay only own provider issued invoices.
- `OPERATOR` may also mark/pay invoices for demo/admin purposes if simple.
- `EV_USER` cannot pay provider invoices.

### 4.11 Billing summary APIs

Implement simple dashboard-ready billing summaries.

Suggested endpoints:

```text
GET /overview
GET /providers/{provider_code}/overview
```

Behavior:

- Provider summary includes unpaid amount, paid amount, unbilled amount, charge counts, issued/paid invoice counts, current effective pricing.
- Operator summary includes totals across all providers and provider comparison rows.
- These APIs read only `billing-postgres`; they must not query analytics, reservation, catalog, provider, or auth databases directly.

Authorization:

- `OPERATOR` can see global and provider-specific overview.
- `PROVIDER_ADMIN` can see own provider overview only.
- `EV_USER` cannot access billing overview.

### 4.12 Manual event ingestion for deterministic tests and demos

Implement an operator-only endpoint for deterministic local ingestion without RabbitMQ:

```text
POST /events/ingest
```

It should accept a canonical event-envelope JSON body and run the same ingestion logic as RabbitMQ drain.

This is for tests and local demo only. It must still enforce idempotency and validation.

### 4.13 Authorization and scoping

Use the same JWT style as previous services.

Roles:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

Rules:

- `OPERATOR` can manage pricing, issue invoices, publish billing outbox events, drain billing queue, and view all billing data.
- `PROVIDER_ADMIN` can view only own provider charges/invoices/overview, read own effective pricing, and pay only own issued invoices.
- `EV_USER` has no billing administration access.

Provider-admin scope must come from JWT claims:

```text
provider_id
provider_code
```

### 4.14 Safe error handling

- Do not expose raw provider, RabbitMQ, database, or stack traces in API responses.
- Return deterministic error bodies for unsupported events, duplicate events, no charges to invoice, already-paid invoices, invalid roles, and provider-scope violations.
- Do not commit `.env` or real credentials.

---

## 5. Tests required

Add deterministic tests under:

```text
services/billing-service/tests/test_billing_service_api.py
```

Minimum test coverage:

1. Health endpoint still works.
2. Default pricing seed is idempotent.
3. Operator can create/update provider-specific pricing; provider admin cannot.
4. Provider admin can read own effective pricing only.
5. Manual ingest of `reservation.succeeded` creates one unbilled charge and one `billing.charge_created` outbox event.
6. Duplicate `reservation.succeeded` event does not create a second charge.
7. `reservation.failed` is recorded/skipped and creates no charge by default.
8. `usage.point_viewed` creates a point-view charge only when enabled by pricing.
9. Operator can issue invoice from unbilled charges and charge statuses become `invoiced`.
10. Provider admin cannot issue invoices.
11. Provider admin can view and pay own issued invoice; payment marks invoice and charges as paid.
12. Provider admin cannot view/pay another provider's invoice.
13. Re-paying paid invoice returns conflict.
14. Operator/provider billing overview returns expected totals.
15. Billing outbox publish success/failure behavior is deterministic with fake publisher.
16. RabbitMQ drain logic processes fake deliveries/messages idempotently without requiring live RabbitMQ.
17. Shared `packages/events` tests still pass if modified.

Use fake publishers/consumers where needed. Do not rely on live external provider APIs.

---

## 6. Runtime and Compose requirements

Update `docker-compose.yml` only as needed for `billing-service`:

- Build context may switch to repository root if required to install `packages/events`.
- Add safe environment variables for:
  - `JWT_SECRET`
  - `RABBITMQ_URL`
  - event exchange/topology/publishing settings
  - billing queue drain batch size
  - default pricing placeholders only if useful
- Keep the existing `billing-postgres` container.
- Do not add new runtime containers.
- Do not expose RabbitMQ to the frontend.

Update `.env.example` with safe placeholder values only.

---

## 7. Documentation required

Update:

```text
README.md
services/billing-service/README.md
packages/events/README.md
```

Only update `packages/events/README.md` if Prompt 11 changes event bindings or documents billing usage.

Documentation must describe:

- billing ownership,
- pricing rules,
- charge creation from events,
- idempotency by `source_event_id`,
- invoice issuance,
- full-invoice mock payment,
- role/provider scoping,
- RabbitMQ drain and billing outbox publishing endpoints,
- limitations and out-of-scope items.

All repository text must be in English.

---

## 8. AI logging required

Create:

```text
docs/ai/codex-runs/011-billing-service.md
```

Use:

```text
docs/ai/codex-runs/_template.md
```

Update:

```text
docs/ai/prompt-log.md
```

The run report must include:

- exact invocation prompt,
- canonical task prompt path,
- files read,
- files changed,
- commands run,
- tests/checks and results,
- warnings/blockers,
- GitHub issue/project actions,
- final status.

Record whether `docs/ai/prompts/prompt_11_billing_service.md` was tracked or untracked at run start.

---

## 9. GitHub issue/project action

After all Prompt 11 acceptance criteria pass:

1. Inspect GitHub issue `#11`.
2. Add a completion comment referencing:

```text
docs/ai/codex-runs/011-billing-service.md
```

3. Close issue `#11` as completed.
4. If possible, verify or update the GitHub Project item for issue `#11` to `Done`.

If GitHub issue/project mutation fails, report the failure clearly in:

- Codex final response,
- `docs/ai/codex-runs/011-billing-service.md`.

Do not create fallback Markdown project-management artifacts.

---

## 10. Validation commands

Run at minimum:

```bash
docker compose run --build --rm --no-deps billing-service pytest -q
docker compose run --rm --no-deps billing-service python -m pytest /tmp/packages/events/tests -q
git diff --check
docker compose config
test ! -f .env
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/billing/health
docker compose down -v
docker compose ps -a
```

Also run a gateway smoke test that verifies at least:

- operator login through gateway,
- manual billing event ingest,
- charge listing,
- invoice issuance,
- invoice payment,
- billing overview,
- no `.env` file exists.

If a command fails and is fixed, record both the failure and the fix in the run report.

---

## 11. Acceptance criteria

Prompt 11 is acceptable only if:

- `billing-service` owns real local persistence for pricing, charges, invoices, invoice lines, payments, consumed billing events, and billing outbox events.
- Default pricing is seeded idempotently.
- Billing event ingestion is idempotent by `event_id` / `source_event_id`.
- `reservation.succeeded` creates charges.
- `reservation.failed` creates no charge by default.
- `usage.point_viewed` creates charges only when enabled.
- Operator can issue invoices from unbilled charges.
- Provider admin can pay own issued invoice through mock full-payment flow.
- Invoice payment updates invoice, payment, and charge records consistently inside billing-service ownership.
- Billing outbox can publish `billing.charge_created`, `billing.invoice_issued`, and `billing.invoice_paid` through the shared event package.
- RabbitMQ billing queue drain exists but no worker/new container is added.
- Authorization and provider scoping are enforced.
- Billing APIs do not query other service databases.
- No frontend screens are implemented.
- No analytics business logic is implemented.
- No real payment gateway or tax/accounting compliance is implemented.
- No real secrets or `.env` are created.
- Dockerized tests pass.
- Compose config and full-stack health checks pass.
- GitHub issue #11 is closed if GitHub mutations succeed.
- AI logs and prompt log are updated.

---

## 12. Final response required from Codex

Return a concise final response with:

1. Final status: `COMPLETED`, `COMPLETED_WITH_WARNINGS`, or `BLOCKED`.
2. Files created/modified.
3. Tests/checks run and results.
4. GitHub issue/project actions.
5. Explicit warnings/blockers.
6. Confirmation that no out-of-scope work was implemented.
7. Exact next recommended action:

```text
Review the Prompt 11 diff, then proceed to Prompt 12 for EV frontend flows.
```
