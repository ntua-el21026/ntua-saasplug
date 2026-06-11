# Prompt 01 - Repository Foundation

## Role

You are Codex working on the NTUA ECE saasPlug repository. Your task is to establish the repository foundation only. Do not implement business logic, APIs, database models, Docker services, frontend screens, provider adapters, RabbitMQ consumers, or tests beyond the documentation/scaffolding checks explicitly requested here.

## Mandatory context to read before editing

Read these files first:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/prompts/README.md`
4. `docs/ai/codex-runs/_template.md`
5. `docs/ai/prompt-log.md`

If any of these files are missing, report that clearly. If the missing file is one of the files this prompt asks you to create, create it and mention that it was created.

## Objective

Create a clean, deterministic repository foundation that matches the accepted saasPlug specifications.

The output of this prompt must prepare the repository for later implementation prompts by ensuring:

- canonical folder structure exists,
- required README files exist,
- final documentation paths exist,
- AI documentation paths exist,
- `.env.example` exists with safe placeholders,
- `.gitignore` protects generated files and secrets,
- professor-provided and existing project artifacts are preserved,
- no architecture drift is introduced.

## Non-negotiable constraints

1. Keep all repository content in English.
2. Do not modify professor-provided raw files unless strictly moving/copying them into an agreed documentation location without changing their contents.
3. Do not delete existing diagrams, SRS files, provider YAML files, or assignment materials.
4. Do not implement application logic in this prompt.
5. Do not create FastAPI route handlers, React pages, SQL models, migrations, or Docker Compose service implementations in this prompt.
6. Do not introduce new services or folders outside the accepted specification unless they are documentation/support folders explicitly requested below.
7. Do not create Markdown fallback files for GitHub Projects or issue management. GitHub project setup is not part of this prompt.
8. Do not run destructive commands.
9. Do not commit real secrets.
10. Do not create a real `.env` file.

## Required repository structure

Ensure the following structure exists. Use `.gitkeep` only where needed to preserve empty folders.

```text
apps/
  README.md
  frontend/
    README.md

services/
  README.md
  auth-service/
    README.md
  provider-registry-service/
    README.md
  red-provider-service/
    README.md
  green-provider-service/
    README.md
  blue-provider-service/
    README.md
  catalog-service/
    README.md
  status-service/
    README.md
  reservation-service/
    README.md
  analytics-service/
    README.md
  billing-service/
    README.md

packages/
  README.md
  shared-contracts/
    README.md
  provider-normalization/
    README.md
  event-contracts/
    README.md

deploy/
  README.md
  nginx/
    README.md

docs/
  README.md
  specs/
    README.md
    SPECIFICATIONS.md
  diagrams/
    README.md
    final/
      README.md
  ai/
    README.md
    prompt-log.md
    prompts/
      README.md
      prompt_01_repo_foundation.md
    codex-runs/
      README.md
      _template.md

scripts/
  README.md
```

Do not create `docs/project-management/` in this prompt.

## Required README content

Create concise but useful README files. Every README must explain:

1. the purpose of the folder or service,
2. what belongs there,
3. what must not be placed there,
4. relevant links to `AGENTS.md` and/or `docs/specs/SPECIFICATIONS.md`, where appropriate.

For service READMEs, include:

- service responsibility,
- owned database container name,
- whether it is public through the gateway or internal-only,
- key future implementation notes,
- explicit note that application logic is not yet implemented if the service is only scaffolded.

Use the canonical service/database mapping:

| Service | Database container |
|---|---|
| `auth-service` | `auth-postgres` |
| `provider-registry-service` | `provider-registry-postgres` |
| `red-provider-service` | `red-provider-postgres` |
| `green-provider-service` | `green-provider-postgres` |
| `blue-provider-service` | `blue-provider-postgres` |
| `catalog-service` | `catalog-postgres` |
| `status-service` | `status-postgres` |
| `reservation-service` | `reservation-postgres` |
| `analytics-service` | `analytics-postgres` |
| `billing-service` | `billing-postgres` |

## Root README

If a root `README.md` exists, update it carefully without removing useful existing content. If it does not exist, create it.

The root README must include:

1. project overview,
2. architecture summary,
3. canonical service list,
4. canonical database-container list,
5. quick-start placeholder stating that full Docker runtime will be implemented in a later prompt,
6. links to:
   - `AGENTS.md`,
   - `docs/specs/SPECIFICATIONS.md`,
   - `docs/diagrams/final/`,
   - `docs/ai/prompt-log.md`,
7. warning that the app is not fully implemented after Prompt 01.

## `.env.example`

Create or update `.env.example` with safe placeholders only.

Include at least these categories:

```text
# Application
APP_ENV=development
PUBLIC_BASE_URL=http://localhost:8080

# JWT / Auth
JWT_SECRET=change-me-in-local-env
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Google OAuth
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback

# RabbitMQ
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# Provider base URLs
RED_PROVIDER_BASE_URL=https://davinci.softlab.ntua.gr/saas26/redPlug/api
GREEN_PROVIDER_BASE_URL=https://davinci.softlab.ntua.gr/saas26/greenPlug/api
BLUE_PROVIDER_BASE_URL=https://davinci.softlab.ntua.gr/saas26/bluePlug/api

# Provider credentials / team keys, if required by provider specs
RED_PROVIDER_API_KEY=replace-me
GREEN_PROVIDER_API_KEY=replace-me
BLUE_PROVIDER_API_KEY=replace-me

# Database placeholders
AUTH_DATABASE_URL=postgresql://saasplug:saasplug@auth-postgres:5432/auth
PROVIDER_REGISTRY_DATABASE_URL=postgresql://saasplug:saasplug@provider-registry-postgres:5432/provider_registry
RED_PROVIDER_DATABASE_URL=postgresql://saasplug:saasplug@red-provider-postgres:5432/red_provider
GREEN_PROVIDER_DATABASE_URL=postgresql://saasplug:saasplug@green-provider-postgres:5432/green_provider
BLUE_PROVIDER_DATABASE_URL=postgresql://saasplug:saasplug@blue-provider-postgres:5432/blue_provider
CATALOG_DATABASE_URL=postgresql://saasplug:saasplug@catalog-postgres:5432/catalog
STATUS_DATABASE_URL=postgresql://saasplug:saasplug@status-postgres:5432/status
RESERVATION_DATABASE_URL=postgresql://saasplug:saasplug@reservation-postgres:5432/reservation
ANALYTICS_DATABASE_URL=postgresql://saasplug:saasplug@analytics-postgres:5432/analytics
BILLING_DATABASE_URL=postgresql://saasplug:saasplug@billing-postgres:5432/billing
```

Do not create `.env`.

## `.gitignore`

Create or update `.gitignore` to include at least:

```text
.env
.env.*
!.env.example
__pycache__/
*.py[cod]
.pytest_cache/
.ruff_cache/
.mypy_cache/
.venv/
venv/
node_modules/
dist/
build/
coverage/
.DS_Store
*.log
```

Preserve any existing useful ignore patterns.

## Assignment/provider artifacts

Inspect the repository for provider YAML files and professor-provided assignment materials.

Expected provider YAML names:

```text
redPlug.yaml
greenPlug.yaml
bluePlug.yaml
```

If they already exist in a stable location, do not move them.

If they are at the repository root and there is no established assignment-materials structure, create:

```text
docs/assignment/providers/yaml/
```

and move or copy the YAML files there without modifying content. Report exactly what you did.

If moving files could break existing references, copy instead of move and report the duplication for manual review.

## AI documentation files

Ensure these files exist and are coherent:

```text
docs/ai/prompts/README.md
docs/ai/prompts/prompt_01_repo_foundation.md
docs/ai/codex-runs/_template.md
docs/ai/prompt-log.md
```

Do not overwrite the prompt text destructively. If you need to adjust paths or fix formatting, report the change.

## Codex run log

Create a run log:

```text
docs/ai/codex-runs/001-repo-foundation.md
```

Use `docs/ai/codex-runs/_template.md` as the format.

The run log must include:

1. the exact invocation prompt pasted by the user;
2. the canonical task prompt file path: `docs/ai/prompts/prompt_01_repo_foundation.md`;
3. the full content of this canonical prompt file where practical;
4. visible model/settings/sandbox/approval/network information;
5. repository state before changes;
6. canonical sources read;
7. files/folders created;
8. files modified;
9. commands run;
10. checks/tests run;
11. results;
12. warnings/blockers;
13. acceptance criteria status;
14. final status and next recommended action.

## Prompt log update

Update:

```text
docs/ai/prompt-log.md
```

Add or update the Prompt 01 row with:

- run ID: `001`,
- prompt file: `docs/ai/prompts/prompt_01_repo_foundation.md`,
- run log: `docs/ai/codex-runs/001-repo-foundation.md`,
- status: `completed` only if all acceptance criteria passed; otherwise `partial` or `failed`,
- concise summary.

## Checks to run

Run only safe checks.

At minimum:

```bash
git status --short
find . -maxdepth 3 -type d | sort
find . -name README.md | sort
```

If the repository already contains package/test tooling, you may run harmless checks such as formatting or tests only if they are clearly configured and do not require external secrets.

If no application code exists yet, do not report test failure merely because no tests exist. State that application tests are not applicable for this foundation prompt.

## Acceptance criteria

This prompt is complete only if:

- root `AGENTS.md` exists,
- `docs/specs/SPECIFICATIONS.md` exists,
- required top-level folders exist,
- required README files exist,
- `docs/diagrams/final/README.md` exists,
- `docs/ai/prompts/README.md` exists,
- `docs/ai/prompts/prompt_01_repo_foundation.md` exists,
- `docs/ai/codex-runs/_template.md` exists,
- `docs/ai/codex-runs/001-repo-foundation.md` exists,
- `docs/ai/prompt-log.md` exists and references Prompt 01,
- `.env.example` exists with safe placeholders,
- `.gitignore` protects `.env` and common generated files,
- no application logic was implemented,
- no real secrets were committed,
- no fallback Markdown GitHub Project artifacts were created.

## Final response required from Codex

After completing the task, respond with:

1. summary of what changed,
2. files created,
3. files modified,
4. checks run and results,
5. whether all acceptance criteria passed,
6. any required manual follow-up.
