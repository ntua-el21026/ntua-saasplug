# Prompt 14 - Final Documentation and UML Finalization

## 0. Operating mode

You are implementing the final staged Codex prompt for the NTUA ECE course project `saasPlug`.

Work only inside the local repository.

Treat these files as canonical:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
```

Repository content, documentation, code comments, README files, PlantUML files, prompts, and AI logs must remain in English.

Do not use Vercel. Do not deploy. Do not create hosting configuration. Do not create or commit `.env` or real secrets.

Use relevant installed skills/plugins when useful for final quality, especially documentation/audit/design/frontend validation skills:

```text
@Product Design
$frontend-app-builder
$react-best-practices
$geospatial-and-cartographic-visualization
$dashboards-and-real-time-visualization
$frontend-testing-debugging
@browser-use
$design-qa
$audit
$accessibility-and-inclusive-visualization
$testing-data-visualizations
@Figma
$figma-use
```

Use Figma only if a usable Figma file/node/source is actually available. Do not fabricate Figma-based findings. Use browser/design QA only if callable tools and a running local stack are available; otherwise document the limitation precisely.

## 1. Goal

Finalize the project documentation, final PlantUML diagram set, README coverage, AI-log traceability, and final verification evidence for the implemented saasPlug system.

This is the final prompt in the staged implementation sequence. It must not implement new business functionality.

The final deliverable should make the repository ready for review/submission by showing:

1. what the system does;
2. how the microservices are structured;
3. how the runtime is started locally;
4. which user flows exist;
5. how data ownership and RabbitMQ events work;
6. how the frontend maps to the backend gateway APIs;
7. how the implementation satisfies the accepted specifications;
8. how the project was verified.

## 2. Required preflight inspection

Before making changes, inspect at least:

```text
AGENTS.md
README.md
.env.example
docker-compose.yml
deploy/nginx/default.conf
docs/specs/SPECIFICATIONS.md
docs/specs/README.md
docs/README.md
docs/ai/README.md
docs/ai/prompt-log.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/codex-runs/000-audit-only.md
docs/ai/codex-runs/00B-logging-and-github-setup.md
docs/ai/codex-runs/001-repo-foundation.md
docs/ai/codex-runs/002-docker-gateway.md
docs/ai/codex-runs/003-auth-service.md
docs/ai/codex-runs/004-provider-registry-service.md
docs/ai/codex-runs/005-provider-services.md
docs/ai/codex-runs/006-catalog-service.md
docs/ai/codex-runs/007-status-service.md
docs/ai/codex-runs/008-reservation-service.md
docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md
docs/ai/codex-runs/010-analytics-service.md
docs/ai/codex-runs/011-billing-service.md
docs/ai/codex-runs/012-frontend-ev-flows.md
docs/ai/codex-runs/013-provider-operator-dashboards.md
docs/diagrams/final/README.md
apps/frontend/README.md
apps/frontend/package.json
apps/frontend/src/App.tsx
services/*/README.md
packages/README.md
packages/events/README.md
packages/events/saasplug_events/routing.py
packages/events/saasplug_events/topology.py
```

Also inspect the current repository tree enough to confirm the implemented structure.

If `docs/ai/prompts/README.md` still refers to an older Prompt 14 filename, update it to the actual filename used by this run:

```text
docs/ai/prompts/prompt_14_final_docs_uml.md
```

## 3. Scope allowed

You may create or update documentation and diagram artifacts only.

Allowed changes include:

```text
README.md
docs/README.md
docs/specs/README.md
docs/ai/prompt-log.md
docs/ai/prompts/README.md
docs/ai/codex-runs/014-final-docs-uml.md
docs/diagrams/final/*.puml
docs/diagrams/final/README.md
docs/final-verification.md
docs/submission-checklist.md
docs/architecture-summary.md
apps/frontend/README.md
services/*/README.md
packages/README.md
packages/events/README.md
```

You may update service/frontend/package READMEs only to correct or complete documentation. Do not modify application source code unless a documentation-only comment typo is clearly isolated and harmless. Prefer no source-code changes.

## 4. Explicit non-goals

Do not implement or change:

- backend business logic;
- frontend features or screens;
- backend database schemas or migrations;
- Docker runtime topology;
- Nginx gateway routes;
- RabbitMQ runtime topology code;
- provider adapters;
- authentication behavior;
- analytics, billing, reservation, catalog, status, or provider-registry behavior;
- tests except documentation references;
- real credentials or `.env`;
- deployment, hosting, Vercel, CI/CD, cloud services, or external infrastructure;
- new runtime containers, workers, schedulers, or orchestrators.

If you find a real source-code defect while validating, report it as a blocker or warning in the run report. Do not silently fix it unless the defect is purely documentation-level.

## 5. Final documentation requirements

Create or update final documentation so a reviewer can understand and run the project.

At minimum, update/create:

### 5.1 Root README

`README.md` must include:

- concise project overview;
- architecture summary;
- service list and responsibilities;
- local runtime instructions;
- demo users and safe demo password behavior;
- gateway URL and API route groups;
- frontend role routes;
- core EV/provider/operator flows;
- RabbitMQ/event summary;
- data ownership summary;
- validation commands;
- limitations and MVP scope;
- final documentation/diagram links.

### 5.2 `docs/architecture-summary.md`

Create a final architecture summary containing:

- actors and roles;
- system context;
- service boundaries;
- database ownership;
- gateway/API policy;
- RabbitMQ event model;
- end-to-end flows;
- frontend structure;
- known MVP limitations.

### 5.3 `docs/final-verification.md`

Create a final verification report containing:

- command checklist;
- results for frontend tests/build;
- results for backend service tests where run;
- results for shared event package tests;
- Compose config result;
- full-stack startup/gateway health result if Docker is available;
- authenticated smoke checks if Docker is available;
- forbidden-source grep results;
- `.env`/secret check;
- unresolved warnings and whether they are blockers.

If Docker Desktop/Linux engine is unavailable, document the exact failure and mark Docker runtime validation as not completed. Do not claim it passed.

### 5.4 `docs/submission-checklist.md`

Create a course-oriented checklist covering:

- assignment artifacts present;
- provider OpenAPI YAMLs present;
- implemented services;
- frontend flows;
- final diagrams;
- AI logs;
- run/validation instructions;
- known limitations.

### 5.5 README coverage

Ensure every major folder still has a useful `README.md`, especially:

```text
apps/frontend/
services/auth-service/
services/provider-registry-service/
services/red-provider-service/
services/green-provider-service/
services/blue-provider-service/
services/catalog-service/
services/status-service/
services/reservation-service/
services/analytics-service/
services/billing-service/
packages/
packages/events/
deploy/
docs/
docs/diagrams/final/
docs/ai/
scripts/
```

Do not over-edit stable service READMEs unless they are stale or missing final cross-links.

## 6. Final PlantUML diagram requirements

Final diagrams must live under:

```text
docs/diagrams/final/
```

Do not treat intermediate diagrams as final. Intermediate diagrams may be referenced as historical context only.

Create or update at least these PlantUML files:

```text
docs/diagrams/final/use-case.puml
docs/diagrams/final/component.puml
docs/diagrams/final/deployment.puml
docs/diagrams/final/data-model.puml
docs/diagrams/final/activity-search-reservation.puml
docs/diagrams/final/activity-provider-sync.puml
docs/diagrams/final/activity-invoice-payment.puml
docs/diagrams/final/sequence-login.puml
docs/diagrams/final/sequence-search-map.puml
docs/diagrams/final/sequence-status-lookup.puml
docs/diagrams/final/sequence-reservation.puml
docs/diagrams/final/sequence-provider-sync-catalog-import.puml
docs/diagrams/final/sequence-analytics-billing-events.puml
```

Update:

```text
docs/diagrams/final/README.md
```

The final diagrams must use exact accepted names:

```text
auth-service
provider-registry-service
red-provider-service
green-provider-service
blue-provider-service
catalog-service
status-service
reservation-service
analytics-service
billing-service
frontend
nginx-gateway
RabbitMQ
saasplug.events
auth-postgres
provider-registry-postgres
red-provider-postgres
green-provider-postgres
blue-provider-postgres
catalog-postgres
status-postgres
reservation-postgres
analytics-postgres
billing-postgres
```

Do not introduce obsolete/historical names such as:

```text
saasCharge
PointService
StatsService
PaymentService
ProviderAdapterService
```

The diagrams must represent the implemented MVP and accepted specs, not hypothetical future architecture.

## 7. Diagram content requirements

### 7.1 Use-case diagram

Include actors:

- EV User;
- Provider Admin;
- Operator;
- External Provider APIs.

Include core use cases:

- register/login;
- search/view charging points;
- check status;
- reserve charging point;
- view own reservations;
- provider analytics/export;
- provider invoices/mock payment;
- operator provider management;
- operator sync/import;
- operator pricing/invoice issuance;
- operator analytics/system overview.

### 7.2 Component diagram

Show:

- frontend;
- nginx-gateway;
- all backend services;
- all owned PostgreSQL containers;
- RabbitMQ topic exchange;
- red/green/blue external provider APIs;
- gateway-only browser API calls;
- internal service-to-service calls;
- event flows.

### 7.3 Deployment diagram

Show Docker Compose local runtime:

- frontend container;
- nginx gateway container;
- backend service containers;
- PostgreSQL containers;
- RabbitMQ container;
- exposed host ports where relevant.

Do not add cloud/Vercel/deployment infrastructure.

### 7.4 Data model diagram

Show service-owned tables grouped by owning service. Make clear that cross-service relationships are logical IDs, not cross-database foreign keys.

### 7.5 Activity and sequence diagrams

Cover:

- EV search/reservation flow;
- status lookup and cache fallback;
- provider sync and catalog import;
- reservation result -> RabbitMQ -> analytics/billing;
- invoice issuance and mock payment;
- login/session flow.

## 8. Verification requirements

Run validation appropriate for the final state.

At minimum, run and record:

```bash
git diff --check
test ! -f .env
```

Run frontend validation:

```bash
cd apps/frontend
npm run test
npm run build
```

Run shared events validation:

```bash
PYTHONPATH=packages/events python -m pytest packages/events/tests -q
```

If local Python/pytest has a known capture/runtime issue, use the already working Dockerized or `-s` variant and document exactly what happened.

Run Compose validation where Docker is available:

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/
curl -fsS http://localhost:8080/api/auth/health
curl -fsS http://localhost:8080/api/providers/health
curl -fsS http://localhost:8080/api/catalog/health
curl -fsS http://localhost:8080/api/status/health
curl -fsS http://localhost:8080/api/reservations/health
curl -fsS http://localhost:8080/api/analytics/health
curl -fsS http://localhost:8080/api/billing/health
docker compose down -v
docker compose ps -a
```

Run authenticated smoke tests where Docker is available:

- login as `evuser@saasplug.local` through the gateway and call `/api/auth/auth/me`;
- login as one provider admin and call at least one provider dashboard API path through the gateway;
- login as `operator@saasplug.local` and call at least one operator dashboard API path through the gateway.

Do not print tokens in logs.

Run forbidden-source checks:

```bash
rg -n "localhost|:8000|provider-service|davinci|amqp://|rabbitmq|/api/red-provider|/api/green-provider|/api/blue-provider" apps/frontend/src
rg -n "saasCharge|PointService|StatsService|PaymentService|ProviderAdapterService" docs/diagrams/final README.md docs/architecture-summary.md docs/submission-checklist.md
```

If a match is legitimate, explain why. Otherwise fix documentation references.

Optionally run service-level tests if feasible:

```bash
docker compose run --build --rm --no-deps auth-service pytest -q
docker compose run --build --rm --no-deps provider-registry-service pytest -q
docker compose run --build --rm --no-deps red-provider-service pytest -q
docker compose run --build --rm --no-deps green-provider-service pytest -q
docker compose run --build --rm --no-deps blue-provider-service pytest -q
docker compose run --build --rm --no-deps catalog-service pytest -q
docker compose run --build --rm --no-deps status-service pytest -q
docker compose run --build --rm --no-deps reservation-service pytest -q
docker compose run --build --rm --no-deps analytics-service pytest -q
docker compose run --build --rm --no-deps billing-service pytest -q
```

If these are skipped for time/environment, clearly state that they were skipped and why. Do not claim they passed unless they actually ran.

## 9. AI logging requirements

Create/update:

```text
docs/ai/codex-runs/014-final-docs-uml.md
docs/ai/prompt-log.md
```

The run report must include:

- invocation prompt;
- canonical prompt path;
- exact files read;
- exact files changed;
- commands run and results;
- Docker/browser/Figma/tool limitations, if any;
- final verification summary;
- GitHub issue/project actions;
- final status.

Update `docs/ai/prompt-log.md` with run `014` and status:

- `completed` only if all required documentation/diagram work is done and required validation passes;
- `completed_with_warnings` if documentation/diagrams are complete but some non-source blocker such as Docker/browser/Figma availability prevents runtime/visual validation;
- `blocked` if final docs/diagrams or core local build/test validation cannot be completed.

## 10. GitHub issue/project requirement

After all Prompt 14 acceptance criteria pass, inspect, comment on, and close GitHub issue #14 as completed. If possible, verify that its GitHub Project item is `Done`.

If GitHub issue/project mutations fail, report the failure clearly in the final Codex response and in:

```text
docs/ai/codex-runs/014-final-docs-uml.md
```

Do not create fallback Markdown project-management artifacts.

If Docker runtime validation is unavailable but all documentation, diagrams, frontend tests/build, static checks, and available validations pass, you may still close issue #14 as completed only if the run report clearly records `COMPLETED_WITH_WARNINGS` and the exact Docker limitation. Do not mark runtime validation as passed.

## 11. Final response format

Return a concise final response with:

```text
COMPLETED
```

or:

```text
COMPLETED_WITH_WARNINGS
```

or:

```text
BLOCKED
```

Then include:

- files created/modified;
- validation commands and results;
- GitHub issue/project result;
- warnings/blockers;
- exact next manual action, if any.

Do not include raw secrets or JWTs.
