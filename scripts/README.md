# Scripts

This folder is reserved for repository utility scripts.

## Purpose

Scripts added here should support reproducible development, validation,
documentation generation, or maintenance tasks.

## Belongs here

- Safe local helper scripts.
- Documentation or diagram generation helpers.
- Validation scripts that do not require real secrets.

## Must not be placed here

- Application business logic.
- Service runtime entrypoints that belong inside a service folder.
- Real secrets or environment files.
- Destructive scripts without explicit documentation and user approval.

No scripts are implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
