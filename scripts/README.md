# Scripts

This folder contains repository utility scripts for validation and local
Postman/Newman runs.

## Contents

| Path | Purpose |
|---|---|
| `lint/run-all.sh` | Runs repository lint/check helpers |
| `lint/run-python.sh` | Runs Python-oriented checks |
| `lint/run-markdown.sh` | Runs Markdown lint across project Markdown files |
| `postman/run-smoke.sh` | Newman smoke suite wrapper |
| `postman/run-regression.sh` | Newman regression suite wrapper |
| `postman/run-security.sh` | Newman security suite wrapper |
| `postman/run-mutation.sh` | Newman local mutation suite wrapper |
| `postman/run-all-local.sh` | Runs the local Postman suites in sequence |
| `postman/lib/env.sh` | Reads safe runner inputs from a local env file without printing secrets |

## Rules

- Do not commit generated reports from `reports/`.
- Do not print `.env` contents.
- Keep destructive actions opt-in and documented.

See `scripts/postman/README.md` for Postman runner details.
