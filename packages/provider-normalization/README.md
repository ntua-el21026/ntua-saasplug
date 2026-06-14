# provider-normalization

## Purpose

This package is reserved for reusable helpers that could normalize
provider-specific API payloads into internal saasPlug DTOs. It is currently a
placeholder; the implemented normalization logic lives inside the provider
services.

## Belongs here

- Shared normalization types and helper functions.
- Test fixtures derived from provider YAML contracts if shared helpers are
  added later.
- Provider-neutral normalization utilities.

## Must not be placed here

- External provider HTTP clients owned by provider services.
- Catalog persistence.
- Reservation truth.
- Provider credentials or secrets.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/assignment/providers/yaml/redPlug.yaml`
- `docs/assignment/providers/yaml/greenPlug.yaml`
- `docs/assignment/providers/yaml/bluePlug.yaml`
