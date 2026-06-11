# provider-normalization

## Purpose

This package will hold reusable helpers for normalizing provider-specific API
payloads into internal saasPlug DTOs.

## Belongs here

- Shared normalization types and helper functions.
- Test fixtures derived from provider YAML contracts when implementation starts.
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
