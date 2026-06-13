# Prompt 13 - Provider and Operator Frontend Dashboards

## 1. Role and objective

You are implementing Prompt 13 for the NTUA ECE course project **saasPlug**.

Implement only the **provider-admin and operator frontend dashboard scope** in the existing single React + TypeScript + Vite app under:

```text
apps/frontend
```

The target result must be professional, polished, responsive, accessible, and suitable for a university SaaS/microservices project demonstration. Preserve the existing EV user flows from Prompt 12.

Repository files, code, comments, documentation, AI logs, and tests must be written in **English**.

## 2. Canonical sources

Before changing files, read and follow:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/prompt-log.md
docs/ai/codex-runs/012-frontend-ev-flows.md
apps/frontend/README.md
apps/frontend/package.json
apps/frontend/src/App.tsx
apps/frontend/src/lib/api.ts
apps/frontend/src/lib/types.ts
apps/frontend/src/styles/app.css
```

Also inspect the actual backend route/schemas/README files before wiring each page:

```text
services/auth-service/README.md
services/provider-registry-service/README.md
services/catalog-service/README.md
services/status-service/README.md
services/reservation-service/README.md
services/analytics-service/README.md
services/billing-service/README.md

services/provider-registry-service/app/routes.py
services/provider-registry-service/app/schemas.py
services/catalog-service/app/routes.py
services/catalog-service/app/schemas.py
services/status-service/app/routes.py
services/status-service/app/schemas.py
services/reservation-service/app/routes.py
services/reservation-service/app/schemas.py
services/analytics-service/app/routes.py
services/analytics-service/app/schemas.py
services/billing-service/app/routes.py
services/billing-service/app/schemas.py
```

Do **not** assume endpoint shapes from memory. Use the actual repository implementation.

## 3. Frontend/design skills and plugin guidance

Use the relevant installed frontend/design skills and plugins when useful:

```text
@Figma
$figma-use
@Product Design
$frontend-app-builder
$react-best-practices
$shadcn
$geospatial-and-cartographic-visualization
$dashboards-and-real-time-visualization
$frontend-testing-debugging
@browser-use
$design-qa
$audit
$accessibility-and-inclusive-visualization
$testing-data-visualizations
```

Constraints:

- Do not use Vercel.
- Do not deploy anything.
- Do not add hosting setup.
- Work only on the local repository/frontend implementation.
- If a plugin/skill is unavailable in the session, continue with best effort and record the limitation in the run report.
- If no Figma file/node/canvas is provided, do not invent Figma input. State that Figma-specific QA was not applicable.
- If browser/in-app screenshot QA is available, use it to inspect the rendered app through `http://localhost:8080/` after `docker compose up -d --build`. If unavailable, document that limitation.

## 4. Existing frontend context

Prompt 12 already implemented:

- login/register/logout;
- local session handling;
- role guards;
- EV map/search/list;
- point details;
- status lookup;
- reservation creation;
- own reservation history;
- profile;
- responsive styling;
- frontend tests/build validation.

Preserve and extend that work. Do not regress EV flows.

The frontend API client must continue to enforce gateway-only requests through `/api/...` paths.

## 5. Scope to implement

Implement provider-admin and operator dashboards in the existing React app.

### 5.1 Role routing and shell

Extend routing/navigation so the app has coherent role-specific areas:

```text
/provider/dashboard
/provider/points
/provider/analytics
/provider/invoices
/provider/invoices/:invoiceId
/provider/export
/provider/settings

/operator/dashboard
/operator/providers
/operator/analytics
/operator/catalog
/operator/invoices
/operator/invoices/new
/operator/pricing
/operator/sync
/operator/system
```

Behavior:

- `EV_USER` should continue to land on `/map`.
- `PROVIDER_ADMIN` should land on `/provider/dashboard` after login/root redirect.
- `OPERATOR` should land on `/operator/dashboard` after login/root redirect.
- Unauthorized roles must see a friendly access-denied/redirect state, not raw errors.
- Existing `/profile` should remain available to authenticated users.

### 5.2 Provider-admin dashboard area

Implement polished provider-admin pages using existing gateway APIs only.

Provider admins are scoped by JWT claims and must never be able to view other providers' data from the UI.

Required pages:

#### `/provider/dashboard`

A concise provider landing page with cards/sections for:

- provider identity/scope;
- key analytics KPIs available from analytics-service;
- billing snapshot/unpaid invoices if available;
- catalog freshness/status freshness indicators if available;
- quick links to analytics, invoices, export, points, and settings.

#### `/provider/points`

Provider-scoped points view using catalog/status data:

- list/search/filter points for the provider-admin's own provider;
- show point status, connector/capacity/price/freshness where available;
- link to existing point detail route where useful;
- show empty state if catalog has no imported points.

#### `/provider/analytics`

Provider analytics dashboard:

- provider KPIs from analytics-service;
- usage trends/summary where available;
- top viewed/reserved points where available;
- conversion-rate display with `N/A` when denominator is zero;
- simple charts/tables using accessible markup and the current frontend stack.

#### `/provider/invoices`

Provider invoice list:

- own issued/paid invoices only;
- unpaid amount summary;
- invoice status badges;
- links to invoice details.

#### `/provider/invoices/:invoiceId`

Invoice detail and mock full-payment flow:

- invoice header/status/period/totals;
- invoice lines;
- mock pay button only when the invoice is issued/unpaid and belongs to the provider admin's provider;
- after successful payment, refresh invoice state and show clear confirmation.

#### `/provider/export`

Provider usage export UI:

- trigger/download provider-scoped CSV export from analytics-service;
- support optional date/provider filters only if backend supports them;
- show export limitations and empty states clearly.

#### `/provider/settings`

Provider settings/info page:

- show provider code/name/safe metadata where backend exposes it;
- show effective pricing read-only if billing-service exposes it to provider admins;
- never show secrets/API keys;
- include safety copy that provider API credentials are configured server-side.

### 5.3 Operator dashboard area

Implement polished operator pages using existing gateway APIs only.

#### `/operator/dashboard`

Operator landing page with:

- global analytics KPIs;
- provider comparison overview;
- billing overview;
- catalog/status freshness indicators;
- quick operational actions/links.

#### `/operator/providers`

Provider management/read view:

- list `redPlug`, `greenPlug`, `bluePlug` provider metadata/status/config safety metadata;
- if backend supports updates, expose only safe supported update controls;
- no direct provider API calls from the browser;
- no secrets displayed.

#### `/operator/analytics`

Operator analytics dashboard:

- global KPIs;
- provider comparison;
- trends by day/hour where available;
- failed reservation counts/status distributions where available;
- accessible chart/table design.

#### `/operator/catalog`

Catalog operations page:

- catalog freshness by provider;
- catalog points overview/search;
- import run list;
- operator-only import/sync controls using catalog-service endpoints.

#### `/operator/invoices`

Invoice management page:

- all providers' invoices;
- filters by provider/status where supported;
- paid/unpaid totals;
- links to details if useful.

#### `/operator/invoices/new`

Invoice issuance page:

- choose provider;
- choose billing period;
- issue invoice from unbilled charges through billing-service;
- show validation, success, and failure states;
- after issuance, link to invoice list/detail if possible.

#### `/operator/pricing`

Pricing rules page:

- show active global default pricing;
- show provider-specific pricing overrides where supported;
- allow operator edits only through supported billing-service APIs;
- clearly show values in EUR;
- do not implement complex tiers/subscriptions/coupons.

#### `/operator/sync`

Operational sync page:

- trigger catalog provider import/all import if supported;
- optionally trigger reservation/billing outbox publish endpoints if exposed and appropriate;
- show latest import/outbox operation results;
- do not add new scheduler/orchestrator behavior.

#### `/operator/system`

System overview page:

- gateway/service health links or cards using existing health endpoints;
- catalog/status freshness;
- recent import runs/status logs if backend exposes them;
- basic operational notices about demo credentials/provider external 403 limitations.

## 6. UI/UX requirements

The result should feel like a polished SaaS admin product, not a raw CRUD page.

Use:

- clear role-aware navigation;
- consistent page headers, cards, panels, tables, status badges, empty states, loading states, error states;
- responsive layouts for desktop/tablet/mobile;
- accessible form labels, buttons, focus states, semantic landmarks, and readable contrast;
- chart/table visualizations where useful, without adding heavy dependencies unless justified;
- deterministic demo-friendly behavior when backend data is empty.

Prefer simple, maintainable local components over large framework churn. If using shadcn-related patterns is useful, adapt them to the current stack without requiring external deployment or a separate design system service.

## 7. API and security constraints

- All frontend API calls must go through gateway-relative `/api/...` paths.
- Do not call internal service ports such as `:8000` from frontend code.
- Do not call external provider APIs from frontend code.
- Do not call RabbitMQ from frontend code.
- Do not hard-code real secrets.
- Do not create `.env`.
- Do not display provider API keys, tokens, passwords, raw authorization headers, or raw stack traces.
- Use JWT role/provider claims already returned by auth-service.
- Provider admins must be scoped to their own `provider_code`.
- Operator-only pages/actions must be hidden or blocked for non-operators.

## 8. Data/empty-state expectations

The local stack may have little or no data unless imports/events were manually run. The UI must handle this gracefully.

For empty data:

- show clear empty states;
- explain the likely local demo reason;
- provide operator actions where appropriate, such as triggering catalog import or aggregate refresh;
- do not fake backend data as if it were real.

Static explanatory placeholders are allowed only where they clearly state no live data exists.

## 9. Tests and validation

Add/update frontend tests where useful. At minimum, cover:

- role-based routing/landing behavior;
- provider-admin access to provider routes;
- operator access to operator routes;
- one dashboard or API-helper smoke path;
- no regression of existing EV route rendering tests.

Required validation commands:

```bash
cd apps/frontend
npm run test
npm run build
```

From repo root:

```bash
git diff --check
docker compose config
test ! -f .env
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/auth/health
curl -fsS http://localhost:8080/api/catalog/health
curl -fsS http://localhost:8080/api/analytics/health
curl -fsS http://localhost:8080/api/billing/health
docker compose down -v
docker compose ps -a
```

Also run authenticated smoke checks through the gateway for at least:

- provider-admin login and one provider dashboard/API page path;
- operator login and one operator dashboard/API page path;
- no frontend source calls to forbidden targets.

Use a grep-style check against `apps/frontend/src` for forbidden direct calls to:

```text
localhost
:8000
provider-service
davinci
amqp://
rabbitmq
/api/red-provider
/api/green-provider
/api/blue-provider
```

Allow documented localhost references only in README/docs, not in source API calls.

If browser rendered QA is available, inspect the app at `http://localhost:8080/` and record findings. If unavailable, record the limitation.

## 10. Documentation and AI logs

Update:

```text
README.md
apps/frontend/README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/013-provider-operator-dashboards.md
```

The run report must follow `docs/ai/codex-runs/_template.md` and record:

- exact invocation prompt;
- canonical task prompt file path;
- files changed;
- tests/checks run;
- screenshots/design QA status if any;
- limitations/warnings;
- GitHub issue/project actions.

## 11. GitHub issue/project action

After all Prompt 13 acceptance criteria pass:

1. Inspect GitHub issue `#13` in `ntua-el21026/NTUA-saasPlug`.
2. Add a concise completion comment referencing:

```text
docs/ai/codex-runs/013-provider-operator-dashboards.md
```

3. Close issue `#13` as completed.
4. If possible, verify the GitHub Project item is `Done`.

If GitHub issue/project mutations fail, report the failure clearly in the Codex final response and in the run report. Do not create fallback Markdown project-management artifacts.

## 12. Explicit non-goals

Do **not** implement:

- backend services;
- backend database schemas/migrations;
- new backend endpoints;
- provider API calls from the browser;
- direct internal service-port calls from the browser;
- direct RabbitMQ browser actions;
- new runtime containers;
- worker/scheduler/orchestrator services;
- deployment or hosting setup;
- Vercel configuration;
- real secrets;
- `.env`;
- Figma asset generation without a provided Figma source;
- final documentation/PlantUML finalization, which remains Prompt 14 scope.

## 13. Final response format

When finished, respond with one of:

```text
COMPLETED
COMPLETED_WITH_WARNINGS
BLOCKED
```

Then summarize:

- files changed;
- tests/checks run and results;
- GitHub issue/project status;
- warnings/limitations;
- exact next recommended action, which should be Prompt 14 if this run completed.
