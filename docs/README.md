# Documentation

`docs/` contains the course-facing documentation, final diagrams, verification
records, Postman collections, assignment materials, and Codex logs.

## Index

| Path | Purpose |
|---|---|
| `specs/` | Accepted implementation specifications |
| `architecture-summary.md` | Concise implemented architecture summary |
| `diagrams/final/saasplug-final-uml.md` | Self-contained final UML model |
| `diagrams/final/diagram-audit.md` | Code-derived diagram audit and correction notes |
| `diagrams/intermediate/` | Historical draft UML sources |
| `assignment/` | Reference provenance, authorized course-access pointers, and retained student lecture notes |
| `lectures/` | Separately licensed retained publications; see `material-rights.md` |
| `postman/` | Local app Postman/Newman suites, data, and environment template |
| `final-verification.md` | Verification history and latest checks |
| `submission-checklist.md` | Packaging/grading checklist |
| `ai/` | Prompt log, canonical prompts, and Codex run reports |

## Rules

- Keep professor-provided material unchanged.
- Do not place application source or runtime secrets under `docs/`.
- Generated reports belong under ignored output locations such as `reports/`,
  not in documentation folders.
