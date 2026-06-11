# shared-contracts

## Purpose

This package will hold shared DTO, API, and validation contracts that are safe
to reuse across services and the frontend.

## Belongs here

- Stable request/response contract definitions.
- Shared enum definitions such as canonical roles and normalized statuses.
- Contract tests added by later implementation prompts.

## Must not be placed here

- Service-owned persistence models.
- Business workflows owned by a specific service.
- Provider-specific raw schema assumptions that belong in provider adapters.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
