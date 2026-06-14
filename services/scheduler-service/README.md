# scheduler-service

Control-plane service for recurring and manual background jobs.

## Purpose

`scheduler-service` stores job definitions and run history in `scheduler-postgres`, evaluates due jobs, and calls service-owned internal HTTP job endpoints with `X-Scheduler-Token`. It does not contain catalog, analytics, billing, or reservation business logic and does not access other service databases.

## Important files

- `app/main.py`: FastAPI application, startup database initialization, and scheduler loop startup.
- `app/models.py`: Scheduler metadata tables.
- `app/jobs.py`: Accepted job seed definitions and scheduling calculations.
- `app/executor.py`: Job run lifecycle and internal HTTP invocation.
- `app/routes.py`: Operator-only scheduler APIs and public health endpoint.
- `tests/test_scheduler_service_api.py`: Focused scheduler API and execution tests.

## Runtime

The service is intended to run through Docker Compose:

```bash
docker compose up scheduler-postgres scheduler-service
```

Configuration comes from environment variables documented in `.env.example`. The internal scheduler token must match the token configured on target services.
