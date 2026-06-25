# Postman Runner Scripts

This folder contains shell wrappers around the local Postman/Newman suites in
`docs/postman/`.

## Scripts

| Script | Suite |
|---|---|
| `run-smoke.sh` | `saasPlug.local.smoke.postman_collection.json` |
| `run-regression.sh` | `saasPlug.local.regression.postman_collection.json` |
| `run-security.sh` | `saasPlug.local.security.postman_collection.json` |
| `run-mutation.sh` | `saasPlug.local.mutation.postman_collection.json` |
| `run-all-local.sh` | Runs smoke, regression, security, and mutation wrappers |
| `lib/env.sh` | Shared env-file parsing and Newman argument helpers |

## Environment Input

The scripts accept the local app env file in this order:

1. `--env-file <path>`
2. `SAASPLUG_ENV_FILE=<path>`
3. `.env`

They read only the seeded demo password value needed by Newman and pass it as
an in-memory environment variable. They do not print `.env` contents.

`POSTMAN_ENV_FILE` can override the Postman environment JSON file.

## Usage

Start the app first, then run from the repository root:

```bash
scripts/postman/run-smoke.sh --env-file .env
scripts/postman/run-regression.sh --env-file .env
scripts/postman/run-security.sh --env-file .env
scripts/postman/run-mutation.sh --env-file .env
```

Reports are written under `reports/postman/`, which is ignored by git.
