# Codex Run 065 - Markdown Lint Configuration

## Invocation Prompt

```text
Configure markdown lint for the whole project and correct them, if needed.
```

## Goal

Add a reproducible Markdown lint configuration for the repository and wire it
into existing lint scripts.

## Scope

- Project-level Markdown lint configuration.
- Markdown lint runner under `scripts/lint/`.
- Existing lint aggregate script.
- README references to the new command.
- No application logic changes.

## Implementation Summary

- Added `.markdownlint-cli2.jsonc` using `markdownlint-cli2`.
- Added `scripts/lint/run-markdown.sh`.
- Updated `scripts/lint/run-all.sh` to run Markdown lint.
- Updated `scripts/README.md` and `README.md` to document the command.
- Historical prompt/run-log bodies and generated/cache folders are excluded.
  README/index docs and maintained project Markdown are linted.

## Lint Scope

Included:

- root Markdown files,
- app/service/package/deploy/script/docs README files,
- final UML Markdown,
- current specification and verification docs,
- AI README/index files.

Excluded:

- `node_modules`, build/dist, reports, tmp, Git and pytest cache folders,
- historical Codex run bodies,
- historical prompt bodies.

The exclusions keep transcript-like archival files from forcing artificial
formatting changes while still enforcing lint on maintained project docs.

## Commands Run

```text
npx --yes markdownlint-cli2 "**/*.md" ...
```

Initial result: failed with thousands of expected historical/archive style
issues, mainly line length, table formatting, and prompt transcript syntax.

```text
scripts/lint/run-markdown.sh
```

Final result: passed. Linted 50 maintained Markdown files with 0 errors.

```text
scripts/lint/run-all.sh
```

Result: passed. Ruff passed, Markdown lint passed, and frontend ESLint exited 0
with the existing two React Hook warnings in `AdminPages.tsx`.

```text
git diff --check
```

Result: passed.

## Files Changed

- `.markdownlint-cli2.jsonc`
- `scripts/lint/run-markdown.sh`
- `scripts/lint/run-all.sh`
- `scripts/README.md`
- `README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/065-markdown-lint-configuration.md`

## Limitations

- `markdownlint-cli2` is run with `npx --yes`; it is not pinned in a root
  `package.json` because this repository does not have a root Node package.
- Historical prompt and Codex run bodies are excluded from enforcement because
  they preserve pasted prompts/transcripts and contain intentional raw Markdown.

## Status

COMPLETED
