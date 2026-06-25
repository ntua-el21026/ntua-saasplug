# Diagrams

This directory contains UML and architecture diagrams for the saasPlug project.

## Structure

```text
docs/diagrams/
  README.md
  intermediate/
    README.md
    ...
  final/
    README.md
    ...
```

## Directory roles

| Directory | Purpose |
|---|---|
| `intermediate/` | Draft, historical, or phase-1 diagrams |
| `final/` | Final diagrams used for submission |

## Final diagrams

The authoritative final diagrams must be placed under:

```text
docs/diagrams/final/
```

The grader-facing Markdown entrypoint is:

```text
docs/diagrams/final/saasplug-final-uml.md
```

Draft or outdated diagrams must not be treated as final deliverables.

## Diagram format

Use PlantUML where possible.

The final diagrams must use the exact service/container names accepted in `docs/specs/SPECIFICATIONS.md`.

## Required final diagram categories

The final deliverable should include:

- use case diagram
- activity diagrams
- component diagram
- deployment diagram
- sequence diagrams
- data/persistence model diagram
- class/interface/data-structure diagrams where useful

## Consistency rule

The final diagrams must match:

- implemented service names
- Docker Compose container names
- database container names
- public gateway routes
- RabbitMQ/event flows
- repository paths
