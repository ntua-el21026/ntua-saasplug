# Local portfolio preparation – 2026-11-12

## Invocation and authorization

The parent task supplied these exact scoped user instructions:

> Make the necessary local corrections, including targeted code changes where justified. Do not undertake unrelated refactoring or redesign working systems.

> At this stage, I authorize local preparation and validation only.

The follow-up was: “Continue and finish your work”. No canonical prompt file was
used for this preparation. The wider personal admissions prompt is intentionally
not duplicated here. This subtask covered five isolated local application copies;
this report records only saasPlug work. No remote action, commit, publication,
history rewrite, provider operation, database deployment, or AI transcript dump
was authorized or performed by this worker.

## Context and scope

- Branch: `portfolio/local-preparation-20261112`.
- Starting HEAD: `128f5be9ab6ad58f67c0e817ad81fbfaff975f6a`; no commit created.
- Sources read: `AGENTS.md`, accepted SPEC-8/10/11 and relevant portions of
  `docs/specs/SPECIFICATIONS.md`, root and auth/test/script README files,
  environment template structure, Compose, service config/auth tests and
  frontend dependency/test configuration. Raw assignment/lecture files were
  preserved.
- The model/settings beyond the visible Codex/GPT-6 agent context are not
  independently recorded. Tools used unrestricted local filesystem access with
  network available; tests explicitly avoided provider/production systems.

## Changes

- Replaced private-looking signing/password values in `.env.example.correct`
  with a copy of the safe canonical template and a legacy-alias note. Values
  are not repeated. Historical `present.txt` and prior configuration remain
  owner rotation/revocation follow-ups, not resolved by this edit.
- Bound the Compose public gateway to loopback. Preserved internal service
  isolation and mock-compatible placeholder mode.
- Disabled automatic scheduler execution in Compose defaults and the template;
  disabled startup catalog import in the template. Provider-connected work
  needs deliberate configuration and authorization.
- Added three offline template/exposure checks. Made the three root live-stack
  gateway tests explicitly opt-in; they do not initiate connections by default.
- Clarified setup, data loading, authorship/AI assistance, course-material rights,
  test evidence, and runtime limitations in root/test documentation.
- Updated this run report and `docs/ai/prompt-log.md`.

## Validation

Commands ran in the isolated copy; full secret-free logs are held in the parent
workspace's `validation/apps/` directory.

| Command | Observed outcome |
|---|---|
| `python3 -m unittest discover -s tests -p test_local_configuration.py -v` before changes | Exit 1; 3 expected failures (legacy private configuration, gateway bind, automatic activity) |
| `python3 -m unittest discover -s tests -v` after changes | Exit 0; 3 offline checks passed, 3 live gateway tests explicitly skipped |
| `npm ci --ignore-scripts` in `apps/frontend` with workspace-local npm cache | Exit 0; dependencies installed from lockfile; dependency warnings retained in logs |
| `npm test -- --run` in `apps/frontend` | Exit 0; 55 tests across 6 files passed |
| `npm run build` in `apps/frontend` | Exit 0; TypeScript/Vite build passed |
| `docker compose --env-file .env.example config --quiet` | Exit 0; Compose schema/interpolation only |
| `docker info --format '{{.ServerVersion}}'` | Exit 1; Docker Desktop Linux-engine pipe unavailable; no containers started |
| exact pinned auth requirements with Python 3.14.4 and binary-only install | Exit 1; `psycopg-binary==3.2.3` has no cp314 wheel; dependency pins unchanged |
| same requirements in a separate Python 3.12.14 virtual environment | Exit 0; pinned requirements installed |
| auth-service `pytest -q` under Python 3.12.14, with socket connections disabled | Exit 0; 25 passed, 1 Starlette/AnyIO deprecation warning; SQLite/test doubles only |

Node was 24 and npm 11. Python environments and caches were created only under
the approved preparation workspace; existing environments/system packages were
preserved. No PyTorch/CUDA/numerical stacks were installed or executed.

## Limitations and review

The full Compose stack, PostgreSQL, RabbitMQ, provider integrations, browser
interaction, load/performance, and hosted deployment were not executed. Offline
checks and auth/frontend unit tests do not certify deployment security. Existing
historical verification and weak/failed/unavailable evidence remain in place.
The local credential removal does not remove Git history or establish rotation.
The root MIT license and AI record describe repository-authored work; raw course
materials and provider artifacts require separate redistribution/privacy review.
Review the local diff before proposing focused commits; this run leaves all
changes uncommitted.
