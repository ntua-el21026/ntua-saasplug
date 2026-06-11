# Deploy

This folder contains deployment and gateway configuration for saasPlug.

## Purpose

This folder contains deployment and gateway configuration for the local
development baseline.

## Belongs here

- Docker Compose files and deployment notes.
- Nginx gateway configuration.
- Deployment README notes and safe templates.

## Must not be placed here

- Application business logic.
- Service source code.
- Frontend source code.
- Real secrets or local `.env` files.

## Docker baseline

Prompt 02 adds the root `docker-compose.yml` and the Nginx gateway
configuration under `deploy/nginx/default.conf`.

Run the baseline from the repository root:

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
```

Health checks:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/catalog/health
curl http://localhost:8080/api/reservations/health
```

Stop and remove local volumes:

```bash
docker compose down -v
```

The baseline does not implement schemas, migrations, business workflows, or
real secrets.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
