# Project Specifications

This directory contains the canonical specifications for the saasPlug project.

## Canonical file

The main specification document is:

```text
docs/specs/SPECIFICATIONS.md
```

This file is the authoritative source for the accepted project decisions.

## Purpose

The specifications define:

- project scope
- actors and MVP flows
- provider API/data acquisition strategy
- microservices boundaries
- data ownership and persistence
- RabbitMQ/event strategy
- analytics design
- billing/pricing/invoice behavior
- authentication and authorization
- frontend UX/pages
- technology stack
- documentation and delivery rules

## Usage by Codex

Codex must read `docs/specs/SPECIFICATIONS.md` before implementing any service, API, frontend flow, Docker setup, documentation, or diagram.

If existing files conflict with `SPECIFICATIONS.md`, Codex must follow `SPECIFICATIONS.md` and report the conflict.

## Update policy

Do not change the accepted specifications casually.

Specification changes require explicit user approval. If a future implementation issue reveals a required architecture change, document it as an explicit proposed amendment before modifying this file.
