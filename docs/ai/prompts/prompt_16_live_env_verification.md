# Prompt 16 - Live environment and provider contract verification

You are working in:

`ntua-el21026/NTUA-saasPlug`

Task type:

`PHASE B - LIVE ENVIRONMENT AND REAL FUNCTIONALITY VERIFICATION`

## Scope

Perform Phase B only:

1. Inspect the local `openapi.json` file at the repository root.
2. Compare the live provider OpenAPI contract against the repository provider adapters.
3. Verify that the local ignored `.env` is present and structurally valid without printing secrets.
4. Verify real Google OAuth configuration as far as possible without interactive browser login.
5. Verify real provider API credentials and live provider connectivity.
6. Verify the app still works through Docker Compose and the Nginx gateway using the local `.env`.
7. Document all results in the AI log system.

Do not start Phase C or Phase D.

## Hard constraints

- Do not print, commit, copy, or expose `.env` values.
- Do not print API keys, JWT secrets, Google client secrets, passwords, access tokens, or refresh tokens.
- Do not create or modify `.env`.
- Do not commit `.env`.
- Do not change backend business logic.
- Do not change frontend business logic.
- Do not change architecture.
- Do not add scheduler/worker support in this prompt.
- Do not add migration infrastructure in this prompt.
- Do not add broad new tests in this prompt.
- Do not use Vercel or deployment workflows.
- Do not create fallback project-management Markdown artifacts.
- Keep all repository content in English.

## Required canonical reads

Read:

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/015-finalization-project-audit.md`
- `.env.example`
- `docker-compose.yml`
- `openapi.json`

Also inspect provider adapter/config files under:

- `services/red-provider-service/`
- `services/green-provider-service/`
- `services/blue-provider-service/`
- any shared provider adapter code if present

## Provider contract checks

From `openapi.json`, verify and document whether the implementation matches:

### Authentication header

Provider APIs use plain header:

```text
authorization: <api-key>
```

Do not assume Bearer.

### redPlug

```text
GET /redPlug/api/points
GET /redPlug/api/point/{pointid}
POST /redPlug/api/reserve/{pointid}
POST /redPlug/api/reserve/{pointid}/{minutes}
```

### greenPlug

```text
GET /greenPlug/api/chargingPoints
GET /greenPlug/api/chargingPoints/{pointid}
POST /greenPlug/api/chargingPoints/{pointid}/reservations
```

Reservation body:

```json
{ "duration": minutes }
```

### bluePlug

```text
GET /bluePlug/api/locations
GET /bluePlug/api/location/{pointid}/status
POST /bluePlug/api/location/{pointid}/hold
```

Reservation duration is query parameter:

```text
minutes
```

If implementation differs from the contract, report it as a blocker. Do not fix it in this prompt unless the issue is documentation-only.

## Environment validation

Verify the local `.env` exists and contains non-placeholder values for:

- `JWT_SECRET`
- `DEMO_USER_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `RED_PROVIDER_API_KEY`
- `GREEN_PROVIDER_API_KEY`
- `BLUE_PROVIDER_API_KEY`

Also verify that:

- provider API keys are not `replace-me`;
- provider API keys are not empty;
- `GOOGLE_REDIRECT_URI` matches the expected local callback:

```text
http://localhost:8080/api/auth/auth/google/callback
```

- `PUBLIC_BASE_URL` is coherent with local gateway usage:

```text
http://localhost:8080
```

- RabbitMQ URL user/password are coherent with `RABBITMQ_DEFAULT_USER` and `RABBITMQ_DEFAULT_PASS`;
- if `POSTGRES_PASSWORD` differs from `saasplug`, all `*_DATABASE_URL` entries use the same password.

Do not print any values. Report only redacted status, for example:

```text
JWT_SECRET: set, length OK
GOOGLE_CLIENT_SECRET: set, redacted
RED_PROVIDER_API_KEY: set, redacted
```

## Live provider API checks

If network/VPN access is available, run safe read-only checks directly against the live provider APIs using the local `.env` credentials:

- redPlug list points;
- greenPlug list charging points;
- bluePlug list locations.

Report:

- HTTP status;
- whether the response is valid JSON;
- number of returned records;
- first item shape/keys only, without printing sensitive data.

Then run one safe detail/status check per provider using a point id obtained from the list result:

- redPlug point detail;
- greenPlug point detail;
- bluePlug status/detail endpoint.

Do not perform live reservation mutations by default.

Only run live reservation calls if an explicit environment flag exists and is set:

```text
RUN_LIVE_RESERVATION_SMOKE=true
```

If the flag is absent or false, document reservation smoke as skipped by safety policy.

## Docker/app verification

Run:

```bash
git status --short
git diff --check
docker compose config
docker compose up -d --build
docker compose ps
```

Verify gateway and public health routes:

```bash
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/
curl -fsS http://localhost:8080/api/auth/health
curl -fsS http://localhost:8080/api/providers/health
curl -fsS http://localhost:8080/api/catalog/health
curl -fsS http://localhost:8080/api/status/health
curl -fsS http://localhost:8080/api/reservations/health
curl -fsS http://localhost:8080/api/analytics/health
curl -fsS http://localhost:8080/api/billing/health
```

Run authenticated smoke checks through the gateway:

- EV user login using `evuser@saasplug.local` and `DEMO_USER_PASSWORD`.
- Provider admin login using `red-admin@saasplug.local` and `DEMO_USER_PASSWORD`.
- Operator login using `operator@saasplug.local` and `DEMO_USER_PASSWORD`.

Do not print tokens.

Verify at least:

- `/api/auth/auth/me`
- one EV-accessible read flow;
- one provider-admin-accessible read flow;
- one operator-accessible read flow.

## Google OAuth verification

Without interactive browser login, verify:

- `/api/auth/auth/google/login` reports configured OAuth credentials;
- authorization URL is generated;
- callback URL matches `GOOGLE_REDIRECT_URI`.

Do not print `GOOGLE_CLIENT_SECRET`.

If full browser OAuth cannot be completed, report it as not fully verified without interactive browser flow, not as failure.

## Cleanup

After Docker verification:

```bash
docker compose down -v
docker compose ps -a
```

## GitHub issue/project handling

Find the Phase B issue by title:

```text
Phase B - Configure real environment variables and verify live functionality
```

It is likely issue `#16`, but do not rely on the number blindly.

If GitHub Project operations are available:

- move Phase B to `In Progress` at the start;
- move Phase B to `Done` only if all required Phase B checks pass or pass with accepted warnings;
- close the issue only if the result is `PASS` or `PASS_WITH_WARNINGS`.

If GitHub Project operations are unavailable, report that clearly.

Do not close Phase C or Phase D issues.

## Allowed file changes

Create:

```text
docs/ai/prompts/prompt_16_live_env_verification.md
docs/ai/codex-runs/016-live-env-verification.md
```

Update:

```text
docs/ai/prompt-log.md
docs/final-verification.md only if verification results materially change
docs/submission-checklist.md only if submission readiness materially changes
```

Do not modify source code.

Do not commit `.env`.

Do not move or commit `openapi.json` unless it is already tracked. If `openapi.json` is untracked, use it as local verification input and report that it remains untracked.

## Final response format

Return exactly:

```markdown
## Status

PASS / PASS_WITH_WARNINGS / FAIL

## Contract comparison

Provider contract comparison result.

## Environment verification

Redacted env validation result.

## Live provider verification

Read-only provider API check results.

## App verification

Docker/gateway/authenticated smoke results.

## Google OAuth verification

OAuth configuration result.

## GitHub issue/project updates

Issue/project changes or unavailable operations.

## Files changed

Exact file list.

## Warnings

Only real warnings.

## Blockers

No blockers, or precise blocker list.

## Next phase

State whether Phase C should start next, and which Phase C issue should be handled first.
```
