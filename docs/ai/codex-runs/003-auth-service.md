# Codex Run 003 - Auth Service

## 1. Run Metadata

| Field | Value |
|---|---|
| Run ID | `003` |
| Date/time | `2026-06-11 22:02 EEST +0300` |
| Working directory | `/home/peppasmich/NTUA-saasPlug` |
| Repository branch | `main` |
| Commit before run | `7fe94e2` |
| Commit after run | not committed |
| Codex model | GPT-5, from system/developer context |
| Reasoning effort | not visible to Codex |
| Approval policy | `never` |
| Sandbox mode | `danger-full-access` |
| Network access | enabled |
| Status | `completed` |

## 2. Invocation Prompt

```text
Read and execute docs/ai/prompts/prompt_03_auth_service.md.

Follow AGENTS.md and docs/specs/SPECIFICATIONS.md.

Use docs/ai/codex-runs/_template.md for the run report.

Update docs/ai/codex-runs/003-auth-service.md and docs/ai/prompt-log.md.

Record both the exact invocation prompt and the canonical task prompt file/content where practical.

Implement only the auth-service scope defined in Prompt 03: local auth persistence, email/password login, JWT access tokens, refresh tokens, seeded demo users, role/provider scoping helpers, safe Google OAuth hook endpoints, tests, documentation, and validation.

Do not implement frontend login screens, provider-registry business logic, provider adapters, catalog sync/search, status cache logic, reservation flow, analytics, billing, RabbitMQ business consumers, real secrets, GitHub issue/project mutations, or fallback Markdown project-management artifacts.
```

## 3. Canonical Task Prompt

| Field | Value |
|---|---|
| Canonical prompt file | `docs/ai/prompts/prompt_03_auth_service.md` |
| Relationship to invocation prompt | Invocation references canonical prompt |

## 4. Canonical Task Prompt Content

The canonical task prompt file existed before this run as an untracked working-tree file. It was read and used as the task authority. The file is 519 lines, so the full content is not duplicated here to keep the run report reviewable. Canonical file path:

```text
docs/ai/prompts/prompt_03_auth_service.md
```

## 5. Goal

Implement only the Prompt 03 `auth-service` MVP authentication and authorization baseline:

- local auth persistence in `auth-postgres`,
- email/password registration and login,
- JWT access tokens,
- hashed persisted refresh tokens,
- seeded demo users,
- role and provider-scope dependencies,
- safe Google OAuth hook endpoints,
- tests and validation,
- documentation and AI logs.

Explicit non-goals: frontend login screens, provider-registry business logic, provider adapters, catalog sync/search, status cache behavior, reservation flow, analytics, billing, RabbitMQ business consumers, real secrets, GitHub project/issue mutations, and fallback Markdown project-management artifacts.

## 6. Canonical Sources Read

| File | Purpose |
|---|---|
| `AGENTS.md` | Repository rules, canonical names, roles, provider codes, auth ownership, logging rules |
| `docs/specs/SPECIFICATIONS.md` | Accepted auth, data ownership, Docker, gateway, and testing specifications |
| `docs/ai/prompts/prompt_03_auth_service.md` | Canonical Prompt 03 task |
| `docs/ai/codex-runs/_template.md` | Run report format |
| `docs/ai/prompt-log.md` | Prompt index to update |
| `docs/ai/codex-runs/002-docker-gateway.md` | Prior Docker/gateway baseline context |
| `README.md` | Root documentation to update |
| `.env.example` | Safe auth placeholders to extend |
| `docker-compose.yml` | Auth runtime environment |
| `deploy/nginx/default.conf` | Gateway route behavior |
| `services/README.md` | Services context |
| `services/auth-service/README.md` | Auth-service documentation context |
| `services/auth-service/app/main.py` | Existing health-only scaffold to replace with auth app |

## 7. Files Changed

### Created

| File | Purpose |
|---|---|
| `services/auth-service/app/config.py` | Environment-driven auth-service settings |
| `services/auth-service/app/database.py` | SQLAlchemy engine/session setup and deterministic MVP table creation helpers |
| `services/auth-service/app/models.py` | `users` and `refresh_tokens` SQLAlchemy models |
| `services/auth-service/app/schemas.py` | Pydantic request/response schemas and canonical roles |
| `services/auth-service/app/security.py` | Password hashing, JWT, refresh-token hashing helpers |
| `services/auth-service/app/dependencies.py` | Current-user, role, and provider-scope dependencies |
| `services/auth-service/app/seed.py` | Idempotent seeded demo users |
| `services/auth-service/app/routes.py` | Auth, role-check, and Google OAuth hook endpoints |
| `services/auth-service/tests/test_auth_api.py` | Auth-service unit/API tests with SQLite override |
| `docs/ai/codex-runs/003-auth-service.md` | Prompt 03 run report |

### Modified

| File | Summary |
|---|---|
| `.env.example` | Added `DEMO_USER_PASSWORD` and corrected local Google callback gateway path |
| `README.md` | Documented Prompt 03 auth status, demo users, and auth gateway examples |
| `docker-compose.yml` | Added auth-service safe env passthrough for JWT, demo password, and Google OAuth placeholders |
| `services/auth-service/Dockerfile` | Added `PYTHONPATH=/app` and copied tests into the image for containerized pytest |
| `services/auth-service/README.md` | Replaced scaffold notes with auth behavior, endpoints, tokens, demo users, and tests |
| `services/auth-service/app/main.py` | Replaced health-only scaffold with auth app startup, DB init, seeding, and routes |
| `services/auth-service/requirements.txt` | Added SQLAlchemy, psycopg, PyJWT, bcrypt, pytest, and httpx |
| `docs/ai/prompt-log.md` | Added Prompt 03 row |

### Intentionally Not Changed

| File/area | Reason |
|---|---|
| `docs/specs/SPECIFICATIONS.md` | Canonical accepted specs; no spec change requested |
| `deploy/nginx/default.conf` | Existing `/api/auth/` gateway mapping already supports Prompt 03 routes |
| Other services | Prompt 03 scope is auth-service only |
| Frontend app | Frontend login screens are forbidden in Prompt 03 |
| Provider/catalog/status/reservation/analytics/billing business domains | Explicitly forbidden |
| RabbitMQ business consumers | Explicitly forbidden |
| GitHub issues/projects/milestones | Explicitly forbidden |
| `.env` | Explicitly forbidden; verified absent |
| `docs/ai/prompts/prompt_03_auth_service.md` | Pre-existing untracked canonical prompt file; read but not modified |

## 8. Commands Run

| Command | Result | Notes |
|---|---|---|
| `sed -n ... AGENTS.md docs/specs/SPECIFICATIONS.md ...` | pass | Read mandatory canonical and task files |
| `rg -n "SPEC-8|Authentication|auth-service|JWT|Google OAuth|refresh" docs/specs/SPECIFICATIONS.md` | pass | Located auth-specific specs |
| `git status --short && git branch --show-current && git rev-parse --short HEAD` | pass | Captured branch/status/commit |
| `git diff --check` | pass | No whitespace errors |
| `docker compose config` | pass | Compose remained valid |
| `docker compose build auth-service` | pass | Built auth-service image |
| `docker compose run --rm --no-deps auth-service pytest -q` | fail then pass | First run failed due missing import path; fixed with `PYTHONPATH=/app`; final run passed |
| `docker compose down -v` | pass | Cleaned temporary test network/volumes and final smoke runtime |
| `docker compose up -d --build` | pass | Full stack built and started |
| `docker compose ps` | pass | All containers healthy |
| `curl -fsS http://localhost:8080/health` | pass | Gateway health returned healthy JSON |
| `curl -fsS http://localhost:8080/api/auth/health` | pass | Auth health through gateway returned healthy JSON |
| Sanitized auth login/me/refresh/logout/Google smoke script | pass | Verified gateway auth flow without printing tokens |
| `date '+%Y-%m-%d %H:%M:%S %Z %z'` | pass | Captured run timestamp |

## 9. Implementation / Audit Summary

`auth-service` now owns local authentication persistence and initializes its MVP tables on startup. The startup path creates `users` and `refresh_tokens`, then idempotently seeds the operator, EV user, and provider-admin demo users. Passwords are stored as bcrypt hashes.

The service implements JSON endpoints under `/auth/...` for register, login, refresh, logout, current user, operator role verification, provider-admin scope verification, and Google OAuth hooks. JWT access tokens include `sub`, `email`, `roles`, `provider_id`, `provider_code`, and `exp`. Refresh tokens are generated as opaque tokens, stored hashed, and revoked on logout. Refresh-token rotation is intentionally deferred for Prompt 03 and documented.

Google OAuth hooks return clear non-500 JSON in local placeholder mode. When credentials are configured, the login hook builds a standards-compatible Google authorization URL; actual Google token exchange remains deferred.

## 10. Tests and Checks

| Check | Result | Notes |
|---|---|---|
| `docker compose run --rm --no-deps auth-service pytest -q` | pass | `9 passed in 22.67s` |
| `git diff --check` | pass | No whitespace errors |
| `docker compose config` | pass | Compose valid after auth env changes |
| `docker compose up -d --build` | pass | Full stack started |
| `docker compose ps` | pass | All services and databases healthy |
| Gateway `/health` | pass | `{"service":"nginx-gateway","status":"healthy"}` |
| Gateway `/api/auth/health` | pass | `{"service":"auth-service","status":"healthy"}` |
| Gateway login | pass | `operator@saasplug.local` logged in; tokens existed but were not printed |
| Gateway `/auth/me` | pass | Bearer token returned operator user and role |
| Gateway `/auth/refresh` | pass | Refresh token issued a new access token |
| Gateway `/auth/logout` | pass | Refresh token revoked idempotently |
| Gateway `/auth/google/login` | pass | Placeholder mode returned `google_oauth_not_configured` JSON |
| `docker compose down -v` | pass | Final runtime cleaned up |

## 11. Limitations, Warnings, and Blockers

- Prompt 03 uses deterministic startup table creation for local MVP development instead of Alembic migrations. This is documented in `services/auth-service/README.md`.
- Refresh-token rotation is deferred. Refresh tokens are still hashed at rest, expire, and can be revoked through logout.
- Google OAuth token exchange is deferred. Hook endpoints are safe and return clear local-demo behavior.
- `.env.example` contains only placeholders; no `.env` was created.
- `docs/ai/prompts/prompt_03_auth_service.md` remains a pre-existing untracked canonical prompt file and was not modified.
- No blockers remain for Prompt 03 acceptance.

## 12. GitHub Project / Issue / Milestone Actions

Prompt 03 explicitly forbids GitHub issue/project/milestone mutations. No GitHub project-management actions were performed.

| Action | Result | Notes |
|---|---|---|
| GitHub project/issue/milestone mutation | skipped | Explicitly forbidden by Prompt 03 |
| GitHub fallback Markdown artifacts | skipped | Explicitly forbidden |

## 13. Final Status

```text
COMPLETED
```

All Prompt 03 acceptance criteria were satisfied: auth persistence exists, demo users seed idempotently, passwords and refresh tokens are hashed, JWT and refresh flows work, provider-admin scope is present, Google OAuth hooks fail safely in placeholder mode, tests pass, Docker Compose validates and starts, documentation/logs are updated, and non-auth domains were not implemented.

## 14. Next Recommended Action

```text
Review the Prompt 03 diff, then proceed to Prompt 04 for provider-registry-service.
```
