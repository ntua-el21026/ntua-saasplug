# Prompt 006

Source PDF: `NTUA--~4.PDF`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit - 2 and Docker Commands`

Source pages:

- Prompt: page 28
- Response: pages 28-29

## Prompt

Give me all the useful commands I need in a cell to copy. Dont overdo it.

## Response

```bash
# ============================================================
# saasPlug - Day-to-day Docker commands
# Run these from WSL, inside the repository root.
# ============================================================

# Go to project root
cd /home/peppasmich/NTUA-saasPlug

# Check that Docker Compose config is valid without printing .env secrets
docker compose --env-file .env config --quiet

# Start the app normally
docker compose --env-file .env up -d

# Start the app with rebuild after code/dependency/Dockerfile changes
docker compose --env-file .env up -d --build

# Check container status / health
docker compose --env-file .env ps

# Open in browser:
# Main app:                http://localhost:8080/
# Gateway health:          http://localhost:8080/health
# Scheduler health:        http://localhost:8080/api/scheduler/health
# RabbitMQ management:     http://localhost:15672/

# View recent logs for important services
docker compose --env-file .env logs --tail=100 nginx-gateway
docker compose --env-file .env logs --tail=100 frontend
docker compose --env-file .env logs --tail=100 scheduler-service
docker compose --env-file .env logs --tail=100 catalog-service

# Follow live logs for one service
docker compose --env-file .env logs -f scheduler-service

# Restart one service if it is stuck
docker compose --env-file .env restart scheduler-service

# Rebuild only one service
docker compose --env-file .env up -d --build frontend
docker compose --env-file .env up -d --build catalog-service

# Run frontend tests/build
docker compose --env-file .env run --build --rm --no-deps frontend npm test -- --run
docker compose --env-file .env run --build --rm --no-deps frontend npm run build

# Run one backend service test suite
docker compose --env-file .env run --build --rm --no-deps scheduler-service pytest -q

# Run root gateway contract tests after the stack is already running
python3 -m unittest discover tests -v

# Stop the app safely without deleting databases/volumes
docker compose --env-file .env down

# ============================================================
# Avoid in normal day-to-day use
# ============================================================

# Avoid: prints interpolated config and may expose .env-derived values
# docker compose config

# Avoid: prints secrets
# cat .env

# Avoid: never commit real secrets
# git add .env

# Avoid unless you intentionally want a full data reset:
# This deletes PostgreSQL/RabbitMQ volumes and local app data.
# docker compose --env-file .env down -v

# Avoid unless you intentionally want aggressive Docker cleanup:
# docker system prune -a --volumes
```
