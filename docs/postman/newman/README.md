# Newman Runner Notes

Run all commands from the repository root. The scripts in `scripts/postman/` call `npx --yes newman` and write JSON reports under `reports/postman/`.

Required local steps:

```bash
docker compose --env-file .env up -d --build
```

Fill `demoPassword` in `docs/postman/saasPlug.local.postman_environment.json` or in an uncommitted local copy before running. Do not commit filled credentials or exported tokenized environments.

For Newman, the runner scripts can read the seeded demo password directly from the selected local app env file. The file is parsed for one supported password key only; it is not sourced and its contents are not printed.

Supported usage:

```bash
scripts/postman/run-smoke.sh --env-file .env
SAASPLUG_ENV_FILE=.env scripts/postman/run-regression.sh
POSTMAN_ENV_FILE=docs/postman/saasPlug.local.postman_environment.json scripts/postman/run-security.sh --env-file .env
```

Env-file precedence is CLI `--env-file`, then `SAASPLUG_ENV_FILE`, then `.env`. `POSTMAN_ENV_FILE` only changes the Postman environment JSON path; it does not replace the app env file used for the demo password.

The regression and security scripts first run the smoke collection and export a temporary environment under `reports/postman/`. That temporary file contains live access/refresh tokens. Treat `reports/postman/` as local generated output and do not commit exported environments or reports containing tokenized runtime data. `reports/` is ignored by git.

High-volume suite formulas:

```text
regression = 1235 target calls
security = 1088 target calls
```

The mutation runner executes only safe local mutation folders. The broad manual mutation folder is skipped by default in collection logic unless `allowManualMutations=true` is set explicitly.

`scripts/postman/run-all-local.sh` supports the same env-file flags, but it is not needed for controlled validation. Use the individual scripts when you need to stop after smoke or inspect one suite at a time.
