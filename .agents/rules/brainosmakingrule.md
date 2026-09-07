---
trigger: always_on
---

# BrainOS Development Rules

## Project continuity
- Treat the current repository as the source of truth.
- Continue from the current Git checkpoint; never restart or reimplement completed milestones.
- Before changing code, inspect the relevant existing implementation and tests.
- Make the smallest correct change required for the current mission.
- Do not perform broad refactors, unrelated cleanup, or architectural changes without explicit approval.

## Architecture
- Preserve BrainOS's existing layered architecture and provider-independent AI abstraction.
- Reuse existing services, repositories, interfaces, validators, and dependency-injection patterns before creating new ones.
- Keep controllers/transport thin and business logic in services.
- Keep external providers behind existing provider interfaces.
- Do not introduce new infrastructure, database schema, migrations, or dependencies unless the current mission requires them.

## Security
- Security is mandatory for every change.
- Enforce authentication, authorization, ownership/tenant isolation, least privilege, and fail-closed behavior.
- Never trust user/client/prompt-supplied identity or authorization fields.
- Never expose secrets, credentials, embeddings, stack traces, or sensitive internal data.
- Treat LLM output and tool arguments as untrusted input.
- Preserve existing audit logging and security boundaries.

## Development workflow
- Inspect first.
- Implement one mission at a time.
- Add focused tests for every behavioral change.
- Run focused tests, relevant regression tests, TypeScript validation, and git diff checks.
- Review security and architecture before completion.
- Do not claim work is complete until it is verified.

## Git
- Do NOT commit or push unless the current prompt explicitly authorizes it.
- Never commit unrelated changes.
- Before committing, verify the diff contains only the intended mission changes.
- After an authorized push, verify HEAD == origin/main and the working tree is clean.

## Context
- BrainOS_Master_Project_Context.md is the project history and roadmap.
- Preserve historical context; append new milestone information rather than rewriting previous sections.
- When a meaningful mission is completed, update the context additively.