# shared-contracts

## Purpose

This package is reserved for shared DTO, API, and validation contracts that are
safe to reuse across services and the frontend. It is currently a placeholder
and does not contain runtime code.

## Belongs here

- Stable request/response contract definitions.
- Shared enum definitions such as canonical roles and normalized statuses.
- Contract tests if shared contracts are added later.

## Must not be placed here

- Service-owned persistence models.
- Business workflows owned by a specific service.
- Provider-specific raw schema assumptions that belong in provider adapters.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
