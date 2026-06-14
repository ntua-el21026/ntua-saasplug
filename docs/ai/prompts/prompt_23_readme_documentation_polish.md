# Prompt 23 - README documentation polish

You are working in:

`ntua-el21026/NTUA-saasPlug`

Task type:

`README DOCUMENTATION POLISH - DOCUMENTATION ONLY`

## Goal

Perform a final repository-wide README documentation pass for the completed saasPlug project. The goal is to make all `README.md` files accurate, current, coherent, final-submission-ready, and useful to the appropriate audience.

This is documentation-only. Do not implement features, do not change architecture, do not change backend business logic, do not change frontend business logic, do not change Docker runtime behavior, do not change Nginx routing behavior, do not add deployment, do not use Vercel, and do not touch `.env`.

## Repository/content language rule

All repository files, documentation, comments, README files, AI logs, Codex prompts, GitHub issue titles/bodies, and project-management artifacts must remain in English.

## Canonical files to read first

- `AGENTS.md`
- `README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/022-live-env-full-verification.md`
- `docs/diagrams/final/README.md`
- `docker-compose.yml`
- `deploy/nginx/default.conf`
- `.env.example`
- `.gitignore`

## Hard constraints

- Documentation-only.
- Do not change application source code.
- Do not change tests except if a documentation-only README inventory/check file already exists and requires path correction.
- Do not change `.env`.
- Do not read `.env`.
- Do not print `.env`.
- Do not create `.env`.
- Do not print or expose secrets.
- Do not add deployment or Vercel.
- Do not create fallback project-management Markdown artifacts such as `docs/project-management`.
- Do not add generated screenshots, rendered PlantUML images, build artifacts, or runtime outputs.
- Do not rewrite canonical specs unless a README link or reference correction requires it. Prefer not to modify `docs/specs/SPECIFICATIONS.md`.
- Keep all README files in English.
- If GitHub CLI/project permissions are unavailable, report that honestly and do not fabricate issue/project updates.

## Primary task

### 1. Locate all existing README.md files

Run a repository-wide inventory for README files, excluding generated/runtime directories if any:

- `.git/`
- `node_modules/`
- Python cache directories
- build output directories
- Docker/runtime output directories

Use a command equivalent to:

```bash
find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './apps/frontend/node_modules' -prune -o \
  -path './**/__pycache__' -prune -o \
  -name 'README.md' -print | sort
```

If shell glob pruning differs, use a safe equivalent.

Record the README inventory in the run report.

### 2. Detect missing README.md files where useful

Check whether README files exist in all major navigational areas. At minimum, verify:

- `root README.md`
- `apps/README.md`
- `apps/frontend/README.md`
- `services/README.md`
- every service directory:
  - `services/auth-service/README.md`
  - `services/provider-registry-service/README.md`
  - `services/red-provider-service/README.md`
  - `services/green-provider-service/README.md`
  - `services/blue-provider-service/README.md`
  - `services/catalog-service/README.md`
  - `services/status-service/README.md`
  - `services/reservation-service/README.md`
  - `services/analytics-service/README.md`
  - `services/billing-service/README.md`
  - `services/scheduler-service/README.md`

- `packages/README.md`
- `packages/events/README.md`
- `packages/shared-contracts/README.md` if the directory exists
- `packages/provider-normalization/README.md` if the directory exists
- `deploy/README.md`
- `deploy/nginx/README.md`
- `docs/README.md`
- `docs/specs/README.md`
- `docs/diagrams/README.md`
- `docs/diagrams/final/README.md`
- `docs/assignment/README.md` if useful
- `docs/ai/README.md`
- `docs/ai/prompts/README.md`
- `docs/ai/codex-runs/README.md`
- `scripts/README.md`
- `tests/README.md`

Create missing README files only when they add clear final-submission navigation value. Do not create README files in every small internal package folder unless useful.

## README content policy

Update README files according to their audience.

### Root README.md policy

Root `README.md` should be user-facing and final-submission-facing. It should include:

- concise project title and one-paragraph description;
- course context;
- actor overview:
  - EV users;
  - provider admins;
  - operator;

- high-level architecture summary;
- local prerequisites;
- local setup using `.env.example`;
- warning not to commit real `.env`;
- Docker Compose startup/shutdown;
- public URLs;
- demo users;
- main app flows;
- provider API note:
  - redPlug;
  - greenPlug;
  - bluePlug;
  - Bearer auth through private `.env`;

- testing/verification commands;
- documentation links;
- final submission artifacts;
- known accepted MVP limitations.

Root `README.md` must not contain:

- prompt-by-prompt implementation history;
- Codex run chronology;
- GitHub project setup details;
- issue numbers as part of main app explanation;
- internal implementation audit prose;
- stale warnings from old phases when superseded by Prompt 22;
- excessive internal details better suited for service README files.

It is acceptable for root README to link to:

- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/ai/prompt-log.md`

But it should not narrate “Prompt 14”, “Phase D continuation”, or similar process details in the user-facing flow.

### Service README policy

Each service README should be maintainer-facing and concise but useful.

For each backend service README, include:

- service purpose;
- owned data/database;
- public/gateway routes if exposed through gateway;
- internal-only routes if relevant;
- upstream/downstream dependencies;
- environment variables relevant to that service, with placeholders only;
- how to run service-local tests;
- important files/directories;
- data ownership constraints;
- notes about security/roles where applicable.

Service README files must not include:

- old prompt implementation history;
- “created in Prompt X” text;
- irrelevant Codex process details;
- secrets or real `.env` values;
- deployment/Vercel instructions;
- architecture changes not currently implemented.

Provider service README files should mention:

- provider code;
- provider API source YAML/Postman collection path;
- Bearer auth through `PROVIDER_AUTH_SCHEME=Bearer`;
- internal-only nature;
- owned provider-local snapshots/raw payloads/sync runs;
- no direct browser access.

Scheduler service README should mention:

- control-plane role only;
- `scheduler-postgres`;
- job definitions/run history;
- operator-only `/api/scheduler/*`;
- service-owned internal HTTP job endpoints;
- `X-Scheduler-Token` and `X-Job-Run-Id`;
- no business data ownership;
- no cross-service database access.

### Frontend README policy

`apps/frontend/README.md` should include:

- purpose of the React + TypeScript + Vite frontend;
- role-based route groups;
- gateway-only API policy;
- local commands through Docker Compose;
- frontend test/build commands;
- important source folders;
- note that browser must not call service ports/provider APIs/RabbitMQ directly;
- no implementation prompt/process history.

### Packages README policy

`packages/events/README.md` should accurately describe:

- event envelope;
- topic exchange;
- routing keys;
- queues/DLQs;
- publisher/consumer helpers;
- idempotency expectations;
- tests.

Other package README files should state whether they are active, placeholder, or reserved for future shared contracts/normalization, matching the current repository state. Do not imply implemented packages if they are placeholders.

### Deploy README policy

`deploy/README.md` and `deploy/nginx/README.md` should describe:

- local Docker Compose deployment shape;
- Nginx gateway purpose;
- public route map;
- internal-only restrictions;
- scheduler public route and blocked service-owned internal job paths;
- no production hosting/deployment/Vercel instructions.

### Docs README policy

`docs/README.md`, `docs/specs/README.md`, `docs/diagrams/README.md`, and `docs/diagrams/final/README.md` should provide navigation and traceability.

They may mention final verification and AI logs as documentation artifacts, but should avoid duplicating long implementation chronology.

`docs/ai/README.md`, `docs/ai/prompts/README.md`, and `docs/ai/codex-runs/README.md` may describe AI-log structure because that is their actual purpose. Keep them clean, indexed, and current.

### Tests README policy

`tests/README.md` should state:

- root tests require a running Docker Compose stack;
- tests hit public gateway URLs only;
- how to set `SAASPLUG_GATEWAY_BASE_URL`;
- how to run the tests.

## Remove stale/process artifacts from README files

Search all README files for stale implementation-process wording such as:

- `Prompt 01`
- `Prompt 14`
- `Phase A`
- `Phase B`
- `Phase C`
- `Phase D`
- `Codex run`
- `GitHub Project #`
- `Issue #`
- `COMPLETED_WITH_WARNINGS`
- `Finalization Project`
- `Vercel`
- obsolete service names:
  - `PointService`
  - `StatsService`
  - `PaymentService`
  - `ProviderAdapterService`
  - `saasCharge`

Do not blindly delete valid references. Apply these rules:

- In root/app/service/deploy/package/test README files, remove or rewrite process artifacts into current-state documentation.
- In `docs/ai/**/README.md`, process-related terms are allowed when they describe AI logging structure.
- In `docs/README.md` and docs navigation files, references to AI logs are allowed but should remain concise.
- `Vercel` should not appear unless explicitly saying deployment/Vercel is out of scope in a policy/context where useful. Prefer no Vercel mention in user-facing README.

## Current-state accuracy requirements

Ensure all README files reflect the final application state after Prompt 22:

- `scheduler-service` exists.
- `scheduler-postgres` exists.
- `/api/scheduler/*` is exposed.
- service-owned `/internal/jobs/*` routes are blocked by the gateway.
- provider services are internal.
- frontend calls only `/api/...`.
- provider APIs use Bearer auth by default.
- live `.env` verification passed with accepted warnings.
- 184 tests are verified.
- live provider read-only checks passed.
- full browser Google OAuth callback remains manual/skipped due interactive/browser tooling constraints.
- live reservation mutation remains skipped unless explicitly enabled.

## Validation after documentation changes

Run these checks:

```bash
git status --short
git diff --check
```

Run a README inventory again and confirm expected README files exist.

Run a grep/static check over README files for stale or forbidden terms. Report allowed exceptions.

Suggested commands:

```bash
find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './apps/frontend/node_modules' -prune -o \
  -name 'README.md' -print | sort
```

```bash
rg -n \
  -e 'Prompt [0-9]+' \
  -e 'Phase [A-D]' \
  -e 'Codex run' \
  -e 'GitHub Project #' \
  -e 'Issue #' \
  -e 'COMPLETED_WITH_WARNINGS' \
  -e 'Finalization Project' \
  -e 'PointService' \
  -e 'StatsService' \
  -e 'PaymentService' \
  -e 'ProviderAdapterService' \
  -e 'saasCharge' \
  --glob 'README.md' \
  --glob '**/README.md'
```

If matches remain, classify them as:

- allowed in `docs/ai/**`;
- allowed documentation reference;
- fixed;
- not applicable.

Because this is a documentation-only pass, do not run the full test suite unless README edits affect documented commands only and you want to verify command examples. At minimum, run `git diff --check`.

## AI log update

Create/update:

```text
docs/ai/codex-runs/023-readme-documentation-polish.md
```

The run report must include:

- invocation prompt summary;
- canonical files read;
- README inventory before/after;
- README files created;
- README files modified;
- README files intentionally left unchanged;
- stale/process-artifact scan results;
- validation commands and results;
- warnings;
- blockers;
- final documentation readiness conclusion.

Update:

```text
docs/ai/prompt-log.md
```

with Run `023` if the run report is created.

Update:

```text
docs/submission-checklist.md
```

only if README documentation readiness materially changes.

Update:

```text
docs/final-verification.md
```

only if needed to mention documentation-only README polish. Do not rewrite verification evidence unnecessarily.

## GitHub issue/project update

If the README documentation polish passes without blockers:

- close issue `#20` as completed;
- move its GitHub Project `#3` item to Done if GitHub CLI/project permissions are available.

If GitHub CLI/project permissions are unavailable:

- report this clearly;
- do not fabricate project update success;
- do not create fallback Markdown project-management artifacts.

## Final response format

Return exactly these sections:

```markdown
## Result

PASS / PASS_WITH_WARNINGS / FAIL

## README inventory

Summarize existing README files found and any README files created.

## Files changed

List all README and documentation/log files changed.

## Current-state documentation updates

Summarize how the root, frontend, services, packages, deploy, docs, AI, and tests README files were improved.

## Removed stale/process artifacts

Summarize stale implementation-process artifacts removed or allowed exceptions.

## Validation

List validation commands and results.

## Warnings

List only real warnings.

## Blockers

Say No blockers only if supported by results.

## GitHub issue/project updates

State whether issue #20 was closed and moved to Done in Project #3.

## Final readiness

State whether README documentation is ready for final NTUA course submission.
```

Remember:

- Documentation-only.
- README files must describe the current application state, not the implementation process.
- Keep repository content in English.
- Do not touch `.env`.
- Do not expose secrets.
- Do not deploy.
- Do not use Vercel.
