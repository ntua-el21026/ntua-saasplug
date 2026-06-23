# Codex Run 040 - Nginx Runtime DNS Gateway Paths

## Invocation Prompt

Direct user request received on 2026-06-23:

```text
I was logged in before the latest changes as an ev user and now that I built the containers again and launched the app I got this screen. Resolve the issue and make sure all paths are correct.
```

The referenced local image could not be read by the environment, so the task was completed from the textual issue description and repository/runtime context.

## Canonical Task Prompt

N/A. This was a direct one-off bugfix prompt.

## Goal

Fix the post-rebuild gateway routing issue that can break logged-in sessions and authenticated frontend paths after backend containers are recreated.

## Root Cause

`nginx-gateway` used static `upstream` blocks. Nginx resolves those Docker service names at startup and keeps the resolved container IPs. After `docker compose up --build` recreates backend containers while `nginx-gateway` remains running, the cached IP for a path such as `/api/auth/*` can become stale or point at a different service container. That makes otherwise correct frontend paths fail even though service names and route declarations are correct.

## Implementation Summary

- Replaced static Nginx upstream blocks with request-time Docker DNS resolution through `resolver 127.0.0.11 valid=10s ipv6=off`.
- Converted gateway service targets to variables such as `$auth_service_upstream`.
- Added explicit prefix rewrites before `proxy_pass` so existing gateway paths keep the same strip-prefix behavior:
  - `/api/auth/auth/me` -> `auth-service:8000/auth/me`
  - `/api/catalog/...` -> `catalog-service:8000/...`
  - same pattern for provider registry, status, reservations, analytics, billing, scheduler, and frontend.
- Documented the runtime DNS behavior in the Nginx gateway README.

## Files Changed

- `deploy/nginx/default.conf`
- `deploy/nginx/README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/040-nginx-runtime-dns-gateway-paths.md`

The worktree already contained additional modified and untracked files from prior runs; they were left intact.

## Tests and Checks

- `docker.exe compose config --quiet`
  - Result: passed.
- Static directive check for required Nginx runtime DNS and rewrite/proxy directives
  - Result: passed.
- `npm run test -- --run --reporter=dot` from `apps/frontend/`
  - Result: passed, `27 passed`.
- `npm run build` from `apps/frontend/`
  - Result: passed. Vite reported the existing MapLibre chunk-size warning.

## Limitations

- Container-level validation could not be run in this session because Docker Desktop's Linux engine was not reachable from WSL.
- Browser runtime validation could not initialize because the Browser Node REPL rejected the WSL workspace path metadata.
- The intended container validation after Docker is available is:

```bash
docker compose exec -T nginx-gateway nginx -t
docker compose restart nginx-gateway
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/catalog/health
docker compose up -d --force-recreate --no-deps auth-service
curl http://localhost:8080/api/auth/health
```

After the fix, the last command should still return `auth-service` without restarting `nginx-gateway`.

## Manual Review Notes

- The frontend continues to call only gateway-relative `/api/...` paths.
- The route strip behavior remains consistent with the documented gateway paths.
- The change conforms to SPEC-8, SPEC-9, and the accepted Dockerized gateway architecture.
