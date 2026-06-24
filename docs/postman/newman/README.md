# Newman Runner Notes

Run all commands from the repository root. The scripts in `scripts/postman/` call `npx --yes newman` and write JSON reports under `reports/postman/`.

Required local steps:

```bash
docker compose --env-file .env up -d --build
```

Fill `demoPassword` in `docs/postman/saasPlug.local.postman_environment.json` or in an uncommitted local copy before running. Do not commit filled credentials or exported tokenized environments.

The regression and security scripts first run the smoke collection and export a temporary environment under `reports/postman/`. That temporary file contains live access/refresh tokens. Treat `reports/postman/` as local generated output and do not commit exported environments or reports containing tokenized runtime data.

High-volume suite formulas:

```text
regression = 1235 target calls
security = 1088 target calls
```

The mutation runner executes only safe local mutation folders. The broad manual mutation folder is skipped by default in collection logic unless `allowManualMutations=true` is set explicitly.
