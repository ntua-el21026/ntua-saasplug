# Root Integration Tests

This directory contains repository-level tests that exercise cross-service or
gateway behavior. Keep service-owned business logic tests inside each
`services/*/tests/` directory.

The current root tests expect the Docker Compose stack to be running and use
only public gateway URLs. They do not read `.env` values.

Run from the repository root after `docker compose up -d --build`:

```bash
python3 -m unittest discover tests -v
```

Set `SAASPLUG_GATEWAY_BASE_URL` only when the gateway is not available at the
default `http://localhost:8080`.
