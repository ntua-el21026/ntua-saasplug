# Prompt 17 - Scheduler control-plane design

You are working in:

`ntua-el21026/NTUA-saasPlug`

Task type:

`PHASE C - SCHEDULER CONTROL-PLANE DESIGN ONLY`

## Scope

Design Phase C scheduler/control-plane implementation only.

The selected architecture is hybrid:

- central `scheduler-service` as control-plane;
- `scheduler-postgres` for job definitions and run history;
- internal HTTP job endpoints on responsible services;
- service-owned execution and data ownership;
- no business logic inside `scheduler-service`;
- no RabbitMQ for live user actions;
- no central database access to other service databases.

Do not implement in this prompt.

## Required output

Produce a design covering:

1. proposed service/container changes;
2. exact jobs and intervals;
3. internal endpoints to add per service;
4. scheduler data model;
5. operator UI/API impact;
6. risks and mitigations;
7. affected files;
8. validation plan.

## Allowed file changes

Update only AI logs:

- `docs/ai/prompts/prompt_17_scheduler_design.md`
- `docs/ai/codex-runs/017-scheduler-design.md`
- `docs/ai/prompt-log.md`

Do not modify application source code.

