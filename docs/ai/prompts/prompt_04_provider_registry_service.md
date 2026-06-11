# Prompt 04 - Provider Registry Service

## 1. Task

Implement the `provider-registry-service` MVP baseline for the saasPlug project.

This prompt must be executed only after Prompt 03 has been reviewed and accepted. Treat the current repository state as the post-Prompt-03 baseline.

## 2. Mandatory context

Before changing files, read and follow:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/prompts/README.md`
4. `docs/ai/codex-runs/_template.md`
5. `docs/ai/prompt-log.md`
6. `docs/ai/codex-runs/002-docker-gateway.md`
7. `docs/ai/codex-runs/003-auth-service.md`
8. `services/provider-registry-service/README.md`
9. `services/provider-registry-service/app/main.py`
10. `services/auth-service/README.md`
11. `services/auth-service/app/schemas.py`
12. `services/auth-service/app/security.py`
13. `services/auth-service/app/dependencies.py`
14. `docker-compose.yml`
15. `deploy/nginx/default.conf`
16. `.env.example`
17. Provider OpenAPI files under `docs/assignment/providers/yaml/`, only as provider identity/config context, not as adapter implementation input for this prompt.

The canonical project rules remain:

- all repository files, code, comments, documentation, prompts, and AI logs must be in English;
- `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` are canonical;
- do not rename services, providers, roles, gateway paths, database containers, or accepted architecture elements;
- keep one PostgreSQL container per stateful service;
- do not introduce MongoDB, Redis, Kubernetes, a new orchestrator service, or additional infrastructure;
- do not create `.env` or commit real secrets.

## 3. Goal

Implement `provider-registry-service`, which owns provider registration, provider metadata, provider activation status, provider API configuration metadata, provider config audit/log metadata, and provider lookup for internal services.

The service must support the three canonical providers:

- `redPlug`
- `greenPlug`
- `bluePlug`

This prompt must produce a practical MVP implementation that later provider services can use as the source of truth for provider metadata and safe integration configuration.

## 4. Scope

Implement only the following for `provider-registry-service`:

1. SQLAlchemy-based local persistence using `provider-registry-postgres`.
2. Deterministic MVP startup table creation, consistent with the existing Prompt 03 auth-service style.
3. Idempotent seed data for the three providers.
4. Provider metadata and status endpoints.
5. Provider API configuration metadata endpoints with safe redaction.
6. Role/provider-scope authorization using JWT bearer tokens issued by `auth-service`.
7. Operator and provider-admin access rules.
8. Provider config audit records.
9. Containerized tests for provider-registry-service.
10. Documentation and AI run logs.
11. GitHub issue cleanup for completed prompts 02 and 03, and issue closure for Prompt 04 only after Prompt 04 acceptance criteria pass.

## 5. Explicit non-goals

Do not implement:

- provider adapter logic;
- external redPlug/greenPlug/bluePlug API calls;
- charging-point synchronization;
- provider-local point snapshots;
- catalog aggregation;
- status cache logic;
- reservation flow;
- RabbitMQ business publishers or consumers;
- analytics;
- billing;
- frontend screens;
- Google OAuth token exchange;
- refresh-token rotation;
- Alembic migrations unless already introduced by previous code;
- real provider API secrets;
- real payment logic;
- new services or infrastructure.

Provider adapter implementation belongs to Prompt 05.

## 6. Expected files and structure

Extend the existing `services/provider-registry-service` scaffold using the same style as `auth-service` where appropriate.

Expected new or modified files include, but are not limited to:

```text
services/provider-registry-service/app/config.py
services/provider-registry-service/app/database.py
services/provider-registry-service/app/models.py
services/provider-registry-service/app/schemas.py
services/provider-registry-service/app/security.py
services/provider-registry-service/app/dependencies.py
services/provider-registry-service/app/seed.py
services/provider-registry-service/app/routes.py
services/provider-registry-service/app/main.py
services/provider-registry-service/tests/test_provider_registry_api.py
services/provider-registry-service/requirements.txt
services/provider-registry-service/Dockerfile
services/provider-registry-service/README.md
```

Also update, if needed:

```text
.env.example
docker-compose.yml
README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/004-provider-registry-service.md
```

Do not modify `docs/specs/SPECIFICATIONS.md` unless a hard contradiction is found. If such a contradiction is found, stop and report it instead of silently changing the accepted specs.

## 7. Data model requirements

Create an MVP data model owned only by `provider-registry-service`.

At minimum, persist providers with fields equivalent to:

- `id` - stable UUID/string primary key;
- `provider_code` - unique canonical code: `redPlug`, `greenPlug`, `bluePlug`;
- `display_name` - user-facing provider name;
- `legal_name` - optional legal/business name;
- `contact_email` - optional provider contact email;
- `api_base_url` - provider API base URL;
- `api_key_env_var` - name of the environment variable that contains the API key, not the actual secret;
- `api_auth_type` - simple string such as `api_key` or `none`;
- `api_auth_header` - optional header name, such as `X-API-Key`;
- `timeout_seconds` - positive integer default suitable for MVP local calls;
- `is_active` - whether the provider is enabled in saasPlug;
- `is_seeded` - whether the provider came from deterministic seed data;
- `created_at`;
- `updated_at`.

Create a provider configuration audit/log table with fields equivalent to:

- `id`;
- `provider_id`;
- `provider_code`;
- `actor_user_id` or equivalent claim value;
- `actor_email`;
- `actor_roles`;
- `action` - for example `seeded`, `created`, `updated`, `status_changed`;
- `changed_fields` as JSON/text JSON;
- `created_at`.

Do not store real API key values in the database. Store only safe metadata such as an environment-variable name and a boolean/hint indicating that a secret is expected to be configured elsewhere.

## 8. Seed data requirements

Seed the three canonical providers idempotently.

Use safe placeholder/default values derived from `.env.example` and `docker-compose.yml` where applicable:

- `RED_PROVIDER_BASE_URL`
- `GREEN_PROVIDER_BASE_URL`
- `BLUE_PROVIDER_BASE_URL`
- `RED_PROVIDER_API_KEY`
- `GREEN_PROVIDER_API_KEY`
- `BLUE_PROVIDER_API_KEY`

Recommended seed defaults:

| provider_code | display_name | api_key_env_var |
|---|---|---|
| `redPlug` | `redPlug` | `RED_PROVIDER_API_KEY` |
| `greenPlug` | `greenPlug` | `GREEN_PROVIDER_API_KEY` |
| `bluePlug` | `bluePlug` | `BLUE_PROVIDER_API_KEY` |

Seed logic must be repeatable without duplicating rows or audit records unnecessarily. It may update seed-owned mutable fields if environment defaults change, but must do so deterministically and safely.

## 9. Authorization requirements

Implement provider-registry authorization using JWT bearer tokens issued by `auth-service`.

For this MVP, it is acceptable for `provider-registry-service` to verify JWT access tokens locally using the shared `JWT_SECRET`, provided that it does not access the `auth-postgres` database and does not perform cross-service SQL reads.

Required claims to consume:

- `sub`
- `email`
- `roles`
- `provider_id`
- `provider_code`
- `exp`

Access rules:

1. `OPERATOR` may list/read/create/update any provider and change provider activation status.
2. `PROVIDER_ADMIN` may read its own provider and update only safe editable metadata for its own provider.
3. `PROVIDER_ADMIN` must not read or update another provider.
4. `EV_USER` must not access provider registry management endpoints.
5. Public unauthenticated access must be limited to health/readiness endpoints only.

Do not trust client-provided `provider_code` for scope decisions when a JWT contains provider scope. Compare against the authenticated token claims.

## 10. API requirements

Keep `/health` and `/ready` available.

Implement simple JSON endpoints. The exact route names may be adjusted to fit the existing gateway behavior, but must remain coherent with the gateway paths:

```text
GET    /providers
GET    /providers/{provider_code}
POST   /providers
PATCH  /providers/{provider_code}
PATCH  /providers/{provider_code}/status
GET    /providers/{provider_code}/integration-config
GET    /providers/{provider_code}/audit-logs
```

Recommended behavior:

- `GET /providers`: operator sees all providers; provider admin sees only its own provider.
- `GET /providers/{provider_code}`: operator sees any provider; provider admin sees only matching provider.
- `POST /providers`: operator-only; creates a new provider record if future providers are added later. It must not be used to add adapter services in this prompt.
- `PATCH /providers/{provider_code}`: operator can update all safe metadata; provider admin can update only safe editable fields for own provider.
- `PATCH /providers/{provider_code}/status`: operator-only; changes `is_active`.
- `GET /providers/{provider_code}/integration-config`: returns safe configuration needed by internal services, with no raw secrets. It may include `api_base_url`, `api_key_env_var`, `api_auth_type`, `api_auth_header`, `timeout_seconds`, and `is_active`.
- `GET /providers/{provider_code}/audit-logs`: operator can read any provider audit logs; provider admin can read only own provider audit logs.

All API key or secret fields must be redacted or represented only by env-var references. Do not expose actual secret values.

## 11. Gateway requirements

The existing gateway already routes:

```text
/api/provider-registry/ -> provider-registry-service
/api/providers/         -> provider-registry-service
```

Preserve this behavior unless a minimal route fix is required. Frontend and smoke examples must call through the gateway, not Docker-internal service names.

## 12. Docker and environment requirements

If needed, extend `provider-registry-service` in `docker-compose.yml` with safe environment variables:

- `JWT_SECRET`
- provider base URL placeholders;
- provider API-key env-var names or placeholder values;
- optional internal token placeholder only if truly needed.

Keep `.env.example` placeholder-only.

Do not create `.env`.

## 13. Tests and validation

Add meaningful tests for `provider-registry-service`.

At minimum, tests must verify:

1. health endpoint still works;
2. seed providers are created idempotently;
3. operator can list all seeded providers;
4. provider admin can read only its own provider;
5. provider admin cannot read/update another provider;
6. EV user cannot access management endpoints;
7. operator can update provider metadata/status;
8. integration config response does not expose raw secrets;
9. audit log is written for provider update/status changes.

Use the existing auth JWT format. Tests may create test tokens locally with the same signing logic or shared JWT helper, but must not depend on the real auth-service database.

Run validation commands including, at minimum:

```text
git diff --check
docker compose config
docker compose run --rm --no-deps provider-registry-service pytest -q
docker compose up -d --build
docker compose ps
```

Also perform gateway smoke tests through `localhost:8080`, including:

```text
/health
/api/provider-registry/health
/api/providers/health
```

Where practical, smoke-test authenticated provider-registry calls through the gateway using a seeded auth-service login token. Do not print tokens or secrets in logs.

Finish with:

```text
docker compose down -v
```

Verify no Compose containers remain if practical.

## 14. Documentation requirements

Update:

1. `services/provider-registry-service/README.md`
2. root `README.md`
3. `docs/ai/prompt-log.md`
4. `docs/ai/codex-runs/004-provider-registry-service.md`

The service README must document:

- service purpose and ownership boundary;
- owned tables;
- seeded providers;
- authorization rules;
- endpoint summary;
- safe secret handling policy;
- local test commands;
- limitations/deferred work.

The root README must summarize the Prompt 04 provider-registry status without over-describing implementation details.

The run report must follow `docs/ai/codex-runs/_template.md` and include:

- exact invocation prompt;
- canonical task prompt file path;
- canonical sources read;
- files changed;
- commands run and results;
- tests and smoke checks;
- warnings/limitations;
- GitHub issue actions;
- final status.

## 15. GitHub issue cleanup requirements

This prompt explicitly allows GitHub issue mutations for the relevant staged implementation issues.

Before or during the run, inspect the issue state for:

```text
#2 Prompt 02 - Docker Compose and Nginx gateway
#3 Prompt 03 - Auth service
#4 Prompt 04 - Provider registry service
```

If issues #2 and #3 are still open, close them as `completed` because their run reports show completed validation. Add a concise issue comment before closing when practical, referencing:

```text
docs/ai/codex-runs/002-docker-gateway.md
docs/ai/codex-runs/003-auth-service.md
```

After Prompt 04 acceptance criteria pass, close issue #4 as `completed` and add a concise issue comment referencing:

```text
docs/ai/codex-runs/004-provider-registry-service.md
```

If GitHub CLI/API mutations fail, report the failure explicitly in:

1. the final Codex response;
2. `docs/ai/codex-runs/004-provider-registry-service.md`.

Do not create fallback Markdown project-management artifacts such as `docs/project-management/`.

## 16. Acceptance criteria

The run is acceptable only if:

1. `provider-registry-service` implements real local persistence in `provider-registry-postgres`.
2. The three canonical providers are seeded idempotently.
3. Provider metadata, safe integration config, status, and audit logs are available through JSON endpoints.
4. JWT role/provider-scope authorization works for operator, provider admin, and EV user cases.
5. Provider admins cannot access or modify another provider.
6. Real secrets are not stored or exposed.
7. Tests pass in the provider-registry-service container.
8. `docker compose config` passes.
9. Full stack builds/starts and healthchecks pass.
10. Gateway smoke checks pass.
11. `.env` is not created.
12. No unrelated services or frontend screens are implemented.
13. AI logs and README files are updated.
14. GitHub issue actions for #2, #3, and #4 are attempted and reported.

## 17. Final response format

Return a concise Codex final response with:

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

- files created;
- files modified;
- validation commands and results;
- GitHub issue action results;
- warnings/blockers;
- explicit statement that no out-of-scope business logic or secrets were added;
- next recommended action: review the Prompt 04 diff, then proceed to Prompt 05 for provider services.
