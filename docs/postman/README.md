# saasPlug Local Postman and Newman Suites

This folder contains app-level Postman collections for the local saasPlug Docker Compose application. Every request uses the Nginx gateway base URL:

```text
{{baseUrl}} = http://localhost:8080
```

The collections are not generated from the root `openapi.json`. That file describes the professor-provided provider-reference API, not the local saasPlug app API. The provider collections under `docs/assignment/providers/postman_collections/` are provider-direct collections that call external provider APIs, so they are intentionally separate from these app-level suites.

## Files

| File | Purpose |
|---|---|
| `saasPlug.local.smoke.postman_collection.json` | Fast sanity checks, login, token capture, basic role reads, catalog capture, and one negative auth check. |
| `saasPlug.local.regression.postman_collection.json` | Read-heavy functional regression collection used with four iteration data files. |
| `saasPlug.local.security.postman_collection.json` | Auth, authorization, validation, and gateway-block negative tests. |
| `saasPlug.local.mutation.postman_collection.json` | Small safe local mutation checks plus manual broad/external side-effect requests that skip by default. |
| `saasPlug.local.postman_environment.json` | Local environment template with placeholders only. |
| `data/*.json` | Newman iteration data for high-volume and mutation runs. |
| `newman/README.md` | Runner-specific notes. |

## Local setup

Start the application before running Newman or Postman Runner:

```bash
docker compose --env-file .env up -d --build
```

Do not commit `.env`. The environment file in this folder contains only placeholders.

To reset local state after mutation testing:

```bash
docker compose down -v --remove-orphans
```

## Credentials

Import `saasPlug.local.postman_environment.json` into Postman and fill only your local current value for:

```text
demoPassword
```

The Newman scripts do not require storing `demoPassword` in the Postman environment JSON. They read the seeded demo password from a local app env file without sourcing it and pass only that value to Newman as an in-memory `--env-var`.

Supported password variable names are checked in this order:

```text
DEMO_USER_PASSWORD
DEMO_PASSWORD
SEED_DEMO_PASSWORD
AUTH_DEMO_PASSWORD
AUTH_SEED_PASSWORD
SAASPLUG_DEMO_PASSWORD
```

Env-file precedence for every runner script:

```text
1. scripts/postman/run-*.sh --env-file <path>
2. SAASPLUG_ENV_FILE=<path> scripts/postman/run-*.sh
3. .env
```

`POSTMAN_ENV_FILE` still overrides the Postman environment JSON path:

```bash
POSTMAN_ENV_FILE=docs/postman/saasPlug.local.postman_environment.json scripts/postman/run-smoke.sh --env-file .env
```

Use the seeded emails already present in the environment:

```text
evuser@saasplug.local
red-admin@saasplug.local
operator@saasplug.local
```

The collections capture access and refresh tokens into environment variables such as `evAccessToken`, `providerAccessToken`, and `operatorAccessToken`. Do not export or commit an environment after filling real local credentials or after capturing tokens.

## Running in Postman

1. Import all four collections.
2. Import `saasPlug.local.postman_environment.json`.
3. Select the imported environment.
4. Fill `demoPassword` locally.
5. Run `saasPlug.local.smoke` first to capture tokens and a catalog point if one exists.
6. Run regression, security, or mutation collections with the matching data files from `docs/postman/data/`.

## Running with Newman

From the repository root:

```bash
scripts/postman/run-smoke.sh --env-file .env
scripts/postman/run-regression.sh --env-file .env
scripts/postman/run-security.sh --env-file .env
scripts/postman/run-mutation.sh --env-file .env
```

Or use an environment variable instead of a CLI flag:

```bash
SAASPLUG_ENV_FILE=.env scripts/postman/run-smoke.sh
```

The runner scripts write reports to `reports/postman/`. They run `npx --yes newman`, fail on failed tests, and do not print credentials. `reports/` is ignored by git because exported Newman environments can contain live access and refresh tokens.

`scripts/postman/run-all-local.sh` supports the same `--env-file` and `SAASPLUG_ENV_FILE` behavior, but it is not required for step-by-step validation. Prefer running smoke, regression, security, and mutation explicitly when diagnosing failures.

## Call-count estimates

Smoke is intentionally small:

```text
smoke_calls = 14 requests
```

Regression uses four Newman folder runs and iteration data:

```text
EV Search Reads: 11 requests * 30 iterations = 330
Catalog Status Reads: 8 requests * 30 iterations = 240
Provider Read Cases: 13 requests * 25 iterations = 325
Operator Read Cases: 17 requests * 20 iterations = 340
total_calls = 1235 read-heavy regression calls
```

Security uses one folder and one data file:

```text
Negative Security Cases: 34 requests * 32 iterations = 1088
total_calls = 1088 security calls
```

Mutation is intentionally small:

```text
Local Auth Mutations: 7 requests * 1 iteration = 7
Reversible Provider Metadata: 4 requests * 1 iteration = 4
Pricing Local Mutations: 2 requests * 1 iteration = 2
Scheduler Reversible Mutations: 4 requests * 1 iteration = 4
total_safe_mutation_calls = 17 calls
```

The regression and security runner scripts perform a smoke preflight first to hydrate tokens into a temporary Newman environment. The call counts above describe the target suite calls, not the preflight.

## Read-only and mutation boundaries

Read-only suites:

- Smoke is mostly read-only, but login creates refresh tokens in auth-service.
- Regression is read-heavy and avoids reservation creation, provider imports, event drains, invoice issuance, mock payments, and scheduler job execution.
- Security performs negative requests. Reservation validation cases use invalid bodies or idempotency mismatch so they fail before provider mutation.

Mutation suite:

- Registers a disposable local EV user.
- Exercises refresh/logout/password change for that disposable user.
- Patches provider display name and reverts it.
- Creates and patches an inactive pricing rule. This leaves a local inactive row for auditability.
- Pauses and resumes one scheduler job.

Manual or skipped-by-default requests:

- Reservation creation.
- Catalog imports and provider sync paths.
- Event consume/drain/outbox publish requests.
- Invoice issuance and mock payment.
- Provider usage CSV export, because it records a local export job.
- Scheduler job run and ordered maintenance run.

Those requests may call provider services, read external provider APIs, issue local invoices, publish/drain queues, or mutate scheduler targets. They are in the manual folder and default to `/health` unless `allowManualMutations=true` is set.

The broad manual mutation folder remains disabled unless explicitly enabled. The safe mutation runner does not execute provider imports, high-volume reservation creation, event drains, invoice issuance, mock payment, or broad scheduler run endpoints.

## Empty catalog behavior

A fresh local stack may have no catalog rows until an operator import has run. Smoke and regression handle this by capturing the first usable point only when one exists. Point-dependent requests fall back to `/health` and record a skipped-style passing test when no point was captured.

To populate catalog data manually, use the frontend operator catalog page or explicitly run a manual catalog import request from the mutation collection after deciding that provider read calls are acceptable in your environment.

Most EV point routes require both:

```text
providerCode
externalPointId
```

The catalog list scripts capture `pointId`, `normalizedPointId`, `providerCode`, and `externalPointId` from the first usable catalog point.

## Common status interpretation

| Status | Meaning |
|---|---|
| 200/201/204 | Successful read or mutation. |
| 400 | Bad input or unsupported provider code handled by application logic. |
| 401 | Missing or invalid bearer token. |
| 403 | Authenticated user lacks the required role or provider scope. |
| 404 | Missing resource or intentionally blocked gateway docs/internal route. |
| 405 | Unsupported HTTP method. |
| 409 | Conflict, such as duplicate records or idempotency mismatch. |
| 422 | FastAPI/Pydantic validation error. |
| 5xx | Service/provider/runtime failure; inspect Docker logs and service health. |

## Safety checks

The collections must not contain direct provider URLs, Docker service hostnames, direct service ports, or internal provider adapter URLs. Static validation should reject request URLs containing those values.
