You are working in:

ntua-el21026/NTUA-saasPlug

Task type:

FINAL VERIFICATION ONLY - NO IMPLEMENTATION

Goal:

Run one final evidence-based verification pass for the completed saasPlug repository before final NTUA course submission.

This is strictly a verification-only task. Do not implement new features, do not change architecture, do not change backend business logic, do not change frontend business logic, do not add deployment, do not use Vercel, do not create `.env`, and do not print or expose secrets.

Repository/content language rule:

All repository files, documentation, comments, README files, AI logs, Codex prompts, GitHub issue titles/bodies, and project-management artifacts must remain in English.

Canonical files to read first:

- AGENTS.md
- README.md
- .env.example
- .gitignore
- docker-compose.yml
- deploy/nginx/default.conf
- docs/specs/SPECIFICATIONS.md
- docs/specs/README.md
- docs/architecture-summary.md
- docs/final-verification.md
- docs/submission-checklist.md
- docs/README.md
- docs/ai/prompt-log.md
- docs/ai/codex-runs/014-final-docs-uml.md
- docs/ai/codex-runs/015-finalization-project-audit.md
- docs/ai/codex-runs/016-live-env-verification.md
- docs/ai/codex-runs/017-scheduler-design.md
- docs/ai/codex-runs/018-scheduler-control-plane-implementation.md
- docs/ai/codex-runs/019-phase-d-test-expansion.md
- docs/ai/codex-runs/020-comprehensive-test-expansion-and-project-closure.md
- docs/ai/prompts/
- docs/diagrams/final/

Hard constraints:

- Do not implement new features.
- Do not change architecture.
- Do not change backend or frontend business logic.
- Do not add deployment, hosting, or Vercel.
- Do not create `.env`.
- Do not print secrets.
- Do not expose provider API keys, JWT secrets, Google secrets, RabbitMQ passwords, database passwords, access tokens, refresh tokens, or the scheduler internal token.
- Do not commit, print, copy, or upload `.env`.
- Use `docker compose config --quiet` instead of printing interpolated Compose configuration.
- Do not create fallback project-management Markdown artifacts such as `docs/project-management`.
- Do not close, reopen, or modify GitHub issues/projects unless explicitly instructed in a later prompt.
- Clearly report unavailable tools instead of claiming success.
- Keep all repository content in English.

Verification scope:

1. Repository governance and secrets
   - Verify `.gitignore` excludes `.env` and secret-like local files while keeping `.env.example`.
   - Verify `.env.example` is complete enough for the current runtime:
     - app/public base URL;
     - JWT;
     - Google OAuth;
     - RabbitMQ;
     - scheduler control-plane variables;
     - provider base URLs;
     - `PROVIDER_AUTH_SCHEME=Bearer`;
     - provider API key placeholders;
     - all service database URLs including `SCHEDULER_DATABASE_URL`.
   - Verify `.env` is not tracked using `git ls-files --error-unmatch .env`.
   - If a local `.env` exists, do not read it and do not print it. Only report that an ignored local `.env` exists.

2. Static architecture verification
   - Verify the final canonical service set exists:
     - auth-service
     - provider-registry-service
     - red-provider-service
     - green-provider-service
     - blue-provider-service
     - catalog-service
     - status-service
     - reservation-service
     - analytics-service
     - billing-service
     - scheduler-service
   - Verify Docker Compose includes:
     - frontend
     - nginx-gateway
     - rabbitmq
     - all backend services
     - one PostgreSQL container per stateful service:
       - auth-postgres
       - provider-registry-postgres
       - red-provider-postgres
       - green-provider-postgres
       - blue-provider-postgres
       - catalog-postgres
       - status-postgres
       - reservation-postgres
       - analytics-postgres
       - billing-postgres
       - scheduler-postgres
   - Verify no MongoDB runtime component exists.
   - Verify no dedicated orchestrator service exists.
   - Verify provider services are not exposed through Nginx public routes.
   - Verify Nginx exposes `/api/scheduler/*`.
   - Verify Nginx blocks service-owned internal job prefixes with 404:
     - `/api/catalog/internal/`
     - `/api/analytics/internal/`
     - `/api/billing/internal/`
     - `/api/reservations/internal/`

3. Frontend source verification
   - Verify frontend source calls only gateway-relative `/api/...` paths.
   - Verify there are no forbidden frontend calls to:
     - Docker-internal service hostnames;
     - direct service ports;
     - red/green/blue provider services;
     - external provider API URLs;
     - RabbitMQ or AMQP URLs;
     - service-owned `/internal/jobs/*` routes.
   - Verify EV, provider-admin, and operator routes still exist.
   - Verify operator scheduler UI/API usage remains under `/api/scheduler/*`.

4. Provider API/auth verification
   - Verify provider YAML and Postman collection files exist:
     - docs/assignment/providers/yaml/redPlug.yaml
     - docs/assignment/providers/yaml/greenPlug.yaml
     - docs/assignment/providers/yaml/bluePlug.yaml
     - docs/assignment/providers/postman_collections/redPlug.postman_collection.json
     - docs/assignment/providers/postman_collections/greenPlug.postman_collection.json
     - docs/assignment/providers/postman_collections/bluePlug.postman_collection.json
   - Verify provider services send `Authorization: Bearer <apiKey>` by default through `PROVIDER_AUTH_SCHEME=Bearer`.
   - If real provider credentials and required network/VPN access are available, run read-only live provider checks only:
     - list endpoint for redPlug, greenPlug, bluePlug;
     - one detail/status endpoint per provider when a safe ID is available.
   - Do not print API keys or raw response bodies.
   - Skip all live provider checks clearly if credentials or network/VPN are unavailable.
   - Skip live reservation mutations unless `RUN_LIVE_RESERVATION_SMOKE=true` is explicitly set.

5. Tests and builds
   - Run frontend tests:
     - `docker compose run --build --rm --no-deps frontend npm test -- --run`
   - Run frontend production build:
     - `docker compose run --build --rm --no-deps frontend npm run build`
   - Run all backend service tests:
     - `docker compose run --build --rm --no-deps auth-service pytest -q`
     - `docker compose run --build --rm --no-deps provider-registry-service pytest -q`
     - `docker compose run --build --rm --no-deps red-provider-service pytest -q`
     - `docker compose run --build --rm --no-deps green-provider-service pytest -q`
     - `docker compose run --build --rm --no-deps blue-provider-service pytest -q`
     - `docker compose run --build --rm --no-deps catalog-service pytest -q`
     - `docker compose run --build --rm --no-deps status-service pytest -q`
     - `docker compose run --build --rm --no-deps reservation-service pytest -q`
     - `docker compose run --build --rm --no-deps analytics-service pytest -q`
     - `docker compose run --build --rm --no-deps billing-service pytest -q`
     - `docker compose run --build --rm --no-deps scheduler-service pytest -q`
   - Run shared event package tests through a backend image:
     - `docker compose run --build --rm --no-deps analytics-service pytest -q /tmp/packages/events/tests`
   - If the exact shared-events test path differs in the current image, locate the mounted package path safely and report the path used.

6. Docker Compose and runtime health
   - Run:
     - `docker compose config --quiet`
     - `docker compose up -d --build`
     - `docker compose ps`
   - Verify all containers become healthy.
   - If transient PostgreSQL startup connection-refused errors occur for services during initial startup, wait for DB health and perform a targeted service restart. Record this as a warning, not a pass without explanation.

7. Gateway and API smoke checks
   - Verify public health routes:
     - `/health`
     - `/`
     - `/api/auth/health`
     - `/api/providers/health`
     - `/api/catalog/health`
     - `/api/status/health`
     - `/api/reservations/health`
     - `/api/analytics/health`
     - `/api/billing/health`
     - `/api/scheduler/health`
   - Verify authenticated EV smoke using safe demo credentials from `.env.example` or configured environment without printing tokens:
     - login;
     - `/api/auth/auth/me`;
     - a read-only EV route such as `/api/reservations/reservations/me`.
   - Verify authenticated provider-admin smoke:
     - login;
     - `/api/auth/auth/me`;
     - a read-only provider-scoped analytics or billing overview route.
   - Verify authenticated operator smoke:
     - login;
     - `/api/auth/auth/me`;
     - scheduler jobs listing through `/api/scheduler/jobs`.
   - Verify scheduler operator API smoke:
     - `/api/scheduler/health`;
     - `/api/scheduler/jobs`;
     - `/api/scheduler/runs`.
   - Verify service-owned internal job gateway paths return HTTP 404:
     - `/api/catalog/internal/jobs/catalog/freshness`
     - `/api/analytics/internal/jobs/freshness`
     - `/api/billing/internal/jobs/freshness`
     - `/api/reservations/internal/jobs/freshness`
   - Verify scheduler manual run smoke for the safe non-mutating job:
     - `billing.prepare-invoices`
   - The scheduler manual run must execute through the scheduler operator API and target Docker-internal service URLs.
   - Do not issue invoices as part of this verification.

8. Root gateway contract tests
   - After the stack is running, run:
     - `python3 -m unittest discover tests -v`

9. Documentation and diagrams
   - Verify these final docs exist and are coherent:
     - README.md
     - docs/specs/SPECIFICATIONS.md
     - docs/architecture-summary.md
     - docs/final-verification.md
     - docs/submission-checklist.md
     - docs/README.md
     - docs/specs/README.md
     - docs/diagrams/final/README.md
     - docs/ai/prompt-log.md
   - Verify all final `.puml` files listed in `docs/diagrams/final/README.md` exist.
   - If `plantuml` is available, run:
     - `plantuml -checkonly docs/diagrams/final/*.puml`
   - If PlantUML rendering/checking is unavailable, clearly report the missing tool and do not claim PlantUML validation passed.

10. AI logging and final report

- Create or update one final verification run report under:
  - `docs/ai/codex-runs/`
- Use a new run ID/name such as:
  - `021-final-verification-only.md`
- The report must include:
  - invocation prompt summary;
  - canonical files read;
  - exact verification commands run;
  - pass/fail/warning result for each check;
  - unavailable tools;
  - whether `.env` is untracked;
  - whether live provider checks were run or skipped;
  - whether live reservation mutation was skipped or explicitly enabled;
  - final blockers, if any;
  - final readiness conclusion.
- Update `docs/ai/prompt-log.md` only if you create a new verification run entry.
- Update `docs/final-verification.md` and `docs/submission-checklist.md` only if verification results materially change.
- Do not rewrite final docs unnecessarily.

11. Cleanup

- Run:
  - `docker compose down`
  - `docker compose ps -a`
- Do not delete local volumes unless explicitly instructed.
- Do not remove user local `.env`.

Final response format:

Return a concise final report with:

1. Result
2. Commands/checks run
3. Passed checks
4. Warnings / skipped checks
5. Blockers
6. Files changed
7. Final readiness

Remember: verification-only. No implementation, no architecture changes, no deployment, no Vercel, no `.env` creation, no secrets printed.
