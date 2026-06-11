# nginx-gateway

This folder is reserved for the Nginx API gateway/reverse proxy configuration.

## Purpose

`nginx-gateway` will expose frontend assets and route `/api/...` requests to
the responsible backend services.

## Belongs here

- Nginx configuration files.
- Gateway route documentation.
- Gateway-specific validation notes.

## Must not be placed here

- Backend service business logic.
- Provider API adapters.
- Docker Compose service definitions outside the accepted deployment layout.
- Real secrets.

Runtime gateway configuration is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
