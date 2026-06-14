# Prompt 22 - Live environment full verification

You are working in:

`ntua-el21026/NTUA-saasPlug`

Task type:

`LIVE ENVIRONMENT FULL VERIFICATION - NO IMPLEMENTATION`

## Goal

Run the final live-environment verification pass for the completed saasPlug repository using the existing local `.env` as private runtime input.

This is strictly a verification-only task. Do not implement features, do not change architecture, do not change backend business logic, do not change frontend business logic, do not add deployment, do not use Vercel, do not create `.env`, and do not print or expose secrets.

## Repository/content language rule

All repository files, documentation, comments, README files, AI logs, Codex prompts, GitHub issue titles/bodies, and project-management artifacts must remain in English.

## Canonical files to read first

- `AGENTS.md`
- `README.md`
- `.env.example`
- `.gitignore`
- `docker-compose.yml`
- `deploy/nginx/default.conf`
- `docs/specs/SPECIFICATIONS.md`
- `docs/specs/README.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/016-live-env-verification.md`
- `docs/ai/codex-runs/021-final-verification-only.md`
- `docs/ai/prompts/prompt_22_live_env_full_verification.md`
- `docs/diagrams/final/`

## Hard constraints

- Verification only.
- Use the existing local `.env` only as private runtime input.
- Do not create `.env`.
- Do not modify `.env`.
- Do not print `.env`.
- Do not copy `.env`.
- Do not commit `.env`.
- Do not upload `.env`.
- Do not print or expose provider API keys, JWT secrets, Google secrets, RabbitMQ passwords, database passwords, access tokens, refresh tokens, scheduler internal token, OAuth authorization codes, OAuth tokens, or raw credential-bearing URLs.
- Do not print interpolated Docker Compose configuration.
- Use `docker compose --env-file .env config --quiet`, not plain `docker compose config` with output.
- Do not implement new features.
- Do not change architecture.
- Do not change backend or frontend business logic.
- Do not add deployment, hosting, production hosting, CI deployment, or Vercel.
- Do not run live reservation mutations unless `RUN_LIVE_RESERVATION_SMOKE=true` is explicitly set in the environment.
- Do not create fallback project-management Markdown artifacts such as `docs/project-management`.
- Do not close issue `#20`.
- Clearly report unavailable tools instead of claiming success.
- Keep all repository content in English.

## Important safety rule for `.env`

You may read `.env` only programmatically for structural validation and runtime execution. Any reporting must be redacted.

Report only:

- key presence;
- placeholder/non-placeholder status;
- high-level URL host/path coherence;
- status codes;
- counts;
- pass/fail results.

Never print actual values.

## Verification scope

### 1. Repository status and governance

Run:

```bash
git status --short
```

Identify pre-existing unrelated working-tree changes and leave them untouched.

Verify `.gitignore` excludes `.env` and keeps `.env.example` trackable.

Verify `.env` is untracked using:

```bash
git ls-files --error-unmatch .env
```

Treat a non-zero result as `PASS` because `.env` should not be tracked.

Verify:

- `.env` exists locally;
- `.env.example` still exists and remains the committed safe template.

Do not print `.env` or any secret value.

### 2. Redacted `.env` structural validation

Validate required live runtime keys from `.env` with redacted output only.

Required groups:

Public/runtime:

- `PUBLIC_BASE_URL`
- `APP_ENV`

Auth/JWT/demo users:

- `JWT_SECRET`
- `DEMO_USER_PASSWORD`

Google OAuth:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

RabbitMQ:

- `RABBITMQ_DEFAULT_USER`
- `RABBITMQ_DEFAULT_PASS`
- `RABBITMQ_URL`
- `RABBITMQ_EVENT_EXCHANGE`

Provider API:

- `PROVIDER_AUTH_SCHEME`
- `RED_PROVIDER_API_KEY`
- `GREEN_PROVIDER_API_KEY`
- `BLUE_PROVIDER_API_KEY`
- `RED_PROVIDER_BASE_URL`
- `GREEN_PROVIDER_BASE_URL`
- `BLUE_PROVIDER_BASE_URL`

Scheduler:

- `SCHEDULER_DATABASE_URL`
- `SCHEDULER_INTERNAL_TOKEN`
- `SCHEDULER_TICK_SECONDS`
- `SCHEDULER_MAX_CONCURRENT_JOBS`
- `SCHEDULER_HTTP_TIMEOUT_SECONDS`

Service database URLs:

- `AUTH_DATABASE_URL`
- `PROVIDER_REGISTRY_DATABASE_URL`
- `RED_PROVIDER_DATABASE_URL`
- `GREEN_PROVIDER_DATABASE_URL`
- `BLUE_PROVIDER_DATABASE_URL`
- `CATALOG_DATABASE_URL`
- `STATUS_DATABASE_URL`
- `RESERVATION_DATABASE_URL`
- `ANALYTICS_DATABASE_URL`
- `BILLING_DATABASE_URL`
- `SCHEDULER_DATABASE_URL`

Checks:

- Required keys are present.
- Required secret keys are non-empty and non-placeholder.
- `PROVIDER_AUTH_SCHEME` is `Bearer`.
- Provider base URLs point to the expected provider API prefixes.
- `GOOGLE_REDIRECT_URI` is coherent with the local gateway callback:

```text
http://localhost:8080/api/auth/auth/google/callback
```

- Database URLs refer to the expected Docker Compose PostgreSQL service hostnames.
- RabbitMQ URL is coherent with the Compose RabbitMQ service hostname and credentials.

Output only a redacted table such as:

- key group;
- presence;
- placeholder/non-placeholder;
- coherence pass/fail;
- notes without values.

### 3. Static architecture verification

Verify the final service set exists:

- `auth-service`
- `provider-registry-service`
- `red-provider-service`
- `green-provider-service`
- `blue-provider-service`
- `catalog-service`
- `status-service`
- `reservation-service`
- `analytics-service`
- `billing-service`
- `scheduler-service`

Verify Docker Compose includes:

- `frontend`
- `nginx-gateway`
- `rabbitmq`
- all backend services
- one PostgreSQL container per stateful service:
  - `auth-postgres`
  - `provider-registry-postgres`
  - `red-provider-postgres`
  - `green-provider-postgres`
  - `blue-provider-postgres`
  - `catalog-postgres`
  - `status-postgres`
  - `reservation-postgres`
  - `analytics-postgres`
  - `billing-postgres`
  - `scheduler-postgres`

Verify:

- no MongoDB runtime component exists;
- no dedicated orchestrator service exists;
- provider services are not exposed publicly through Nginx;
- `/api/scheduler/*` is exposed through Nginx;
- service-owned internal job prefixes are blocked at the gateway with HTTP `404`.

### 4. Frontend source verification

Verify frontend source calls only gateway-relative `/api/...` paths.

Forbidden in frontend application source:

- Docker-internal service hostnames;
- direct service ports;
- `red-provider-service`, `green-provider-service`, `blue-provider-service` direct calls;
- external provider API URLs;
- RabbitMQ or AMQP URLs;
- service-owned `/internal/jobs/*` routes.

Verify these frontend areas still exist:

- EV login/register/logout/session/profile;
- EV map/search/list/details/status/reservation flows;
- provider-admin dashboards/points/analytics/invoices/export/settings;
- operator dashboard/providers/analytics/catalog/invoices/pricing/sync/system;
- operator scheduler health/jobs/manual runs/run history.

### 5. Provider artifacts and Bearer-auth verification

Verify these files exist:

- `docs/assignment/providers/yaml/redPlug.yaml`
- `docs/assignment/providers/yaml/greenPlug.yaml`
- `docs/assignment/providers/yaml/bluePlug.yaml`
- `docs/assignment/providers/postman_collections/redPlug.postman_collection.json`
- `docs/assignment/providers/postman_collections/greenPlug.postman_collection.json`
- `docs/assignment/providers/postman_collections/bluePlug.postman_collection.json`

Verify implementation default:

- provider clients send `Authorization: Bearer <apiKey>`;
- `PROVIDER_AUTH_SCHEME=Bearer` is wired through `.env`, `.env.example`, Docker Compose, and provider-service config.

### 6. Tests and builds

Run all tests/builds using `.env` as the runtime env file:

```bash
docker compose --env-file .env run --build --rm --no-deps frontend npm test -- --run
docker compose --env-file .env run --build --rm --no-deps frontend npm run build

docker compose --env-file .env run --build --rm --no-deps auth-service pytest -q
docker compose --env-file .env run --build --rm --no-deps provider-registry-service pytest -q
docker compose --env-file .env run --build --rm --no-deps red-provider-service pytest -q
docker compose --env-file .env run --build --rm --no-deps green-provider-service pytest -q
docker compose --env-file .env run --build --rm --no-deps blue-provider-service pytest -q
docker compose --env-file .env run --build --rm --no-deps catalog-service pytest -q
docker compose --env-file .env run --build --rm --no-deps status-service pytest -q
docker compose --env-file .env run --build --rm --no-deps reservation-service pytest -q
docker compose --env-file .env run --build --rm --no-deps analytics-service pytest -q
docker compose --env-file .env run --build --rm --no-deps billing-service pytest -q
docker compose --env-file .env run --build --rm --no-deps scheduler-service pytest -q
docker compose --env-file .env run --build --rm --no-deps analytics-service pytest -q /tmp/packages/events/tests
```

If the shared-events path differs inside the image, locate the mounted package path safely and report the exact path used.

### 7. Docker Compose live `.env` startup

Run:

```bash
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

Verify all containers become healthy.

If transient PostgreSQL connection-refused startup errors occur:

- wait for the relevant database containers to become healthy;
- restart only the affected service containers;
- record the event as a warning;
- verify final health state before passing the check.

### 8. Gateway and public health checks

Through `http://localhost:8080`, verify:

- `/`
- `/health`
- `/api/auth/health`
- `/api/providers/health`
- `/api/catalog/health`
- `/api/status/health`
- `/api/reservations/health`
- `/api/analytics/health`
- `/api/billing/health`
- `/api/scheduler/health`

Report only status codes and pass/fail.

### 9. Authenticated role smokes through gateway

Use configured demo credentials from the runtime environment without printing passwords or tokens.

EV smoke:

- login through `/api/auth/auth/login`;
- verify `/api/auth/auth/me`;
- verify a read-only EV route such as `/api/reservations/reservations/me`;
- optionally verify catalog read-only query.

Provider-admin smoke:

- login through `/api/auth/auth/login`;
- verify `/api/auth/auth/me`;
- verify a provider-scoped read-only route:
  - provider analytics summary;
  - provider billing overview;
  - provider invoice listing.

Operator smoke:

- login through `/api/auth/auth/login`;
- verify `/api/auth/auth/me`;
- verify operator analytics summary;
- verify `/api/scheduler/jobs`;
- verify `/api/scheduler/runs`.

Do not print access tokens or refresh tokens.

### 10. Scheduler/control-plane live verification

Verify:

- `/api/scheduler/health` returns HTTP `200`;
- `/api/scheduler/jobs` works for operator only;
- `/api/scheduler/runs` works for operator only;
- unauthenticated scheduler operator APIs require auth;
- EV/provider-admin accounts cannot access operator scheduler surfaces.

Verify service-owned internal job gateway paths return HTTP `404`:

- `/api/catalog/internal/jobs/catalog/freshness`
- `/api/analytics/internal/jobs/freshness`
- `/api/billing/internal/jobs/freshness`
- `/api/reservations/internal/jobs/freshness`

Run one safe scheduler manual run:

- job key: `billing.prepare-invoices`

Requirements:

- trigger through scheduler operator API;
- target Docker-internal service URL;
- expect target HTTP `200`;
- do not issue invoices;
- do not perform live provider reservation mutation.

### 11. Live provider read-only verification

Using real provider credentials from `.env`, run safe read-only checks only.

Direct live provider checks:

redPlug:

- list points;
- one safe point detail using an ID from the list.

greenPlug:

- list charging points;
- one safe charging-point detail using an ID from the list.

bluePlug:

- list locations;
- one safe status/detail check using an ID from the list.

Requirements:

- use `Authorization: Bearer <apiKey>`;
- do not print API keys;
- do not print full raw response bodies;
- report only:
  - provider;
  - endpoint type;
  - HTTP status;
  - JSON valid yes/no;
  - record count;
  - selected safe ID redacted or summarized if necessary;
  - top-level response key names only;
  - pass/fail.

Provider-service mediated read-only checks:

- If feasible through Docker-internal calls or gateway-safe service flows, verify that provider services can perform read-only list/detail/status calls using the same `.env` values.
- Do not expose provider services publicly.
- Do not add new public routes.

### 12. Catalog/status live-read verification

Verify a safe catalog/status path after live provider credentials are active:

- Trigger catalog import through an operator-only existing route or through the scheduler-controlled safe job if already available.
- Prefer a safe import/list/status read-only flow.
- Do not perform provider reservation mutations.
- Verify catalog contains provider-derived data or reports a coherent provider/API result.
- Verify status lookup uses status-service and returns normalized status.
- Report counts/statuses only.

### 13. Google OAuth verification

Use real `.env` values without printing secrets.

Non-interactive verification:

- call the Google login initiation endpoint;
- verify OAuth is configured;
- verify generated authorization URL host is `accounts.google.com`;
- verify redirect URI matches:

```text
http://localhost:8080/api/auth/auth/google/callback
```

- verify expected scope presence;
- do not print full authorization URL if it contains credential-bearing parameters.

Full browser callback verification:

- If browser automation is available and the environment allows interactive Google login, attempt a full OAuth login/callback flow safely.
- Do not print OAuth authorization codes, access tokens, ID tokens, refresh tokens, cookies, or session tokens.
- Verify final authenticated session or `/api/auth/auth/me` result only.
- If browser automation or interactive login is unavailable, report this clearly as skipped and provide exact manual verification steps for the user.

Manual verification steps to report if full browser OAuth is skipped:

```text
1. Start the stack with `docker compose --env-file .env up -d --build`.
2. Open `http://localhost:8080/login`.
3. Click the Google login option.
4. Complete Google authentication.
5. Confirm the callback returns to `http://localhost:8080`.
6. Confirm the app shows an authenticated session and `/api/auth/auth/me` succeeds through the gateway.
7. Do not paste OAuth codes, tokens, cookies, or secrets into chat or logs.
```

### 14. Live reservation mutation policy

By default:

- skip live reservation mutation;
- record `Live reservation mutation: skipped because RUN_LIVE_RESERVATION_SMOKE=true was not set`.

Only if `RUN_LIVE_RESERVATION_SMOKE=true` is explicitly set:

- run exactly one controlled live reservation smoke;
- use the smallest safe scope;
- record provider, HTTP status, normalized result, and whether a reservation was created;
- do not print sensitive payloads;
- do not repeat mutations;
- stop immediately after one result.

### 15. Root gateway contract tests

After the full stack is running, run:

```bash
python3 -m unittest discover tests -v
```

### 16. PlantUML validation

If PlantUML is available, run:

```bash
plantuml -checkonly docs/diagrams/final/*.puml
```

If PlantUML is unavailable, clearly report it as unavailable and do not claim validation passed.

### 17. AI log and final documentation updates

Create or update this run report:

```text
docs/ai/codex-runs/022-live-env-full-verification.md
```

The report must include:

- run title and date;
- invocation prompt summary;
- canonical files read;
- `.env` handling statement;
- redacted `.env` structural validation results;
- exact commands run;
- test results;
- Docker Compose health results;
- gateway health results;
- authenticated role-smoke results;
- scheduler/manual-run results;
- live provider read-only results;
- Google OAuth results;
- live reservation mutation status;
- unavailable tools;
- warnings/skips;
- blockers;
- final readiness conclusion.

Update:

- `docs/ai/prompt-log.md` with Run `022` if the report is created.
- `docs/final-verification.md` only if this run adds materially new live `.env` results.
- `docs/submission-checklist.md` only if this run changes final verification/submission readiness.

Do not rewrite final docs unnecessarily.

### 18. GitHub issue/project update

If all required live `.env` verification checks pass with no blockers:

- close issue `#19` as completed;
- move its GitHub Project `#3` item to Done if GitHub CLI/project permissions are available;
- leave issue `#20` open/Todo.

If GitHub CLI/project permissions are unavailable:

- report this clearly;
- do not fabricate project update success;
- do not create fallback Markdown project-management artifacts.

### 19. Cleanup

At the end, run:

```bash
docker compose --env-file .env down
docker compose --env-file .env ps -a
```

Do not delete local volumes unless explicitly instructed.

Do not remove local `.env`.

## Final response format

Return exactly these sections:

```markdown
## Result

PASS / PASS_WITH_WARNINGS / FAIL

## Commands/checks run

Summarize commands and verification categories.

## Passed checks

List passed checks.

## Warnings / skipped checks

List only real warnings/skips grounded in the run.

## Blockers

Say `No blockers` only if supported by verification results.

## Files changed

List changed files.

## GitHub issue/project updates

State whether issue #19 was closed and moved to Done, whether issue #20 was left open, and whether Project #3 update succeeded.

## Final readiness

State whether the repository is ready for final NTUA course submission using the live `.env` verification evidence.
```

Remember:

- Verification only.
- Use `.env` privately.
- Do not print secrets.
- Do not implement features.
- Do not change architecture.
- Do not deploy.
- Do not use Vercel.
- Keep all repository content in English.
