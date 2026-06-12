# Prompt 12 - EV Frontend Flows

## 1. Task authority

Read and follow, in this order:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/prompts/README.md`
4. `docs/ai/codex-runs/_template.md`
5. Existing frontend files under `apps/frontend/`
6. Relevant service README files and API implementations:
   - `services/auth-service/README.md`
   - `services/catalog-service/README.md`
   - `services/status-service/README.md`
   - `services/reservation-service/README.md`
   - relevant `app/routes.py` and `app/schemas.py` files for those services
7. `docker-compose.yml`
8. `.env.example`

Treat `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` as canonical. If anything conflicts with them, follow those two files.

Repository content, code, comments, docs, README files, tests, and AI logs must be in English.

## 2. Run identity

This is Codex implementation run:

```text
012 - Frontend EV flows
```

Create/update:

```text
docs/ai/codex-runs/012-frontend-ev-flows.md
docs/ai/prompt-log.md
```

Use:

```text
docs/ai/codex-runs/_template.md
```

The run report must record:

- exact invocation prompt;
- canonical task prompt file path;
- files read;
- files created/modified;
- commands run and results;
- tests/builds/smoke checks;
- limitations and warnings;
- GitHub issue/project actions.

## 3. Goal

Implement the EV user frontend flows in the existing single role-based React + TypeScript + Vite app under:

```text
apps/frontend
```

The frontend must provide a professional, polished, responsive, accessible SaaS UI for the EV user journey:

```text
login/register -> map/search/list -> point details -> status lookup -> reservation -> my reservations/profile
```

Use only gateway API paths from the browser. The frontend must never call internal service ports or external provider APIs directly.

Allowed gateway route groups:

```text
/api/auth/*
/api/catalog/*
/api/status/*
/api/reservations/*
```

Provider/admin/operator dashboards are Prompt 13 scope. Billing, analytics dashboards, pricing, invoice UI, provider admin UI, and operator UI must not be implemented in this run.

## 4. Frontend/design quality requirement

Use the relevant installed frontend/design skills and plugins when useful to produce a professional result:

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

Apply them only where useful and available. Do not block the run if a skill/plugin is unavailable; report that clearly in the run report.

Design expectations:

- polished SaaS visual design, not a raw scaffold;
- coherent layout, spacing, typography, color system, and component hierarchy;
- clear EV product experience;
- responsive desktop/tablet/mobile layouts;
- accessible forms, buttons, labels, focus states, contrast, and keyboard behavior;
- loading, empty, and error states;
- no raw stack traces or raw backend errors displayed to users;
- professional local demo behavior using seeded users.

Do not use Vercel, deployment plugins, deployment commands, hosting setup, or remote deployment. Work only on the local repository/frontend implementation unless the user explicitly asks for deployment.

## 5. Current frontend baseline

Prompt 02 created a minimal Vite frontend placeholder. Replace it with a real EV user UI, but keep the single app architecture.

Current frontend constraints:

- React + TypeScript + Vite.
- Browser access is through Nginx at `http://localhost:8080/`.
- The frontend container listens internally on port `5173`.
- `Dockerfile` uses `npm install --no-audit --no-fund` and `npm run dev`.
- All browser API calls must be relative gateway calls such as `/api/auth/auth/login`, not service hostnames.

You may add frontend dependencies when justified, but keep the dependency set modest and maintainable. Avoid heavyweight frameworks, deployment packages, or packages requiring hosted services/API keys.

If using shadcn-style UI, implement it in a repository-appropriate way. Do not run external deployment setup. Do not require hosted design tooling.

For map/geospatial UI, implement a reliable local demo experience. You may use a map library only if it does not require API keys and does not make the app dependent on deployment. Provide a graceful fallback. A polished SVG/CSS map/list hybrid using catalog coordinates is acceptable and may be preferable for deterministic local operation.

## 6. Required EV user pages/routes

Implement frontend routing without adding backend routes.

Required user-facing routes:

```text
/
/login
/register
/logout
/map
/dashboard
/points/:providerCode/:externalPointId
/reservations
/profile
```

Behavior:

- `/` redirects or links intelligently based on auth state.
- `/login` supports email/password login and displays the Google OAuth hook as local/demo-aware.
- `/register` registers an EV user.
- `/logout` clears local frontend auth state and calls logout when possible.
- `/map` and `/dashboard` may share the same EV dashboard implementation.
- `/points/:providerCode/:externalPointId` shows cached catalog point details, optional status lookup, and reservation CTA.
- `/reservations` shows the logged-in EV user's reservations.
- `/profile` shows current user/session information and safe demo account hints.

For provider/admin/operator users, Prompt 12 may show a small "role not implemented in this prompt" landing message after login, but must not build their dashboards. Provider/admin/operator dashboards are Prompt 13.

## 7. Authentication requirements

Use existing auth-service gateway endpoints:

```text
POST /api/auth/auth/login
POST /api/auth/auth/register
POST /api/auth/auth/refresh
POST /api/auth/auth/logout
GET  /api/auth/auth/me
GET  /api/auth/auth/google/login
```

Seeded local demo users include:

```text
operator@saasplug.local
 evuser@saasplug.local
red-admin@saasplug.local
green-admin@saasplug.local
blue-admin@saasplug.local
```

Safe local demo password default:

```text
change-me-demo-password
```

Implement:

- login form;
- registration form for EV users;
- auth state persistence appropriate for local MVP;
- bearer token handling;
- refresh-token handling where reasonably simple;
- logout flow;
- protected-route behavior;
- role-aware redirects;
- `/auth/me` session validation on app startup.

Store tokens carefully for local MVP. Do not introduce real secrets. Do not commit `.env`.

## 8. Catalog/map/search requirements

Use catalog-service gateway endpoints:

```text
GET /api/catalog/points
GET /api/catalog/points/{provider_code}/{external_point_id}
GET /api/catalog/freshness
```

For operator-only imports, Prompt 12 may optionally include a demo-only operator helper only if it does not turn into an operator dashboard. Prefer not to implement operator sync UI until Prompt 13.

EV search/map behavior:

- viewport/bounds-based requests using query parameters:

```text
minLat
maxLat
minLng
maxLng
providerCode
status
connector
q
includeStale
limit
offset
```

- debounce map/search requests;
- show list and map together;
- show provider, location/name, address, connector, capacity, status, price/fallback, freshness;
- handle zero catalog data gracefully with a useful empty state explaining that catalog import/provider credentials may be needed;
- do not load all points by default when bounds are available;
- do not present synthetic coordinates as provider-provided coordinates. If `coordinate_source=demo_synthetic`, label them as demo map coordinates.

## 9. Point details and status requirements

Use:

```text
GET /api/catalog/points/{provider_code}/{external_point_id}
GET /api/status/points/{provider_code}/{external_point_id}/status
GET /api/status/cache/{provider_code}/{external_point_id}
```

Behavior:

- point details come from cached/local catalog;
- status lookup uses status-service and requires auth;
- show cache hit/provider called/stale fallback/freshness indicators if returned;
- support manual "refresh status" action with `forceRefresh=true`;
- display normalized status values:

```text
available
charging
reserved
malfunction
offline
unknown
```

- display price as `Price unavailable` when missing;
- show safe user-facing messages for 502/provider-placeholder credential failures.

## 10. Reservation requirements

Use reservation-service gateway endpoints:

```text
POST /api/reservations/points/{provider_code}/{external_point_id}/reservations
GET  /api/reservations/reservations/me
GET  /api/reservations/reservations/{reservation_id}
```

Behavior:

- EV users can create reservations.
- Provider admins must not be offered EV reservation actions.
- Operator reservation creation is not part of the normal UI.
- Reservation form should support duration in minutes, defaulting to 60.
- Show immediate success/failure/unknown result clearly.
- Show reservation history for the logged-in EV user.
- Do not implement cancellation unless already supported by backend APIs. It is out of scope.
- Do not implement EV payment; saasPlug does not charge EV users.

## 11. UI architecture expectations

Implement a maintainable frontend structure. Suggested structure, adjust if the existing repo suggests better:

```text
apps/frontend/src/
  app/
  components/
  features/
    auth/
    catalog/
    status/
    reservations/
  lib/
    api.ts
    auth.ts
    formatting.ts
    routing.ts
  styles/
  test/
```

Requirements:

- TypeScript types for API DTOs used by frontend.
- A single API client wrapper with JSON/error handling and bearer token injection.
- Components should be small and readable.
- Avoid putting all app logic in `App.tsx`.
- Keep styling maintainable.
- Prefer deterministic, local-friendly behavior.
- Keep all code/comments/docs in English.

## 12. Testing and validation requirements

Add frontend tests where useful. Prefer Vitest + React Testing Library if adding tests.

At minimum, validation must include:

```text
npm run build
```

inside `apps/frontend` or through the frontend Docker/container path.

Also run, where practical:

```text
docker compose config
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/
curl -fsS http://localhost:8080/api/auth/health
curl -fsS http://localhost:8080/api/catalog/health
curl -fsS http://localhost:8080/api/status/health
curl -fsS http://localhost:8080/api/reservations/health
docker compose down -v
docker compose ps -a
test ! -f .env
git diff --check
```

If browser/design QA tools are available, use them for a local visual/accessibility pass against `http://localhost:8080/` and record findings. Do not deploy.

If tests cannot be run due to missing local tooling, Docker/network constraints, or unavailable browser plugins, report the limitation explicitly and run the closest feasible substitute.

## 13. Documentation requirements

Update:

```text
apps/frontend/README.md
README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/012-frontend-ev-flows.md
```

Document:

- implemented EV routes;
- local demo login credentials;
- gateway-only API rule;
- map/search behavior;
- status/reservation behavior;
- known limitations, especially provider credential/catalog import limitations;
- commands to run/build/test the frontend locally;
- explicit non-goals for Prompt 12.

Do not alter professor-provided assignment or lecture files.

## 14. GitHub issue/project action

After all Prompt 12 acceptance criteria pass:

1. Inspect GitHub issue `#12` in `ntua-el21026/NTUA-saasPlug`.
2. Add a completion comment referencing:

```text
docs/ai/codex-runs/012-frontend-ev-flows.md
```

3. Close issue `#12` as completed.
4. If possible, verify that the GitHub Project item is `Done`.

If GitHub issue/project mutations fail, report the failure clearly in:

- Codex final response;
- `docs/ai/codex-runs/012-frontend-ev-flows.md`.

Do not create fallback Markdown project-management artifacts unless explicitly requested.

## 15. Explicit non-goals

Do not implement:

- provider admin dashboards;
- operator dashboards;
- analytics dashboard UI beyond minor EV-facing summary labels if needed;
- billing/pricing/invoice UI;
- provider settings UI;
- operator sync controls;
- backend services or database schemas;
- provider API calls from the browser;
- internal service-port calls from the browser;
- direct RabbitMQ actions from the browser;
- deployment/Vercel/hosting setup;
- real secrets or `.env`;
- new runtime containers;
- architecture changes;
- new backend endpoints unless strictly necessary and explicitly justified.

## 16. Acceptance criteria

The run is acceptable only if:

- `apps/frontend` is no longer a placeholder and implements EV auth/catalog/status/reservation flows.
- UI is professional, coherent, responsive, and accessible enough for a course demo.
- All frontend API calls go through gateway-relative `/api/...` paths.
- Login/register/logout/session validation work with existing auth-service responses.
- Catalog search/list/map uses catalog-service and supports bounds/filter/query behavior.
- Point detail uses catalog cached details and status-service status lookup.
- Reservation creation and reservation history use reservation-service.
- Provider/admin/operator dashboards are not implemented yet.
- No deployment or Vercel work is performed.
- No `.env` or real secrets are created.
- Required docs and AI logs are updated.
- Required validation commands are run or limitations are clearly recorded.
- Issue #12 is closed and the project item is verified as Done if GitHub access works.

## 17. Final response format

End with one of:

```text
COMPLETED
COMPLETED_WITH_WARNINGS
BLOCKED
```

Then summarize:

- implemented EV frontend flows;
- files created/modified;
- validation commands and results;
- design/frontend skills/plugins used, or explicitly unavailable;
- warnings/limitations;
- GitHub issue/project result;
- exact next recommended action.
