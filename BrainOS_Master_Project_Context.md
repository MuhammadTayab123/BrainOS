# BrainOS — MASTER PROJECT CONTEXT
## Single Source of Truth for Future Development Chats

**Project:** BrainOS  
**Purpose:** Personal AI Operating System / Second Brain / Personal Assistant  
**Current phase:** Phase 18 — Conversation + Persistent Context  
**Phase 17 status:** COMPLETE  
**Phase 18 status:** IN PROGRESS — Conversation persistence foundation complete  
**Repository:** `D:\Project\BrainOS`  
**Branch:** `main`  
**OS:** Windows  
**Editor:** VS Code  
**Last verified local commit:** `c7780e0 feat: add conversation persistence`
---

# 0. CRITICAL RULE FOR EVERY FUTURE CHAT

Before changing BrainOS:

1. Read this context.
2. Inspect the actual repository.
3. Check `git status` and recent commits.
4. Inspect the relevant files.
5. Explain the architectural reason for a significant change.
6. Make the smallest correct change.
7. Run validation/tests.
8. Verify actual behavior.
9. Update the handoff/context.
10. Commit completed work.
11. Push completed phases.
12. Verify the final Git state.

Never restart completed phases, blindly overwrite working code, bypass authentication, put business logic in controllers, put Prisma access in controllers, trust client-supplied ownership IDs, expose secrets/tokens/session IDs in logs, or claim planned work is verified.

If context and repository disagree, inspect the repository and resolve the difference first.

---

# 1. BRAINOS MISSION

BrainOS is a private personal AI operating system, not merely a chatbot.

Long-term it should:

- understand context
- remember useful information
- retrieve relevant information
- reason over context
- help make decisions
- organize work/study/life
- manage tasks and reminders
- understand documents
- plan
- use AI models
- use tools/integrations
- automate repetitive work
- communicate naturally
- eventually support voice/mobile/PWA
- proactively surface appropriate information
- act with user control

North-star idea:

> BrainOS should become a private second brain and personal operating system that reduces cognitive load.

---

# 2. PRODUCT VISION

```text
User
 ↓
BrainOS Assistant
 ↓
Understand request
 ↓
Retrieve memory / knowledge
 ↓
Choose AI model
 ↓
Use tools when required
 ↓
Reason
 ↓
Respond / act
 ↓
Optionally store useful information
 ↓
Maintain long-term context
```

Long-term capabilities:

1. Conversational AI
2. Long-term memory
3. Semantic retrieval
4. Structured personal data
5. Tasks/reminders
6. Planning
7. Documents/knowledge
8. Automation
9. Tools
10. Calendar/email/messaging integrations
11. Voice
12. Agent workflows
13. Decision support
14. Proactive assistance

BrainOS should feel like:

> “My assistant knows my context and helps me manage my life/work/study.”

Not:

> “A chatbot with a database attached.”

---

# 3. VERSION 1 SCOPE

The first BrainOS version is focused on one primary user.

Do not prematurely build:

- SaaS billing
- public marketplace
- enterprise RBAC
- organization complexity
- public social features
- unnecessary multi-tenancy

Make BrainOS extremely useful for one user first.

---

# 4. ENGINEERING PRINCIPLES

Prefer:

- clear architecture
- explicit contracts
- type safety
- validation
- testing
- observability
- maintainability
- incremental changes
- provider independence

Avoid:

- quick hacks
- duplicated business logic
- giant controllers
- direct DB access from transport layers
- unvalidated external input
- unnecessary abstractions
- secrets in Git

Provider architecture:

```text
AI Service
 ↓
AI Provider Interface
 ├── Ollama
 ├── OpenAI
 ├── Azure OpenAI
 ├── Claude
 └── Gemini
```

Database architecture:

**PostgreSQL + Prisma + pgvector**

**Supabase is explicitly NOT part of the current BrainOS architecture.**

Ollama is the primary local AI provider during development because cost, privacy, and the lack of a dedicated GPU matter.

---

# 5. COST / DEVELOPMENT CONSTRAINTS

Target development cost:

**approximately $0–$5/month where practical.**

Student Developer Pack resources should be preferred where appropriate.

Previously considered resources include GitHub, Copilot, DigitalOcean credits, Azure credits, Clerk, JetBrains, Appwrite, Codespaces, etc.

Do not add paid AI APIs merely for testing unless explicitly requested.

---

# 6. DEVELOPMENT ENVIRONMENT

Repository:

`D:\Project\BrainOS`

Local frontend:

`http://localhost:3000`

Local backend:

`http://localhost:3001`

Environment:

- Windows
- VS Code
- Git/GitHub
- Node.js
- Docker
- PostgreSQL
- Prisma
- Ollama
- no dedicated GPU

---

# 7. CURRENT TECHNOLOGY STACK

Frontend:
- Next.js
- React
- TypeScript
- Clerk

Backend:
- Express
- TypeScript
- Prisma
- PostgreSQL

Authentication:
- Clerk

Webhooks:
- Clerk Webhooks
- Svix
- ngrok

AI:
- Ollama

Embeddings:
- Ollama
- pgvector

Validation:
- Zod

Errors:
- AppError
- UnauthorizedError
- ForbiddenError
- NotFoundError
- ValidationError
- global error middleware
- 404 middleware

Logging:
- centralized logger abstraction

---

# 8. AUTHENTICATION ARCHITECTURE

Clerk owns authentication.

Frontend does not synchronize users directly into PostgreSQL.

```text
Clerk
 ↓
Bearer session token
 ↓
Express
 ↓
Clerk middleware
 ↓
Authenticated Clerk user
 ↓
BrainOS PostgreSQL User
```

Clerk identity:

`User.clerkId`

BrainOS database identity:

`User.id`

Never trust client-provided user IDs for authorization.

---

# 9. USER / WEBHOOK ARCHITECTURE

User persistence/business logic belongs in:

`apps/backend/src/services/user/user.service.ts`

Webhook flow:

```text
POST /webhooks/clerk
 ↓
Controller
 ↓
Svix verification
 ↓
Clerk event
 ↓
dispatchClerkEvent()
 ↓
handlers/clerk
 ↓
User service
 ↓
Prisma
 ↓
PostgreSQL
```

Conceptual dispatcher:

```text
user.created → user-created.handler.ts
user.updated → user-updated.handler.ts
user.deleted → user-deleted.handler.ts
```

Actual repository state is authoritative.

Webhook delivery may repeat, so user creation must remain idempotent.

---

# 10. PRISMA RULES

Database schema changes must use migrations:

```powershell
npx prisma migrate dev --name <migration_name>
```

Validation:

```powershell
npx prisma validate
```

Remember:

```text
prisma migrate dev = Schema → Database
prisma db pull     = Database → Schema
```

Do not casually use `db pull` after editing `schema.prisma`.

Prisma belongs in services/repositories, not controllers.

---

# 11. EXPRESS ARCHITECTURE

Important ordering:

1. webhook raw-body route
2. JSON parser
3. Clerk middleware
4. request logger
5. root route
6. health routes
7. user routes
8. memory routes
9. development routes
10. 404 middleware
11. error middleware

Webhook raw-body handling must remain compatible with Svix verification.

API areas include:

```text
/webhooks
/api/v1/users
/api/v1/memories
/api/v1/dev
```

The actual `apps/backend/src/app.ts` is authoritative.

---

# 12. ERROR ARCHITECTURE

Application errors are centralized.

Expected response shape:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Middleware/controllers should forward errors to the centralized error handler instead of returning competing responses.

---

# 13. PHASE HISTORY

## Phase 0 — Clean Development Machine
Development machine/prerequisites established.

## Phase 1 — Initial Foundation
Git/GitHub, VS Code, environment, database tooling, BrainOS vision, cost constraints, local-first direction, documentation workflow.

## Phase 2 — Tooling Foundation
Node.js and core tooling configured.

## Phase 3 — Core Project Foundation
Major domains established:
- API
- Authentication
- Memory
- AI
- Tasks
- Integrations

## Phase 4 — PostgreSQL / Prisma / Local Infrastructure
Local PostgreSQL, Docker-era infrastructure, Prisma, connectivity, and monorepo foundation established.

Historical runtime details must be verified before reuse.

## Phase 8 — Clerk Authentication
ClerkProvider, authentication routes, middleware, sign-in/sign-up, dashboard flow.

## Phase 9 — Clerk Webhooks & User Synchronization
Completed architectural milestone:
- Svix verification
- ngrok development flow
- User schema
- Prisma migration
- PostgreSQL synchronization
- user-created flow
- dispatcher
- handlers
- user service
- thin controllers
- real Clerk → PostgreSQL verification

## Phase 10 — Backend Core Infrastructure
Completed:
- environment configuration
- Zod validation
- centralized logger
- AppError
- global error middleware
- 404 middleware
- async error handling

## Phase 11 — AI Provider Layer
Provider-boundary architecture established so BrainOS can use Ollama and future providers without rewriting higher layers.

## Phase 12 — Memory Foundation
Memory domain, Memory Service, Embeddings Service, provider boundary, and repository separation established.

## Phase 13 — Semantic Memory Foundation
PostgreSQL + pgvector semantic retrieval foundation established with limits, thresholds, user ownership, and soft-delete filtering.

## Phase 14 — Authenticated Semantic Memory
COMPLETE. End-to-end authenticated memory creation, embedding persistence, semantic retrieval, ownership isolation, and soft-delete behavior were verified.

---

# 14. PHASE 14 VERIFIED RESULTS

Frontend obtains Clerk token:

```typescript
const { getToken } = await auth();
const token = await getToken();
```

Sends:

```text
Authorization: Bearer <token>
```

Backend authentication verification showed:
- Authorization header present
- Bearer scheme
- Clerk user ID
- Clerk session ID
- database user found

Memory creation:

`POST /api/v1/memories` → `HTTP 201`

Persistence sequence:

```text
INSERT Memory
 ↓
UPDATE Memory embedding = vector
 ↓
COMMIT
```

Semantic search:

`POST /api/v1/memories/search` → `HTTP 200`

Similarity:

```sql
1 - ("embedding" <=> $1::vector)
```

Search filters:
- authenticated userId
- deletedAt IS NULL
- embedding IS NOT NULL
- similarity threshold
- limit

Verified test query:

`BrainOS Phase 14 authenticated memory test`

Verified similarity:

`0.9123692930368563`

42 duplicate Phase 14 test memories were soft-deleted.

---

# 15. MEMORY ARCHITECTURE

Current creation flow:

```text
Authenticated Request
 ↓
requireAuth
 ↓
AuthenticatedUser
 ↓
Memory Controller
 ↓
Memory Service
 ↓
Embeddings Service
 ↓
EmbeddingProvider
 ↓
OllamaProvider
 ↓
Embedding Vector
 ↓
Memory Repository
 ↓
PostgreSQL + pgvector
```

Search:

```text
Authenticated Request
 ↓
requireAuth
 ↓
Memory Controller
 ↓
Memory Service
 ↓
Embeddings Service
 ↓
EmbeddingProvider
 ↓
Query Vector
 ↓
Memory Repository
 ↓
pgvector similarity
 ↓
User-scoped memories
```

Current embedding model:

`nomic-embed-text`

Current Ollama host:

`http://localhost:11434`

Actual configuration is authoritative.

---

# 16. MEMORY DATA MODEL

Conceptually:

```prisma
model Memory {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  content        String
  embedding      Unsupported("vector")?
  importance     Float    @default(0.5)

  lastAccessedAt DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  @@index([userId])
}
```

Actual schema is authoritative.

Use relational columns for structured facts and vectors for semantic retrieval. Do not vectorize everything.

---

# 17. PHASE 15 — MEMORY PRODUCTION HARDENING & CLEANUP

**CURRENT PHASE: IN PROGRESS**

Goal:

> Turn the proven Phase 14 memory pipeline into a clean, secure, maintainable foundation for future BrainOS capabilities.

Do not immediately add a giant new feature.

Phase 15 is about security, ownership, boundaries, testing, cleanup, and production readiness.

---

# 18. PHASE 15 CHECKPOINT ALREADY COMPLETED

Git commit:

`6ab95e4 feat(memory): harden authenticated memory ownership`

Five files changed:

```text
apps/backend/src/app.ts
apps/backend/src/middleware/auth.middleware.ts
apps/backend/src/services/auth/auth.service.ts
apps/backend/src/services/memory/memory.service.ts
apps/backend/src/services/memory/repositories/memory.repository.ts
```

Diff summary:

**5 files changed, 14 insertions(+), 33 deletions(-)**

## Change A — Clerk debug logging disabled

Removed intentional:

```typescript
debug: true
```

from Clerk middleware configuration.

## Change B — Auth middleware error handling fixed

The old flow could call `next(error)` and then also send a 401 response.

Current architectural direction:

```typescript
try {
  req.user = await getAuthenticatedUser(req);
  next();
} catch (error) {
  next(error);
}
```

The centralized error middleware owns the final response.

## Change C — Authentication errors use AppError

`getAuthenticatedUser()` now throws:

```typescript
new UnauthorizedError()
```

instead of generic `Error` instances for missing/unknown authenticated users.

## Change D — Sensitive auth debug logs removed

Removed temporary logs exposing:
- authorization details
- Clerk user ID
- Clerk session ID
- database lookup debug information

These should not be present in production logs.

## Change E — Embedding ownership is explicit

Memory Service now calls:

```typescript
await memoryRepository.updateEmbedding(
  data.userId,
  memory.id,
  embeddingResult.vector
);
```

## Change F — Repository embedding update is user-scoped

`updateEmbedding()` now accepts:

```typescript
memoryId: string
userId: string
embedding: number[]
```

and updates only when:

```sql
WHERE "id" = $memoryId
  AND "userId" = $userId
  AND "deletedAt" IS NULL
```

Security rule established:

> Every memory mutation must be scoped to the authenticated owner, not merely the memory ID.

---

# 19. PHASE 15 VALIDATION ALREADY PASSED

Command:

```powershell
npm --prefix apps/backend run typecheck
```

Result:

```text
> backend@1.0.0 typecheck
> tsc --noEmit
```

Completed successfully with no TypeScript errors.

**Backend TypeScript: PASS**

This is not sufficient to declare Phase 15 complete.

---

# 20. CURRENT GIT STATE

Last verified state:

```text
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
nothing to commit, working tree clean
```

Latest local checkpoint:

```text
6ab95e4 feat(memory): harden authenticated memory ownership
```

Previous relevant commits include:

```text
b1074ec context for each phase
63e0492 feat(memory): complete authenticated semantic memory pipeline
```

Important:

**The Phase 15 checkpoint is committed locally but has NOT yet been claimed as pushed.**

Immediate Git action when appropriate:

```powershell
git push origin main
```

Then verify:

```powershell
git status
git log --oneline -5
```

---

# 21. PHASE 15 REMAINING WORK

## A. Push current checkpoint
- verify status
- push
- verify remote state

## B. Memory API contract review

Review:

```text
POST /api/v1/memories
POST /api/v1/memories/search
```

Check:
- validation
- authentication
- ownership
- consistent response shape
- centralized errors
- service boundaries
- repository boundaries

Potential future API:

```text
GET    /memories
GET    /memories/:id
PATCH  /memories/:id
DELETE /memories/:id
```

Do not implement them unless the phase requires them.

## C. Security tests

Test:

1. no Authorization header
2. invalid token
3. valid authenticated user
4. authenticated Clerk user missing from DB
5. user A creates memory
6. user A searches own memory
7. user A cannot retrieve user B memory
8. user B cannot retrieve user A memory
9. deleted memory is not searchable
10. embedding update cannot target another user's memory

## D. Soft-delete verification

Verify:

```text
Create → visible
Soft delete → invisible
Database row → remains
```

## E. Embedding boundary review

Ensure:

```text
Memory Service
 ↓
Embeddings Service
 ↓
EmbeddingProvider
 ↓
OllamaProvider
```

No Ollama-specific dependency in Memory Service.

## F. Database/pgvector review

Review:
- schema
- vector dimension
- similarity operator
- indexes
- ownership filtering
- soft-delete filtering

Do not optimize prematurely.

## G. Automated tests

Add repeatable tests for:
- authentication
- create
- embedding persistence
- search
- isolation
- soft delete
- error behavior

## H. Frontend cleanup

Review:

`apps/web/app/dashboard/memory-test/page.tsx`

It is a diagnostic page, not the final memory UI.

## I. Next.js middleware/proxy warning

Investigate the deprecation warning.

Do not blindly migrate.

First inspect current Clerk middleware behavior and official requirements, then make the smallest safe change if migration is actually needed.

---

# 22. PHASE 15 ACCEPTANCE CRITERIA

Architecture:
- repository/context reviewed
- memory boundary reviewed
- auth boundary reviewed
- embedding boundary reviewed
- ownership enforced in memory mutations

Security:
- unauthenticated requests rejected
- invalid authentication rejected
- unknown DB user rejected
- cross-user memory isolation verified
- sensitive auth logs removed
- embedding updates are user-scoped
- no secrets/tokens/session IDs logged

Memory:
- create works
- embedding persists
- search works
- similarity works
- ownership is enforced
- soft delete works
- deleted memory excluded

Frontend:
- Clerk works
- memory test page works
- middleware/proxy issue investigated
- no new runtime/hydration errors

Quality:
- backend typecheck passes
- frontend build passes
- automated tests pass where implemented
- Git diff reviewed
- no unnecessary abstraction

Documentation:
- Phase 15 handoff updated
- decisions recorded
- commands recorded
- tests recorded
- technical debt recorded
- next phase recorded

Git:
- clean working tree
- checkpoint committed
- checkpoint pushed
- final log verified

---

# 23. MEMORY SECURITY RULES

Non-negotiable:

### Authentication
Never trust:
```text
req.body.userId
req.query.userId
client-provided ownership
```

### Memory ownership
Every mutation must verify authenticated ownership.

### Search
Every search must be scoped to authenticated user.

### Deletion
Deleted memories must not appear in normal search.

### Logging
Never log:
- access tokens
- secrets
- full Authorization headers
- unnecessary session IDs
- private memory content

### Errors
Do not leak internal provider/database details.

---

# 24. FUTURE MEMORY ROLE

Memory will eventually include:

- user preferences
- personal facts
- projects
- goals
- tasks
- experiences
- decisions
- relationships
- documents
- knowledge
- conversation summaries
- temporary context

Long-term pipeline:

```text
User interaction
 ↓
Context analyzer
 ↓
Decide whether information is memory-worthy
 ↓
Normalize / structure
 ↓
Store
 ↓
Embed when appropriate
 ↓
Persist metadata
 ↓
Retrieve using semantic + structured filters
```

Memory decisions should consider:

- usefulness
- permanence
- confidence
- sensitivity
- duplication
- expiration
- user control

BrainOS should not blindly remember everything.

---

# 25. FUTURE AI ORCHESTRATION

Long-term:

```text
BrainOS Assistant
 ↓
AI Orchestrator
 ↓
Context Assembly
 ↓
Memory Retrieval
 ↓
Tool Selection
 ↓
AI Provider
 ↓
Response / Action
```

AI providers remain behind interfaces.

---

# 26. NORTH-STAR ARCHITECTURE

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │  BrainOS Client │
                  │ Web / Mobile /  │
                  │ Voice / PWA     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ AI Orchestrator │
                  └────────┬────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
       Memory            Tools            Tasks
          │                │                │
          ▼                ▼                ▼
    PostgreSQL +       Integrations      Scheduler
      pgvector
          │
          ▼
    Context / Knowledge
          │
          ▼
      AI Providers
```

BrainOS should ultimately combine:

**Identity + Memory + Knowledge + AI + Tools + Tasks + Automation + Decision Support**

into one coherent personal system.

---

# 27. CURRENT IMPORTANT FILES

Backend:

```text
apps/backend/src/app.ts
apps/backend/src/config/env.ts
apps/backend/src/middleware/auth.middleware.ts
apps/backend/src/middleware/logger.middleware.ts
apps/backend/src/middleware/not-found.middleware.ts
apps/backend/src/middleware/error.middleware.ts
apps/backend/src/services/auth/auth.service.ts
apps/backend/src/services/user/user.service.ts
apps/backend/src/controllers/memory/memory.controller.ts
apps/backend/src/services/memory/memory.service.ts
apps/backend/src/services/memory/embeddings.service.ts
apps/backend/src/services/memory/providers/
apps/backend/src/services/memory/repositories/
apps/backend/src/routes/memory.routes.ts
apps/backend/src/lib/prisma.ts
```

Frontend:

```text
apps/web/.env.local
apps/web/lib/brainos-api.ts
apps/web/app/dashboard/memory-test/page.tsx
apps/web/app/layout.tsx
```

Always inspect actual source before editing.

---

# 28. KNOWN TECHNICAL DEBT

## Next.js middleware/proxy warning
Investigate in Phase 15. Do not blindly migrate.

## Temporary memory test page
Diagnostic only; not final UI.

## Automated tests
Phase 14 was primarily manually verified. Phase 15 should make important behavior repeatable.

## Historical handler notes
Older context may describe user.updated/user.deleted as skeletons. Verify actual repository state before assuming anything is incomplete.

---

# 29. VERIFIED VS PLANNED

## Verified
- Clerk authentication reaches backend
- Bearer token flow works
- Clerk user maps to PostgreSQL User
- memory creation works
- embedding generation works
- pgvector persistence works
- semantic search works
- similarity works
- user-scoped search works
- soft delete filtering works
- 42 duplicate Phase 14 test records were soft-deleted
- centralized error architecture exists
- Phase 15 ownership hardening checkpoint exists
- backend TypeScript typecheck passes
- local working tree was clean after the checkpoint
- local `main` is one commit ahead of `origin/main`

## Not yet fully verified for Phase 15
- full unauthenticated/invalid-token matrix
- cross-user isolation regression tests
- embedding ownership mutation regression test
- automated memory regression suite
- frontend production build after hardening
- middleware/proxy decision
- final Phase 15 documentation
- push of `6ab95e4`
- final Phase 15 Git verification

Do not mark planned work as complete without evidence.

---

# 30. DEVELOPMENT COMMANDS

Backend:

```powershell
cd D:\Project\BrainOSppsackend
npm run dev
```

Frontend:

```powershell
cd D:\Project\BrainOSpps\web
npm run dev
```

Backend typecheck:

```powershell
npm --prefix apps/backend run typecheck
```

Frontend build:

```powershell
cd D:\Project\BrainOSpps\web
npm run build
```

Prisma:

```powershell
cd D:\Project\BrainOSppsackend
npx prisma validate
npx prisma studio
npx prisma migrate dev --name <migration_name>
```

Git:

```powershell
cd D:\Project\BrainOS
git status
git branch --show-current
git log --oneline -10
git diff
```

Push:

```powershell
git push origin main
```

ngrok:

```powershell
ngrok http 3001
```

---

# 31. TESTING PHILOSOPHY

A feature is not complete because code exists or TypeScript compiles.

Definition of Done:

```text
Requirements
 ↓
Architecture
 ↓
Implementation
 ↓
Validation
 ↓
Behavioral Testing
 ↓
Security Verification
 ↓
Documentation
 ↓
Git Checkpoint
 ↓
Review
```

Actual behavior must be verified.

---

# 32. SENIOR DEVELOPER WORKING STYLE

For every task:

```text
Understand
 ↓
Inspect repository
 ↓
Review architecture
 ↓
Explain significant change
 ↓
Implement incrementally
 ↓
Run tests
 ↓
Fix actual errors
 ↓
Verify
 ↓
Document
 ↓
Commit
 ↓
Push
```

When the user shows an error:

1. Read the actual error.
2. Identify the likely root cause.
3. Inspect relevant files.
4. Make the smallest correct fix.
5. Retest.
6. Verify.

Do not provide random destructive fix lists.

---

# 33. EXPECTED ROADMAP

```text
Phase 14
Authenticated Semantic Memory
        ↓
Phase 15
Memory Production Hardening & Cleanup
        ↓
Phase 16
Automated Memory Regression Testing and Test Database Safety — COMPLETE
        ↓
Phase 17
AI Assistant Integration / Orchestration
        ↓
Phase 18
Conversation + Persistent Context
        ↓
Phase 19
Tasks / Reminders / Automation
        ↓
Phase 20+
Documents / Knowledge / Agents / Integrations / Voice / Proactive Assistant
```

Re-evaluate after every phase.

---

# 34. SUCCESS CRITERIA

Eventually BrainOS should be able to:

### Remember
“Remember my project architecture.”

### Retrieve
“What did I decide about the database?”

### Understand
“Read this document and tell me what matters.”

### Plan
“Plan my week around my classes and projects.”

### Decide
“Compare these options based on my priorities.”

### Act

“Create the task and remind me tomorrow.”

### Integrate
“Check my calendar and tell me if I have time.”

### Proactively assist
“You have a deadline tomorrow and this related document has not been reviewed.”

### Learn responsibly
“That preference is likely important for future recommendations.”

User control and privacy remain central.

---

# 35. CURRENT STATE

BrainOS now has a functioning foundation for:

- authentication
- user identity synchronization
- PostgreSQL persistence
- Prisma data access
- centralized errors
- centralized logging
- memory persistence
- local embeddings
- pgvector semantic retrieval
- authenticated memory isolation
- soft-delete filtering
- provider boundaries
- authenticated memory ownership hardening

Phase 14 proved that BrainOS can store and semantically retrieve authenticated memory.

Phase 16 completed repeatable regression and dedicated-test-database safety verification for that foundation.

Current immediate state:

**Backend typecheck: PASS**

**Phase 16 final result: 4 test files passed; 65 tests passed; 0 failed**

**Working tree: contains existing modified/untracked files; inspect before committing**

**Branch: `main`**

**Remote state: local main is one commit ahead of origin/main; no Phase 16 commit or push**

---

# 36. MASTER RULE FOR NEW CHATS

When this file is supplied to a new BrainOS chat, the user may say:

> “This is the BrainOS master context. Read it completely. Work as my senior developer. Before making any changes, inspect the actual repository and follow this context.”

The assistant must:

1. read the context
2. identify current phase
3. inspect actual repository
4. inspect Git state
5. inspect relevant files
6. continue from current milestone
7. never restart completed work
8. never assume historical state is still current
9. keep implementation, tests, documentation, and Git synchronized
10. distinguish verified facts from plans

---

# 37. FINAL PROJECT STATEMENT

BrainOS is being built to become a private personal AI operating system that:

- remembers
- understands
- retrieves
- reasons
- recommends
- organizes
- plans
- integrates
- automates
- eventually acts appropriately with user control

The technical foundation is deliberately being built before the high-level assistant.

Current verified stack:

**Clerk + Express + PostgreSQL + Prisma + Ollama + pgvector + Next.js**

Current milestone:

**Phase 16 — Automated Memory Regression Testing and Test Database Safety (COMPLETE)**

Current checkpoint:

**65/65 tests passing; PostgreSQL and pgvector integration verified**

Ultimate mission:

> Build a personal AI assistant that understands the user's context, stores and retrieves useful information, helps make better decisions, organizes life/work/study, and provides appropriate proactive assistance while remaining private, modular, affordable, maintainable, and under the user's control.

# 38. PHASE 16 FINAL AUTHORITATIVE UPDATE

This section is the current source of truth for Phase 16 and supersedes older current-phase, planned-testing, clean-worktree, and Phase 15-in-progress statements above. Historical material is retained for context.

## Current phase and status

**Phase 16 — Automated Memory Regression Testing and Test Database Safety: COMPLETE**

Phase 16 established a repeatable backend memory regression suite without changing production code, the Prisma schema, test assertions, or the test architecture during finalization.

## Completed phase status and testing strategy

Phase 15 supplied the ownership/authentication-hardening foundation. Phase 16 completed the corresponding repeatable regression coverage, deliberately separating mocked boundary tests from real database integration:

- `safety.test.ts`: 9 tests for the database safety guard.
- `memory.service.update.test.ts`: 7 mocked MemoryService tests.
- `memory.api.test.ts`: 37 API tests with `auth.service` mocked at `getAuthenticatedUser` and controlled embedding mocks; no real Clerk or Ollama access.
- `memory.integration.test.ts`: 12 real PostgreSQL/Prisma/pgvector tests using deterministic embedding vectors.

Final verified result: **4 test files passed, 65 tests passed, 0 failed.** This does not claim every possible production behavior was tested.

## Database, pgvector, and safety architecture

All database-writing integration tests use the dedicated database named exactly `brainos_test`. The hardened guard requires `NODE_ENV=test`, a valid PostgreSQL URL, and an exact `brainos_test` database name before tests proceed. The integration suite rechecks the guard before database writes and performs scoped cleanup only in that test database.

Verified real integration facts:

- PostgreSQL connectivity and Prisma integration.
- `vector` extension present.
- `Memory.embedding` is `vector(768)`.
- Real persistence, content-plus-embedding updates, importance-only updates, soft deletes, owner isolation, vector search, and deleted-row exclusion.

The development database was **not touched**.

## Test credential resolution

The stale tracked test `DATABASE_URL` fallback with obsolete Docker credentials was removed from `apps/backend/test/setup.ts`. Setup loads local environment configuration and requires locally supplied credentials; no database password is stored in tracked test source. The verified test connection targeted `brainos_test`. The failed-credential incident is resolved.

## Current Git state

At latest verification: branch `main`, ahead of `origin/main` by 1 commit, with existing modified/untracked worktree files. No commit and no push were performed for Phase 16 finalization. Inspect and attribute existing source changes before any future commit.

## Known remaining issue

Vitest/Vite emits a non-failing warning about ESM syntax in `vitest.config.ts` when loaded through the CommonJS config loader. Do not change the config solely to remove the warning without a separately scoped compatibility decision.

## Next-phase readiness

The memory foundation is ready for the next scoped product phase with repeatable safety, service, API, and real-database regression coverage. Future work should preserve the dedicated test database guard, keep Clerk/Ollama boundary mocks separate from real PostgreSQL/pgvector tests, and inspect the current worktree before implementation or commit.

## Phase 16 verdict

**PHASE 16 COMPLETE — 65/65 TESTS PASSING — POSTGRESQL INTEGRATION VERIFIED — PGVECTOR VERIFIED — SECURITY/OWNERSHIP TESTS VERIFIED — NO DEVELOPMENT DATABASE TOUCHED — NO COMMIT — NO PUSH**

# END OF BRAINOS MASTER CONTEXT
