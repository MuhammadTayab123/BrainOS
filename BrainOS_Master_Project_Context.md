# BrainOS — MASTER PROJECT CONTEXT

## Single Source of Truth for Future Development Chats

**Project:** BrainOS
**Purpose:** Personal AI Operating System / Second Brain / Personal Assistant
**Current phase:** Phase 20 — Documents / Knowledge Foundation
**Phase 17 status:** COMPLETE
**Phase 18 status:** COMPLETE — Conversation persistence foundation verified
**Repository:** `D:\Project\BrainOS`
**Branch:** `main`
**OS:** Windows
**Editor:** VS Code
**Last verified local commit:** `d83946c feat(documents): add document content support`

---

# CURRENT AUTHORITATIVE STATE — 2026-08-24

This section is the newest source of truth. Older sections below are historical and are retained for continuity. If an older section conflicts with this section or with the actual repository, inspect the repository and use the newer verified state.

## Current phase

**Phase 20 — Documents / Knowledge Foundation**

Phase 20 has started after the Phase 19 task/reminder work.

### Current verified milestone

**Document foundation + authenticated Document API + document content support + first document ingestion layer COMPLETE.**

Completed document work:

```text
✓ Document Prisma foundation
✓ Document migration
✓ Document repository
✓ Document service
✓ Authenticated Document API
✓ Document API tests
✓ Document content persistence
✓ Content migration
✓ Document ingestion service foundation
✓ TEXT ingestion/normalization
✓ Ingestion unit tests
✓ DocumentService ingestion integration
✓ DocumentService ingestion error propagation
✓ Full backend regression
✓ TypeScript compilation
```

The current ingestion layer intentionally does **not** claim URL or file extraction support.

Current ingestion behavior:

```text
TEXT
  ↓
DocumentIngestionService
  ↓
validate / normalize content
  ↓
DocumentService
  ↓
DocumentRepository
  ↓
PostgreSQL
```

Deferred ingestion sources:

```text
URL
  → reject until URL extraction is implemented

UPLOAD
  → reject until file extraction is implemented
```

### Current Git state

Latest verified commit:

```text
d83946c feat(documents): add document content support
```

Previous document checkpoint:

```text
81a6ac8 feat(documents): add document foundation and API
```

Earlier Phase 19 checkpoints:

```text
cf20183 feat(reminders): add reminder worker and scheduler
c4f42ba feat(reminders): add reminder foundation
```

Latest verified state before continuing document work:

```text
Branch: main
origin/main: d83946c
Working tree: clean
```

Do not claim a commit is pushed unless `git status` / `git log` or an equivalent remote verification confirms it.

## Document architecture

Current document request flow:

```text
Authenticated Request
 ↓
requireAuth
 ↓
Document Controller
 ↓
Document Service
 ↓
Document Repository
 ↓
Prisma
 ↓
PostgreSQL
```

Ingestion-aware creation flow:

```text
Authenticated Request
 ↓
Document Controller
 ↓
Document Service
 ↓
DocumentIngestionService
 ↓
normalized content
 ↓
Document Repository
 ↓
Prisma
 ↓
PostgreSQL
```

Ownership is always derived from the authenticated user context.

Controllers must remain thin.

Prisma/database access remains in repositories.

Business rules remain in services.

## Document API

Current routes:

```text
POST   /api/v1/documents
GET    /api/v1/documents
GET    /api/v1/documents/:id
PATCH  /api/v1/documents/:id/status
DELETE /api/v1/documents/:id
```

Authentication is required.

Document ownership is enforced through the authenticated user.

Soft-deleted documents are excluded from normal reads/lists.

Current document status foundation includes:

```text
PENDING
READY
PROCESSING
FAILED
DELETED
```

Use the actual Prisma enum/schema as authoritative if this changes.

## Document files

Current implementation files:

```text
apps/backend/src/controllers/document/document.controller.ts
apps/backend/src/routes/document.routes.ts

apps/backend/src/services/documents/document.service.ts
apps/backend/src/services/documents/document.types.ts
apps/backend/src/services/documents/repositories/document.repository.ts

apps/backend/src/services/documents/ingestion/document.ingestion.service.ts
apps/backend/src/services/documents/ingestion/document.ingestion.types.ts

apps/backend/test/documents/document.api.test.ts
apps/backend/test/documents/document.service.test.ts
apps/backend/test/documents/document.ingestion.test.ts
```

Current migrations:

```text
apps/backend/prisma/migrations/20260824003625_add_document_foundation/migration.sql
apps/backend/prisma/migrations/20260824053010_add_document_content/migration.sql
```

## Document validation

Latest verified document-focused validation:

```text
Document test files: 3 passed
Document tests: 32 passed
Full backend test files: 21 passed
Full backend tests: 249 passed
TypeScript: passed
```

The document-specific suites include:

```text
document.api.test.ts
document.service.test.ts
document.ingestion.test.ts
```

The ingestion suite verifies the current intentional boundaries:

```text
✓ accepts supported TEXT ingestion
✓ normalizes/validates TEXT content
✓ rejects unsupported URL ingestion until extraction exists
✓ rejects unsupported UPLOAD ingestion until extraction exists
```

The service suite verifies:

```text
✓ normalized document creation
✓ ingestion integration
✓ missing title rejection
✓ missing source type rejection
✓ ingestion error propagation
✓ list validation
✓ owner-scoped retrieval
✓ not-found behavior
✓ status updates
✓ DELETED status protection
✓ soft deletion
```

## Document next milestone

Do not implement all extraction features at once.

Next recommended milestone:

**URL ingestion/extraction foundation**

Expected boundary:

```text
DocumentService
 ↓
DocumentIngestionService
 ↓
URL extractor
 ↓
normalized document content
 ↓
DocumentRepository
```

After URL extraction is verified, implement file/upload extraction separately.

Potential future document pipeline:

```text
Document
 ↓
Source detection
 ↓
Extraction
 ↓
Normalization
 ↓
Chunking
 ↓
Embedding
 ↓
pgvector
 ↓
Semantic retrieval
 ↓
Assistant / RAG
```

Do not add chunking, embeddings, or RAG until the extraction boundary is stable and tested.

## Phase 19 status when moving into Phase 20

Phase 19 task/reminder foundation work has been completed sufficiently to begin the document milestone, but broader automation behavior should not be called complete without evidence.

Verified Phase 19 work includes:

```text
✓ Task persistence
✓ Task ownership
✓ Task soft deletion
✓ Task service/repository
✓ Task assistant tools
✓ Reminder persistence
✓ Reminder ownership
✓ Reminder lifecycle foundation
✓ Reminder service/repository
✓ Reminder scheduler/worker foundation
✓ Related regression tests
```

Any remaining Phase 19 automation/delivery work must be checked against the actual repository before being declared complete.

## Important recent Prisma migration incident

A previous migration checksum mismatch was caused by the already-applied migration:

```text
20260810121955_add_memory_embedding
```

being different from the checksum recorded in the database.

The local migration file was restored from the authoritative Git commit and the database checksum was repaired to match the tracked migration.

After repair:

```text
npx prisma migrate dev --name add_document_foundation
```

successfully created and applied:

```text
20260824003625_add_document_foundation
```

This incident must not be repeated.

### Mandatory Prisma migration rules

Once a migration has been applied:

```text
DO NOT edit migration.sql
DO NOT rename the migration directory
DO NOT delete the migration
DO NOT recreate an applied migration under another timestamp
```

For every future schema change:

```text
1. Check migration status.
2. Inspect git status.
3. Ensure existing applied migrations are untouched.
4. Change schema.prisma.
5. Create a NEW migration.
6. Validate.
7. Generate Prisma Client.
8. Typecheck.
9. Run tests.
10. Commit schema + migration together.
```

Never use `prisma migrate reset` as the first response to a checksum/history problem.

Investigate migration history first.

### Migration preflight

Run from:

```text
D:\Project\BrainOS\apps\backend
```

before creating a migration:

```powershell
npx prisma migrate status
npx prisma validate
npx prisma generate
npx tsc --noEmit
```

Then inspect:

```powershell
git status --short
git diff -- prisma/schema.prisma
```

Only create the migration after confirming no previously applied migration file was modified.

## Phase 20 working rules

For every document milestone:

```text
Read BrainOS_Master_Project_Context.md
 ↓
Check git status/log
 ↓
Inspect actual document files
 ↓
Define one small milestone
 ↓
Implement
 ↓
Run focused tests
 ↓
Run full regression
 ↓
Run TypeScript
 ↓
Update context
 ↓
Review diff
 ↓
Commit
 ↓
Push
 ↓
Verify final Git state
```

Do not skip the context checkpoint.

Do not create a second overlapping document abstraction if the current service/repository/ingestion boundaries already support the requirement.

Do not put extraction logic in controllers.

Do not put Prisma queries in controllers or ingestion providers.

Do not trust client-supplied `userId`.

Do not expose document content or authentication secrets in logs.

## Current known non-blocking warnings

Git may report:

```text
LF will be replaced by CRLF
```

for tracked files on Windows.

This is a line-ending warning, not a functional failure.

Vitest/Vite may also emit the existing non-blocking configuration warning around:

```text
configLoader: 'native'
```

Do not change configuration merely to suppress warnings without a scoped reason.

---

# CURRENT AUTHORITATIVE STATE — 2026-08-23

This section is the present source of truth. Older sections below are historical and are retained for continuity. If an older section conflicts with this section or with the actual repository, inspect the repository and use the newer verified state.

## Current phase

**Phase 19 — Tasks / Reminders / Automation**

### Current verified milestone

**Task foundation + assistant task tools + Reminder persistence/service foundation COMPLETE.**

The broader Phase 19 roadmap is **not** complete yet.

Still future work:

- real assistant → task-tool end-to-end verification
- task result handling improvements
- richer task lifecycle
- reminder scheduler/worker
- reminder delivery integration
- recurring tasks/automations
- automation engine
- proactive reminder behavior
- user-facing task/reminder API/UI where required
- final Phase 19 completion and push verification

## Current Git state

Latest verified local and remote HEAD:

```text
1ece2ed docs(context): update phase 19 task tools checkpoint
```

Verified:

```text
Branch: main
origin/main: 1ece2ed
Working tree: clean BEFORE the current Reminder-foundation changes were started
```

Phase 19 task commits already pushed:

```text
8378a1e feat(tasks): add task foundation and persistence
c37a159 feat(tasks): register task assistant tools
6149b4e test(tasks): add task tool tests
3d2452d feat(tasks): integrate task tools with assistant
0945e5d docs(context): finalize phase 19 task checkpoint
34ead43 feat(tasks): add get and update task tools
1ece2ed docs(context): update phase 19 task tools checkpoint
```

**Important:** the Reminder foundation changes described below are currently implemented and locally verified, but the final Reminder checkpoint has **not yet been committed/pushed** at the time this context is being written.

## Phase 19 verified implementation

### Task foundation

Prisma model:

```text
Task
  id
  userId
  title
  description
  status
  priority
  dueAt
  completedAt
  createdAt
  updatedAt
  deletedAt
```

Enums:

```text
TaskStatus
  TODO
  COMPLETED

TaskPriority
  LOW
  MEDIUM
  HIGH
```

Migration:

```text
apps/backend/prisma/migrations/20260822143000_add_task_foundation/migration.sql
```

Indexes:

```text
(userId)
(userId, status)
(userId, dueAt)
```

Ownership:

```text
Task.userId → User.id
ON DELETE CASCADE
```

Task operations:

```text
createTask
listTasks
getTask
updateTask
completeTask
deleteTask
```

Ownership is enforced through authenticated `userId`.

Soft deletion uses `deletedAt`.

Active task reads/lists exclude soft-deleted rows.

Task list limit is capped at:

```text
50
```

### Assistant task tools

Implemented and registered:

```text
create_task
list_tasks
complete_task
delete_task
get_task
update_task
```

Files:

```text
apps/backend/src/services/tools/task.tools.ts
apps/backend/src/services/tools/tool.container.ts
apps/backend/src/services/tools/tool.executor.ts
apps/backend/src/services/tools/tool.registry.ts
apps/backend/src/services/tools/tool.types.ts
```

Ownership always comes from:

```typescript
context.userId
```

The model/client cannot select the task owner.

Execution boundary:

```text
Assistant
 ↓
ToolExecutor
 ↓
ToolRegistry
 ↓
Task Tool
 ↓
TaskService
 ↓
TaskRepository
 ↓
Prisma
 ↓
PostgreSQL
```

### Reminder persistence/service foundation

The Reminder foundation has now been implemented and locally verified.

Prisma enum:

```text
ReminderStatus
  PENDING
  PROCESSING
  DELIVERED
  FAILED
  CANCELLED
```

Reminder model:

```text
Reminder
  id
  userId
  taskId
  message
  scheduledFor
  status
  attempts
  deliveredAt
  lastError
  createdAt
  updatedAt
  deletedAt
```

Relationships:

```text
Reminder.userId → User.id
ON DELETE CASCADE

Reminder.taskId → Task.id
ON DELETE CASCADE
```

Indexes:

```text
(userId, status)
(scheduledFor, status)
(taskId)
```

Migration:

```text
apps/backend/prisma/migrations/20260823150000_add_reminder_foundation/migration.sql
```

The migration was applied successfully.

Verified:

```powershell
npx prisma migrate status
```

Result:

```text
6 migrations found in prisma/migrations
Database schema is up to date!
```

Reminder implementation:

```text
apps/backend/src/services/reminders/reminder.service.ts
apps/backend/src/services/reminders/reminder.types.ts
apps/backend/src/services/reminders/repositories/reminder.repository.ts
```

Reminder service operations:

```text
createReminder
listReminders
getReminder
markProcessing
markDelivered
markFailed
cancelReminder
deleteReminder
```

Reminder repository behavior includes:

```text
create
listByUser
findByIdForUser
markProcessing
markDelivered
markFailed
cancel
softDeleteByIdForUser
```

Reminder lifecycle:

```text
PENDING
   ↓
PROCESSING
   ↓
DELIVERED

PROCESSING
   ↓
FAILED

PENDING / PROCESSING
   ↓
CANCELLED
```

Important semantics:

- `markProcessing` only claims `PENDING` reminders and increments `attempts`.
- `markDelivered` only succeeds for `PROCESSING` reminders and records `deliveredAt`.
- `markFailed` only succeeds for `PROCESSING` reminders and records `lastError`.
- cancellation is user-scoped and only applies to active `PENDING`/`PROCESSING` reminders.
- normal reads exclude soft-deleted reminders.
- reminder ownership is enforced through authenticated `userId`.

### Reminder validation

The ReminderService validates:

```text
userId
reminderId
optional taskId
message
scheduledFor
list limit
failure error message
```

Reminder list limit is capped at:

```text
50
```

### Reminder tests

Implemented:

```text
apps/backend/test/services/reminders/reminder.service.test.ts
apps/backend/test/services/reminders/repositories/reminder.repository.test.ts
```

Verified focused service suite:

```text
1 test file passed
19 tests passed
0 failed
```

Verified focused repository suite:

```text
1 test file passed
14 tests passed
0 failed
```

### Full backend regression

Latest verified full regression:

```text
16 test files passed
205 tests passed
0 failed
```

Previous Phase 19 task-only checkpoint had 172 tests. The current 205-test result includes the new Reminder coverage.

### Current validation

Latest verified commands:

```powershell
cd D:\Project\BrainOS\apps\backend

npx prisma generate
npx prisma validate
npx prisma migrate status
npx tsc --noEmit
npm run test:run
```

Results:

```text
Prisma Client generated successfully
Prisma schema valid
Database schema is up to date
TypeScript compilation passes
16 test files passed
205 tests passed
0 failed
```

### Reminder files currently present

```text
apps/backend/src/services/reminders/reminder.service.ts
apps/backend/src/services/reminders/reminder.types.ts
apps/backend/src/services/reminders/repositories/reminder.repository.ts

apps/backend/test/services/reminders/reminder.service.test.ts
apps/backend/test/services/reminders/repositories/reminder.repository.test.ts

apps/backend/prisma/migrations/20260823150000_add_reminder_foundation/migration.sql
```

### Current Prisma schema addition

The current uncommitted Reminder schema addition is:

```text
ReminderStatus enum
User.reminders relation
Task.reminders relation
Reminder model
Reminder indexes
Reminder ownership relations
```

The generated SQL was verified with:

```powershell
npx prisma migrate diff `
  --from-schema-datasource .\prisma\schema.prisma `
  --to-schema-datamodel .\prisma\schema.prisma `
  --script
```

and matched the intended Reminder foundation, including:

```text
ReminderStatus
Reminder table
deliveredAt
attempts
lastError
indexes
User foreign key
Task foreign key
```

## Important migration incident and resolution

Earlier in Phase 19, the database contained an extra historical migration record:

```text
20260810121526_add_memory_embedding
```

while the local migration directory contains:

```text
20260810121955_add_memory_embedding
```

Repository inspection established that the tracked migration file is the authoritative one created by:

```text
86c06df feat(memory): add embedding persistence and semantic search
```

The extra database migration record was investigated rather than blindly deleting/resetting the database.

The current local migration history is:

```text
20260806204535_init
20260807191756_add_clerk_user_fields
20260809053527_add_memory_engine
20260810121955_add_memory_embedding
20260822143000_add_task_foundation
20260823150000_add_reminder_foundation
```

The database now reports:

```text
Database schema is up to date!
```
## Prisma Migration Safety Rules

These rules are mandatory for all future BrainOS development.

### Applied migrations are immutable

Once a Prisma migration has been applied to a database:

- never rename its migration directory
- never edit its `migration.sql`
- never delete the migration directory
- never recreate it under a different timestamp/name

Future schema changes must always use a new migration.

### Required migration workflow

Before creating a migration:

```powershell
cd D:\Project\BrainOS\apps\backend

npx prisma migrate status
npx prisma validate
npx prisma generate
npx tsc --noEmit

**Do not reset the database or delete migration history casually.**

## Important development environment note

`pg_dump` and `psql` are not currently available on PATH and the expected PostgreSQL 18 `bin` directory was not found under:

```text
C:\Program Files\PostgreSQL\18
```

The PostgreSQL data directory does exist locally.

For database inspection, Prisma/database access through the configured application environment is currently the verified route.

Do not invent a `pg_dump` path.

## Current task-tool dependency injection note

`task.tools.ts` currently creates its `TaskService` internally:

```typescript
const taskService = new TaskService(
  new TaskRepository(),
);
```

This is acceptable for the current foundation.

Do not refactor merely for style. Improve dependency injection only when architecture or testing requirements justify it.

## Current known non-blocking warning

Vitest/Vite may warn about:

```text
configLoader: 'native'
```

and ESM syntax in `vitest.config.ts`.

This warning does not currently fail tests.

Do not modify configuration merely to suppress it without a separate compatibility decision.

# Phase 19 remaining work

The next work should be scoped carefully.

### Next milestone

Verify the real assistant path with task tools:

```text
User request
 ↓
Assistant controller
 ↓
Assistant service
 ↓
LLM provider
 ↓
tool selection
 ↓
ToolExecutor
 ↓
Task tool
 ↓
TaskService
 ↓
TaskRepository
 ↓
PostgreSQL
 ↓
tool result
 ↓
assistant response
```

Do not claim this is verified until an end-to-end assistant test or manual verification proves it.

### Reminder/automation work still remaining

```text
[ ] reminder scheduler
[ ] reminder execution worker
[ ] reminder delivery integration
[ ] retry/backoff policy
[ ] recurring reminders/tasks
[ ] automation engine
[ ] proactive reminder behavior
[ ] user-facing task/reminder API/UI if required
[ ] final Phase 19 acceptance verification
[ ] final Phase 19 context checkpoint
[ ] final Phase 19 commit
[ ] final Phase 19 push verification
```

Do not implement all remaining items at once.

# Phase 19 acceptance criteria

### Completed

```text
✓ Task persistence
✓ Task ownership enforcement
✓ Task soft deletion
✓ Task filtering
✓ Task service
✓ Task repository
✓ Task service tests
✓ Task PostgreSQL integration tests
✓ create_task
✓ list_tasks
✓ complete_task
✓ delete_task
✓ get_task
✓ update_task
✓ Task tool registration
✓ Task tool validation tests
✓ Reminder persistence
✓ Reminder ownership enforcement
✓ Reminder soft deletion
✓ Reminder status lifecycle foundation
✓ Reminder service
✓ Reminder repository
✓ Reminder service tests
✓ Reminder repository tests
✓ Reminder migration
✓ Prisma generation
✓ Prisma validation
✓ TypeScript compilation
✓ Full backend regression
```

### Not yet complete

```text
[ ] Real assistant → task tool execution verified end-to-end
[ ] Complete reminder scheduling/execution system
[ ] Reminder delivery integration
[ ] Recurring automation
[ ] Proactive automation
[ ] Final Phase 19 documentation checkpoint
[ ] Final Phase 19 commit/push
```

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

# HISTORICAL PROJECT CONTEXT

The remaining sections of this file preserve the previous BrainOS architecture, phase history, memory/security decisions, development rules, and roadmap for continuity.

**Important:** historical sections are not authoritative for current Git/test/migration state. The `CURRENT AUTHORITATIVE STATE` section above takes precedence.

# 1. BRAINOS MISSION

BrainOS is a private personal AI operating system, not merely a chatbot.

Long-term it should:

-   understand context
-   remember useful information
-   retrieve relevant information
-   reason over context
-   help make decisions
-   organize work/study/life
-   manage tasks and reminders
-   understand documents
-   plan
-   use AI models
-   use tools/integrations
-   automate repetitive work
-   communicate naturally
-   eventually support voice/mobile/PWA
-   proactively surface appropriate information
-   act with user control

North-star idea:

> BrainOS should become a private second brain and personal operating
> system that reduces cognitive load.

------------------------------------------------------------------------

# 2. PRODUCT VISION

``` text
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

1.  Conversational AI
2.  Long-term memory
3.  Semantic retrieval
4.  Structured personal data
5.  Tasks/reminders
6.  Planning
7.  Documents/knowledge
8.  Automation
9.  Tools
10. Calendar/email/messaging integrations
11. Voice
12. Agent workflows
13. Decision support
14. Proactive assistance

BrainOS should feel like:

> "My assistant knows my context and helps me manage my
> life/work/study."

Not:

> "A chatbot with a database attached."

------------------------------------------------------------------------

# 3. VERSION 1 SCOPE

The first BrainOS version is focused on one primary user.

Do not prematurely build:

-   SaaS billing
-   public marketplace
-   enterprise RBAC
-   organization complexity
-   public social features
-   unnecessary multi-tenancy

Make BrainOS extremely useful for one user first.

------------------------------------------------------------------------

# 4. ENGINEERING PRINCIPLES

Prefer:

-   clear architecture
-   explicit contracts
-   type safety
-   validation
-   testing
-   observability
-   maintainability
-   incremental changes
-   provider independence

Avoid:

-   quick hacks
-   duplicated business logic
-   giant controllers
-   direct DB access from transport layers
-   unvalidated external input
-   unnecessary abstractions
-   secrets in Git

Provider architecture:

``` text
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

Ollama is the primary local AI provider during development because cost,
privacy, and the lack of a dedicated GPU matter.

------------------------------------------------------------------------

# 5. COST / DEVELOPMENT CONSTRAINTS

Target development cost:

**approximately \$0--\$5/month where practical.**

Student Developer Pack resources should be preferred where appropriate.

Previously considered resources include GitHub, Copilot, DigitalOcean
credits, Azure credits, Clerk, JetBrains, Appwrite, Codespaces, etc.

Do not add paid AI APIs merely for testing unless explicitly requested.

------------------------------------------------------------------------

# 6. DEVELOPMENT ENVIRONMENT

Repository:

`D:\Project\BrainOS`

Local frontend:

`http://localhost:3000`

Local backend:

`http://localhost:3001`

Environment:

-   Windows
-   VS Code
-   Git/GitHub
-   Node.js
-   Docker
-   PostgreSQL
-   Prisma
-   Ollama
-   no dedicated GPU

------------------------------------------------------------------------

# 7. CURRENT TECHNOLOGY STACK

Frontend: - Next.js - React - TypeScript - Clerk

Backend: - Express - TypeScript - Prisma - PostgreSQL

Authentication: - Clerk

Webhooks: - Clerk Webhooks - Svix - ngrok

AI: - Ollama

Embeddings: - Ollama - pgvector

Validation: - Zod

Errors: - AppError - UnauthorizedError - ForbiddenError -
NotFoundError - ValidationError - global error middleware - 404
middleware

Logging: - centralized logger abstraction

------------------------------------------------------------------------

# 8. AUTHENTICATION ARCHITECTURE

Clerk owns authentication.

Frontend does not synchronize users directly into PostgreSQL.

``` text
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

------------------------------------------------------------------------

# 9. USER / WEBHOOK ARCHITECTURE

User persistence/business logic belongs in:

`apps/backend/src/services/user/user.service.ts`

Webhook flow:

``` text
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

``` text
user.created → user-created.handler.ts
user.updated → user-updated.handler.ts
user.deleted → user-deleted.handler.ts
```

Actual repository state is authoritative.

Webhook delivery may repeat, so user creation must remain idempotent.

------------------------------------------------------------------------

# 10. PRISMA RULES

Database schema changes must use migrations:

``` powershell
npx prisma migrate dev --name <migration_name>
```

Validation:

``` powershell
npx prisma validate
```

Remember:

``` text
prisma migrate dev = Schema → Database
prisma db pull     = Database → Schema
```

Do not casually use `db pull` after editing `schema.prisma`.

Prisma belongs in services/repositories, not controllers.

------------------------------------------------------------------------

# 11. EXPRESS ARCHITECTURE

Important ordering:

1.  webhook raw-body route
2.  JSON parser
3.  Clerk middleware
4.  request logger
5.  root route
6.  health routes
7.  user routes
8.  memory routes
9.  development routes
10. 404 middleware
11. error middleware

Webhook raw-body handling must remain compatible with Svix verification.

API areas include:

``` text
/webhooks
/api/v1/users
/api/v1/memories
/api/v1/dev
```

The actual `apps/backend/src/app.ts` is authoritative.

------------------------------------------------------------------------

# 12. ERROR ARCHITECTURE

Application errors are centralized.

Expected response shape:

``` json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

Middleware/controllers should forward errors to the centralized error
handler instead of returning competing responses.

------------------------------------------------------------------------

# 13. PHASE HISTORY

## Phase 0 --- Clean Development Machine

Development machine/prerequisites established.

## Phase 1 --- Initial Foundation

Git/GitHub, VS Code, environment, database tooling, BrainOS vision, cost
constraints, local-first direction, documentation workflow.

## Phase 2 --- Tooling Foundation

Node.js and core tooling configured.

## Phase 3 --- Core Project Foundation

Major domains established: - API - Authentication - Memory - AI -
Tasks - Integrations

## Phase 4 --- PostgreSQL / Prisma / Local Infrastructure

Local PostgreSQL, Docker-era infrastructure, Prisma, connectivity, and
monorepo foundation established.

Historical runtime details must be verified before reuse.

## Phase 8 --- Clerk Authentication

ClerkProvider, authentication routes, middleware, sign-in/sign-up,
dashboard flow.

## Phase 9 --- Clerk Webhooks & User Synchronization

Completed architectural milestone: - Svix verification - ngrok
development flow - User schema - Prisma migration - PostgreSQL
synchronization - user-created flow - dispatcher - handlers - user
service - thin controllers - real Clerk → PostgreSQL verification

## Phase 10 --- Backend Core Infrastructure

Completed: - environment configuration - Zod validation - centralized
logger - AppError - global error middleware - 404 middleware - async
error handling

## Phase 11 --- AI Provider Layer

Provider-boundary architecture established so BrainOS can use Ollama and
future providers without rewriting higher layers.

## Phase 12 --- Memory Foundation

Memory domain, Memory Service, Embeddings Service, provider boundary,
and repository separation established.

## Phase 13 --- Semantic Memory Foundation

PostgreSQL + pgvector semantic retrieval foundation established with
limits, thresholds, user ownership, and soft-delete filtering.

## Phase 14 --- Authenticated Semantic Memory

COMPLETE. End-to-end authenticated memory creation, embedding
persistence, semantic retrieval, ownership isolation, and soft-delete
behavior were verified.

------------------------------------------------------------------------

# 14. PHASE 14 VERIFIED RESULTS

Frontend obtains Clerk token:

``` typescript
const { getToken } = await auth();
const token = await getToken();
```

Sends:

``` text
Authorization: Bearer <token>
```

Backend authentication verification showed: - Authorization header
present - Bearer scheme - Clerk user ID - Clerk session ID - database
user found

Memory creation:

`POST /api/v1/memories` → `HTTP 201`

Persistence sequence:

``` text
INSERT Memory
 ↓
UPDATE Memory embedding = vector
 ↓
COMMIT
```

Semantic search:

`POST /api/v1/memories/search` → `HTTP 200`

Similarity:

``` sql
1 - ("embedding" <=> $1::vector)
```

Search filters: - authenticated userId - deletedAt IS NULL - embedding
IS NOT NULL - similarity threshold - limit

Verified test query:

`BrainOS Phase 14 authenticated memory test`

Verified similarity:

`0.9123692930368563`

42 duplicate Phase 14 test memories were soft-deleted.

------------------------------------------------------------------------

# 15. MEMORY ARCHITECTURE

Current creation flow:

``` text
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

``` text
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

------------------------------------------------------------------------

# 16. MEMORY DATA MODEL

Conceptually:

``` prisma
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

Use relational columns for structured facts and vectors for semantic
retrieval. Do not vectorize everything.

------------------------------------------------------------------------

# 17. PHASE 15 --- MEMORY PRODUCTION HARDENING & CLEANUP

**CURRENT PHASE: IN PROGRESS**

Goal:

> Turn the proven Phase 14 memory pipeline into a clean, secure,
> maintainable foundation for future BrainOS capabilities.

Do not immediately add a giant new feature.

Phase 15 is about security, ownership, boundaries, testing, cleanup, and
production readiness.

------------------------------------------------------------------------

# 18. PHASE 15 CHECKPOINT ALREADY COMPLETED

Git commit:

`6ab95e4 feat(memory): harden authenticated memory ownership`

Five files changed:

``` text
apps/backend/src/app.ts
apps/backend/src/middleware/auth.middleware.ts
apps/backend/src/services/auth/auth.service.ts
apps/backend/src/services/memory/memory.service.ts
apps/backend/src/services/memory/repositories/memory.repository.ts
```

Diff summary:

**5 files changed, 14 insertions(+), 33 deletions(-)**

## Change A --- Clerk debug logging disabled

Removed intentional:

``` typescript
debug: true
```

from Clerk middleware configuration.

## Change B --- Auth middleware error handling fixed

The old flow could call `next(error)` and then also send a 401 response.

Current architectural direction:

``` typescript
try {
  req.user = await getAuthenticatedUser(req);
  next();
} catch (error) {
  next(error);
}
```

The centralized error middleware owns the final response.

## Change C --- Authentication errors use AppError

`getAuthenticatedUser()` now throws:

``` typescript
new UnauthorizedError()
```

instead of generic `Error` instances for missing/unknown authenticated
users.

## Change D --- Sensitive auth debug logs removed

Removed temporary logs exposing: - authorization details - Clerk user
ID - Clerk session ID - database lookup debug information

These should not be present in production logs.

## Change E --- Embedding ownership is explicit

Memory Service now calls:

``` typescript
await memoryRepository.updateEmbedding(
  data.userId,
  memory.id,
  embeddingResult.vector
);
```

## Change F --- Repository embedding update is user-scoped

`updateEmbedding()` now accepts:

``` typescript
memoryId: string
userId: string
embedding: number[]
```

and updates only when:

``` sql
WHERE "id" = $memoryId
  AND "userId" = $userId
  AND "deletedAt" IS NULL
```

Security rule established:

> Every memory mutation must be scoped to the authenticated owner, not
> merely the memory ID.

------------------------------------------------------------------------

# 19. PHASE 15 VALIDATION ALREADY PASSED

Command:

``` powershell
npm --prefix apps/backend run typecheck
```

Result:

``` text
> backend@1.0.0 typecheck
> tsc --noEmit
```

Completed successfully with no TypeScript errors.

**Backend TypeScript: PASS**

This is not sufficient to declare Phase 15 complete.

------------------------------------------------------------------------

# 20. CURRENT GIT STATE

Last verified state:

``` text
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
nothing to commit, working tree clean
```

Latest local checkpoint:

``` text
6ab95e4 feat(memory): harden authenticated memory ownership
```

Previous relevant commits include:

``` text
b1074ec context for each phase
63e0492 feat(memory): complete authenticated semantic memory pipeline
```

Important:

**The Phase 15 checkpoint is committed locally but has NOT yet been
claimed as pushed.**

Immediate Git action when appropriate:

``` powershell
git push origin main
```

Then verify:

``` powershell
git status
git log --oneline -5
```

------------------------------------------------------------------------

# 21. PHASE 15 REMAINING WORK

## A. Push current checkpoint

-   verify status
-   push
-   verify remote state

## B. Memory API contract review

Review:

``` text
POST /api/v1/memories
POST /api/v1/memories/search
```

Check: - validation - authentication - ownership - consistent response
shape - centralized errors - service boundaries - repository boundaries

Potential future API:

``` text
GET    /memories
GET    /memories/:id
PATCH  /memories/:id
DELETE /memories/:id
```

Do not implement them unless the phase requires them.

## C. Security tests

Test:

1.  no Authorization header
2.  invalid token
3.  valid authenticated user
4.  authenticated Clerk user missing from DB
5.  user A creates memory
6.  user A searches own memory
7.  user A cannot retrieve user B memory
8.  user B cannot retrieve user A memory
9.  deleted memory is not searchable
10. embedding update cannot target another user's memory

## D. Soft-delete verification

Verify:

``` text
Create → visible
Soft delete → invisible
Database row → remains
```

## E. Embedding boundary review

Ensure:

``` text
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

Review: - schema - vector dimension - similarity operator - indexes -
ownership filtering - soft-delete filtering

Do not optimize prematurely.

## G. Automated tests

Add repeatable tests for: - authentication - create - embedding
persistence - search - isolation - soft delete - error behavior

## H. Frontend cleanup

Review:

`apps/web/app/dashboard/memory-test/page.tsx`

It is a diagnostic page, not the final memory UI.

## I. Next.js middleware/proxy warning

Investigate the deprecation warning.

Do not blindly migrate.

First inspect current Clerk middleware behavior and official
requirements, then make the smallest safe change if migration is
actually needed.

------------------------------------------------------------------------

# 22. PHASE 15 ACCEPTANCE CRITERIA

Architecture: - repository/context reviewed - memory boundary reviewed -
auth boundary reviewed - embedding boundary reviewed - ownership
enforced in memory mutations

Security: - unauthenticated requests rejected - invalid authentication
rejected - unknown DB user rejected - cross-user memory isolation
verified - sensitive auth logs removed - embedding updates are
user-scoped - no secrets/tokens/session IDs logged

Memory: - create works - embedding persists - search works - similarity
works - ownership is enforced - soft delete works - deleted memory
excluded

Frontend: - Clerk works - memory test page works - middleware/proxy
issue investigated - no new runtime/hydration errors

Quality: - backend typecheck passes - frontend build passes - automated
tests pass where implemented - Git diff reviewed - no unnecessary
abstraction

Documentation: - Phase 15 handoff updated - decisions recorded -
commands recorded - tests recorded - technical debt recorded - next
phase recorded

Git: - clean working tree - checkpoint committed - checkpoint pushed -
final log verified

------------------------------------------------------------------------

# 23. MEMORY SECURITY RULES

Non-negotiable:

### Authentication

Never trust:

``` text
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

Never log: - access tokens - secrets - full Authorization headers -
unnecessary session IDs - private memory content

### Errors

Do not leak internal provider/database details.

------------------------------------------------------------------------

# 24. FUTURE MEMORY ROLE

Memory will eventually include:

-   user preferences
-   personal facts
-   projects
-   goals
-   tasks
-   experiences
-   decisions
-   relationships
-   documents
-   knowledge
-   conversation summaries
-   temporary context

Long-term pipeline:

``` text
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

-   usefulness
-   permanence
-   confidence
-   sensitivity
-   duplication
-   expiration
-   user control

BrainOS should not blindly remember everything.

------------------------------------------------------------------------

# 25. FUTURE AI ORCHESTRATION

Long-term:

``` text
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

------------------------------------------------------------------------

# 26. NORTH-STAR ARCHITECTURE

``` text
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

**Identity + Memory + Knowledge + AI + Tools + Tasks + Automation +
Decision Support**

into one coherent personal system.

------------------------------------------------------------------------

# 27. CURRENT IMPORTANT FILES

Backend:

``` text
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

``` text
apps/web/.env.local
apps/web/lib/brainos-api.ts
apps/web/app/dashboard/memory-test/page.tsx
apps/web/app/layout.tsx
```

Always inspect actual source before editing.

------------------------------------------------------------------------

# 28. KNOWN TECHNICAL DEBT

## Next.js middleware/proxy warning

Investigate in Phase 15. Do not blindly migrate.

## Temporary memory test page

Diagnostic only; not final UI.

## Automated tests

Phase 14 was primarily manually verified. Phase 15 should make important
behavior repeatable.

## Historical handler notes

Older context may describe user.updated/user.deleted as skeletons.
Verify actual repository state before assuming anything is incomplete.

------------------------------------------------------------------------

# 29. VERIFIED VS PLANNED

## Verified

-   Clerk authentication reaches backend
-   Bearer token flow works
-   Clerk user maps to PostgreSQL User
-   memory creation works
-   embedding generation works
-   pgvector persistence works
-   semantic search works
-   similarity works
-   user-scoped search works
-   soft delete filtering works
-   42 duplicate Phase 14 test records were soft-deleted
-   centralized error architecture exists
-   Phase 15 ownership hardening checkpoint exists
-   backend TypeScript typecheck passes
-   local working tree was clean after the checkpoint
-   local `main` is one commit ahead of `origin/main`

## Not yet fully verified for Phase 15

-   full unauthenticated/invalid-token matrix
-   cross-user isolation regression tests
-   embedding ownership mutation regression test
-   automated memory regression suite
-   frontend production build after hardening
-   middleware/proxy decision
-   final Phase 15 documentation
-   push of `6ab95e4`
-   final Phase 15 Git verification

Do not mark planned work as complete without evidence.

------------------------------------------------------------------------

# 30. DEVELOPMENT COMMANDS

Backend:

``` powershell
cd D:\Project\BrainOSppsackend
npm run dev
```

Frontend:

``` powershell
cd D:\Project\BrainOSpps\web
npm run dev
```

Backend typecheck:

``` powershell
npm --prefix apps/backend run typecheck
```

Frontend build:

``` powershell
cd D:\Project\BrainOSpps\web
npm run build
```

Prisma:

``` powershell
cd D:\Project\BrainOSppsackend
npx prisma validate
npx prisma studio
npx prisma migrate dev --name <migration_name>
```

Git:

``` powershell
cd D:\Project\BrainOS
git status
git branch --show-current
git log --oneline -10
git diff
```

Push:

``` powershell
git push origin main
```

ngrok:

``` powershell
ngrok http 3001
```

------------------------------------------------------------------------

# 31. TESTING PHILOSOPHY

A feature is not complete because code exists or TypeScript compiles.

Definition of Done:

``` text
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

------------------------------------------------------------------------

# 32. SENIOR DEVELOPER WORKING STYLE

For every task:

``` text
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

1.  Read the actual error.
2.  Identify the likely root cause.
3.  Inspect relevant files.
4.  Make the smallest correct fix.
5.  Retest.
6.  Verify.

Do not provide random destructive fix lists.

------------------------------------------------------------------------

# 33. EXPECTED ROADMAP

``` text
Phase 14
Authenticated Semantic Memory — COMPLETE
        ↓
Phase 15
Memory Production Hardening & Cleanup — COMPLETE
        ↓
Phase 16
Automated Memory Regression Testing and Test Database Safety — COMPLETE
        ↓
Phase 17
AI Assistant Integration / Orchestration — COMPLETE
        ↓
Phase 18
Conversation + Persistent Context — COMPLETE
        ↓
Phase 19
Tasks / Reminders / Automation — CURRENT
        ↓
Phase 20+
Documents / Knowledge / Agents / Integrations / Voice / Proactive Assistant
```

Re-evaluate after every phase.

------------------------------------------------------------------------

# 34. SUCCESS CRITERIA

Eventually BrainOS should be able to:

### Remember

"Remember my project architecture."

### Retrieve

"What did I decide about the database?"

### Understand

"Read this document and tell me what matters."

### Plan

"Plan my week around my classes and projects."

### Decide

"Compare these options based on my priorities."

### Act

"Create the task and remind me tomorrow."

### Integrate

"Check my calendar and tell me if I have time."

### Proactively assist

"You have a deadline tomorrow and this related document has not been
reviewed."

### Learn responsibly

"That preference is likely important for future recommendations."

User control and privacy remain central.

------------------------------------------------------------------------

# 35. CURRENT AUTHORITATIVE STATE

This section supersedes older current-phase, planned-work, and stale
Git-state statements above. Historical sections are retained
intentionally.

## Current phase

**Phase 19 --- Tasks / Reminders / Automation**

Phase 19 is actively being implemented.

The first Phase 19 milestone is the **Task foundation and assistant tool
integration**. The verified foundation is complete.

## Verified Phase 19 implementation

### Task database foundation

Prisma schema now contains:

``` text
TaskStatus
  TODO
  COMPLETED

TaskPriority
  LOW
  MEDIUM
  HIGH
```

`Task` model fields:

``` text
id
userId
title
description
status
priority
dueAt
completedAt
createdAt
updatedAt
deletedAt
```

Indexes:

``` text
(userId)
(userId, status)
(userId, dueAt)
```

Ownership:

``` text
Task.userId → User.id
ON DELETE CASCADE
```

Migration:

``` text
apps/backend/prisma/migrations/20260822143000_add_task_foundation/migration.sql
```

The migration was applied successfully to the dedicated test database
`brainos_test`.

Verified:

``` powershell
npx prisma migrate status
```

Result:

``` text
Database schema is up to date!
```

### Task service/repository

Implemented:

``` text
apps/backend/src/services/tasks/task.service.ts
apps/backend/src/services/tasks/task.types.ts
apps/backend/src/services/tasks/repositories/task.repository.ts
```

Task service operations include:

``` text
createTask
listTasks
getTask
updateTask
completeTask
deleteTask
```

The service validates: - authenticated user ID - task ID - task title -
list limits - task input normalization

The repository owns Prisma access.

Ownership is enforced through user-scoped repository operations.

Soft deletion is represented through `deletedAt`.

Active reads/lists exclude soft-deleted tasks.

Task list limit is capped at:

``` text
50
```

### Task regression coverage

Implemented:

``` text
apps/backend/test/services/tasks/task.service.test.ts
apps/backend/test/tasks/task.integration.test.ts
```

The PostgreSQL integration suite verifies:

-   task persistence
-   owner-scoped listing
-   owned task retrieval
-   cross-owner read denial
-   owned update
-   cross-owner update denial
-   completion
-   cross-owner completion denial
-   soft deletion
-   hidden soft-deleted tasks
-   repeated/cross-owner deletion denial
-   status/priority filtering

The integration suite uses the dedicated test database and was verified
after applying the task migration.

### Assistant task tools

Implemented:

``` text
apps/backend/src/services/tools/task.tools.ts
```

Registered tools:

``` text
create_task
list_tasks
complete_task
delete_task
```

Tool behavior:

``` text
ToolContext
    ↓
authenticated userId
    ↓
TaskService
    ↓
TaskRepository
    ↓
Prisma
    ↓
PostgreSQL
```

The tools do not allow the model/client to choose the task owner.

Ownership always comes from:

``` typescript
context.userId
```

Tool input validation covers: - object shape - required strings - enum
values - ISO date values - positive integer limits - task IDs

Task tools are registered in:

``` text
apps/backend/src/services/tools/tool.container.ts
```

Existing development tool remains registered:

``` text
test_tool
```

### Task tool tests

Implemented:

``` text
apps/backend/test/services/tools/task.tools.test.ts
```

Verified coverage includes:

``` text
create_task
list_tasks
complete_task
delete_task
```

including: - authenticated ownership - required-field validation -
invalid enum validation - invalid input validation - invalid limit
validation - task ID validation - service delegation behavior

## Verified validation

Latest verified backend validation:

``` powershell
npx prisma generate
npx prisma validate
npx tsc --noEmit
npm run test:run
```

Results:

``` text
Prisma Client generated successfully
Prisma schema valid
TypeScript compilation passes
14 test files passed
172 tests passed
0 failed
```

The full backend test run was verified with:

``` text
Test Files  14 passed (14)
Tests       166 passed (166)
```

Task-specific verification:

``` text
Task tool tests: 12 passed
Task PostgreSQL integration tests: 11 passed
```

## Prisma generation note

Prisma commands must be executed from:

``` text
D:\Project\BrainOS\apps\backend
```

because the active Prisma configuration resolves:

``` text
apps/backend/prisma/schema.prisma
```

Running `npx prisma generate` from the repository root can cause Prisma
to look for:

``` text
D:\Project\BrainOS\prisma\schema.prisma
```

and fail.

Correct:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx prisma generate
```

## Test database incident and resolution

During Phase 19 setup, the task integration suite initially connected
to:

``` text
brainos_test
```

but the new `Task` table had not yet been migrated.

The integration suite correctly failed because:

``` text
public.Task does not exist
```

The correct resolution was:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx prisma migrate deploy
```

The task migration:

``` text
20260822143000_add_task_foundation
```

was then applied successfully.

After migration:

``` text
Database schema is up to date!
```

and the task integration suite passed all 11 tests.

No production/development database should be modified casually.

## TypeScript issue resolved

The task integration test initially showed implicit-`any` errors for
callback parameters.

A temporary attempt added explicit Prisma `Task` annotations, but the
resulting diff was unnecessary formatting/type noise.

The integration test was restored to the clean original style after the
underlying generated Prisma Client issue was resolved.

Then:

``` powershell
npx prisma generate
npx tsc --noEmit
```

passed successfully.

The final committed test file is therefore the clean version, not the
temporary noisy version.

## Tool test issue resolved

The task tool tests initially failed before executing any tests because
Vitest mock initialization hit:

``` text
Cannot access 'mockCreateTask' before initialization
```

The test setup was corrected.

The next failure was only an error-message mismatch:

``` text
Expected: "title is required."
Received: "title must be a string."
```

and the equivalent `taskId` cases.

The validation behavior/tests were aligned.

Final result:

``` text
12/12 task tool tests passing
```

## Git checkpoints

Phase 19 task work was split into three commits:

``` text
8378a1e feat(tasks): add task foundation and persistence
c37a159 feat(tasks): register task assistant tools
6149b4e test(tasks): add task tool tests
```

Verified contents of `8378a1e`:

``` text
apps/backend/prisma/migrations/20260822143000_add_task_foundation/migration.sql
apps/backend/prisma/schema.prisma
apps/backend/src/services/tasks/repositories/task.repository.ts
apps/backend/src/services/tasks/task.service.ts
apps/backend/src/services/tasks/task.types.ts
apps/backend/test/services/tasks/task.service.test.ts
apps/backend/test/tasks/task.integration.test.ts
```

Verified contents of `c37a159`:

``` text
apps/backend/src/services/tools/task.tools.ts
apps/backend/src/services/tools/tool.container.ts
```

Verified contents of `6149b4e`:

``` text
apps/backend/test/services/tools/task.tools.test.ts
```

Latest verified Git state:

``` text
On branch main
Your branch is ahead of 'origin/main' by 3 commits.
nothing to commit, working tree clean
```

Do not claim these commits are pushed unless a later command verifies
the remote state.

## Current architecture

Task domain:

``` text
Assistant
   ↓
ToolExecutor
   ↓
ToolRegistry
   ↓
Task Tool
   ↓
TaskService
   ↓
TaskRepository
   ↓
Prisma
   ↓
PostgreSQL
```

Authentication ownership:

``` text
Clerk
   ↓
Authenticated request
   ↓
ToolContext.userId
   ↓
TaskService
   ↓
TaskRepository
```

The task owner is never taken from tool input.

## Current task tool boundary

`task.tools.ts` currently creates a service instance internally:

``` typescript
const taskService = new TaskService(
  new TaskRepository(),
);
```

This is acceptable for the current foundation but is a known future
dependency-injection improvement.

Do not refactor this merely for style. Only change it when the
architecture or testing requirements justify the change.

## Current known warnings

Vitest/Vite may emit a non-failing warning concerning:

``` text
configLoader: 'native'
```

and ESM syntax in:

``` text
vitest.config.ts
```

This warning does not currently fail the tests.

Do not change the configuration merely to suppress the warning without a
separately scoped compatibility decision.

# 36. PHASE 19 CURRENT CHECKPOINT

**Phase 19 task foundation milestone: COMPLETE**

Completed:

``` text
✓ Task Prisma model
✓ Task enums
✓ Task migration
✓ Dedicated test DB migration
✓ Task repository
✓ Task service
✓ Task service tests
✓ Task PostgreSQL integration tests
✓ create_task tool
✓ list_tasks tool
✓ complete_task tool
✓ delete_task tool
✓ Tool registry registration
✓ Task tool tests
✓ Ownership isolation
✓ Soft deletion
✓ Input validation
✓ Prisma generation
✓ Prisma validation
✓ TypeScript validation
✓ Full backend regression suite
```

Verified:

``` text
14 test files passed
172 tests passed
0 failed
```

## Phase 19 remaining work

The next work should be scoped carefully.

Potential next milestone:

### Task tools through the actual assistant loop

Verify the real path:

``` text
User request
 ↓
Assistant controller
 ↓
Assistant service
 ↓
LLM provider
 ↓
tool selection
 ↓
ToolExecutor
 ↓
Task tool
 ↓
TaskService
 ↓
TaskRepository
 ↓
PostgreSQL
 ↓
tool result
 ↓
assistant response
```

The task tools are registered, but do not claim full natural-language
assistant task execution is verified until an end-to-end assistant test
or manual verification proves it.

Then consider, in separate milestones:

-   `update_task` tool
-   `get_task` tool
-   richer due-date handling
-   reminder scheduling
-   recurring tasks
-   automation infrastructure
-   task completion/update response handling
-   task-related conversation context
-   user-facing task API/UI if required

Do not implement all of these at once.

## Phase 19 acceptance criteria

Current task-foundation milestone:

``` text
✓ Task persistence works
✓ Task ownership is enforced
✓ Task soft deletion works
✓ Task filtering works
✓ Task tools exist
✓ Task tools use authenticated context ownership
✓ Task tools are registered
✓ Task tool validation is tested
✓ PostgreSQL integration passes
✓ Full backend tests pass
✓ TypeScript passes
✓ Prisma schema validates
✓ Migration is applied to brainos_test
✓ Git commits exist
```

Broader Phase 19 completion:

``` text
[ ] Real assistant → task tool execution verified
[ ] Task tool result handling verified
[ ] Task lifecycle complete
[ ] Reminder/scheduler architecture designed
[ ] Reminder execution verified
[ ] Automation behavior tested
[ ] Phase 19 documentation updated
[ ] Final Phase 19 checkpoint committed
[ ] Final Phase 19 push verified
```

# 37. CURRENT FILE MAP

Task implementation:

``` text
apps/backend/src/services/tasks/task.service.ts
apps/backend/src/services/tasks/task.types.ts
apps/backend/src/services/tasks/repositories/task.repository.ts
```

Task tools:

``` text
apps/backend/src/services/tools/task.tools.ts
apps/backend/src/services/tools/tool.container.ts
apps/backend/src/services/tools/tool.registry.ts
apps/backend/src/services/tools/tool.executor.ts
apps/backend/src/services/tools/tool.types.ts
```

Task tests:

``` text
apps/backend/test/services/tasks/task.service.test.ts
apps/backend/test/tasks/task.integration.test.ts
apps/backend/test/services/tools/task.tools.test.ts
```

Task migration:

``` text
apps/backend/prisma/migrations/20260822143000_add_task_foundation/migration.sql
```

Schema:

``` text
apps/backend/prisma/schema.prisma
```

Assistant/tool integration:

``` text
apps/backend/src/controllers/assistant/assistant.controller.ts
apps/backend/src/services/assistant/assistant.service.ts
apps/backend/src/services/tools/tool.container.ts
apps/backend/src/services/tools/tool.executor.ts
apps/backend/src/services/tools/tool.registry.ts
```

Always inspect actual source before modifying these files.

# 38. PHASE 17 AND PHASE 18 HISTORICAL CHECKPOINTS

## Phase 17 --- AI Assistant Integration / Orchestration

Phase 17 established: - assistant service - AI provider integration -
tool registry - tool executor - authenticated assistant route - Ollama
integration - assistant/tool boundary

Relevant commit:

``` text
afc51f4 feat: add assistant tool calling with Ollama
```

Actual repository state is authoritative for exact implementation.

## Phase 18 --- Conversation + Persistent Context

Phase 18 established: - conversation persistence - message persistence -
assistant conversation integration - conversation activity updates

Relevant commits:

``` text
7d4c465 docs: prepare Phase 18 conversation context
5f7ed01 docs: update phase 18 context
c7780e0 feat: add conversation persistence
38abcb5 feat: add conversation message persistence
262a0a7 feat: connect assistant to conversation persistence
6e9cd88 fix: update conversation activity on message creation
```

Phase 18 is now treated as complete for roadmap purposes.

Do not restart Phase 18 unless a verified regression requires it.

# 39. VERIFIED VS PLANNED --- UPDATED

## Verified

-   Clerk authentication reaches backend
-   Bearer token flow works
-   Clerk user maps to PostgreSQL User
-   centralized error architecture exists
-   centralized logging abstraction exists
-   memory creation works
-   memory embeddings work
-   pgvector persistence works
-   semantic memory search works
-   authenticated memory ownership isolation works
-   soft-delete memory filtering works
-   automated memory regression suite exists
-   dedicated `brainos_test` database safety exists
-   task schema exists
-   task migration exists
-   task repository exists
-   task service exists
-   task PostgreSQL integration exists
-   task assistant tools exist
-   task tools are registered
-   task tool tests exist
-   task ownership comes from authenticated tool context
-   task soft deletion works
-   task filtering works
-   Prisma generation passes
-   Prisma validation passes
-   TypeScript compilation passes
-   full backend suite passes with 166 tests

## Not yet fully verified

-   natural-language assistant → task tool execution end-to-end
-   reminder scheduler
-   reminder delivery
-   recurring automation
-   full task API/UI
-   production deployment of task functionality
-   Phase 19 final documentation
-   Phase 19 final push verification

Never mark these as complete without evidence.

# 40. DEVELOPMENT COMMANDS

Backend:

``` powershell
cd D:\Project\BrainOS\apps\backend
npm run dev
```

Frontend:

``` powershell
cd D:\Project\BrainOS\apps\web
npm run dev
```

Backend typecheck:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx tsc --noEmit
```

Full backend tests:

``` powershell
cd D:\Project\BrainOS\apps\backend
npm run test:run
```

Task tool tests:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx vitest run test/services/tools/task.tools.test.ts
```

Task PostgreSQL integration:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx vitest run test/tasks/task.integration.test.ts
```

Prisma:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx prisma generate
npx prisma validate
npx prisma migrate status
```

Apply pending migrations when intentionally required:

``` powershell
cd D:\Project\BrainOS\apps\backend
npx prisma migrate deploy
```

Git:

``` powershell
cd D:\Project\BrainOS
git status
git branch --show-current
git log --oneline -10
git diff
```

Push:

``` powershell
git push origin main
```

# 41. TESTING PHILOSOPHY

A feature is not complete because code exists or TypeScript compiles.

Definition of Done:

``` text
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

For task features specifically:

``` text
Tool input
 ↓
Validation
 ↓
Authenticated ownership
 ↓
Service
 ↓
Repository
 ↓
Database
 ↓
Result
 ↓
Assistant behavior
```

Each boundary should be tested at the appropriate level.

# 42. SENIOR DEVELOPER WORKING STYLE

For every task:

``` text
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

1.  Read the actual error.
2.  Identify the likely root cause.
3.  Inspect relevant files.
4.  Make the smallest correct fix.
5.  Retest.
6.  Verify.

Do not provide random destructive fix lists.

# 43. UPDATED ROADMAP

``` text
Phase 14
Authenticated Semantic Memory — COMPLETE
        ↓
Phase 15
Memory Production Hardening & Cleanup — COMPLETE
        ↓
Phase 16
Automated Memory Regression Testing and Test Database Safety — COMPLETE
        ↓
Phase 17
AI Assistant Integration / Orchestration — COMPLETE
        ↓
Phase 18
Conversation + Persistent Context — COMPLETE
        ↓
Phase 19
Tasks / Reminders / Automation — CURRENT
        ↓
Phase 20+
Documents / Knowledge / Agents / Integrations / Voice / Proactive Assistant
```

Re-evaluate after every phase.

# 44. SUCCESS CRITERIA

Eventually BrainOS should be able to:

### Remember

"Remember my project architecture."

### Retrieve

"What did I decide about the database?"

### Understand

"Read this document and tell me what matters."

### Plan

"Plan my week around my classes and projects."

### Decide

"Compare these options based on my priorities."

### Act

"Create the task and remind me tomorrow."

### Integrate

"Check my calendar and tell me if I have time."

### Proactively assist

"You have a deadline tomorrow and this related document has not been
reviewed."

### Learn responsibly

"That preference is likely important for future recommendations."

User control and privacy remain central.

# 45. FINAL PROJECT STATEMENT

BrainOS is being built to become a private personal AI operating system
that:

-   remembers
-   understands
-   retrieves
-   reasons
-   recommends
-   organizes
-   plans
-   integrates
-   automates
-   eventually acts appropriately with user control

The technical foundation is deliberately being built before the
high-level assistant.

Current verified stack:

**Clerk + Express + PostgreSQL + Prisma + Ollama + pgvector + Next.js**

Current milestone:

**Phase 19 --- Task foundation and assistant task tools complete;
reminder/automation work remains**

Current verified test result:

**14 test files passed; 166 tests passed; 0 failed**

Current verified Git checkpoints:

``` text
8378a1e feat(tasks): add task foundation and persistence
c37a159 feat(tasks): register task assistant tools
6149b4e test(tasks): add task tool tests
```

Ultimate mission:

> Build a personal AI assistant that understands the user's context,
> stores and retrieves useful information, helps make better decisions,
> organizes life/work/study, and provides appropriate proactive
> assistance while remaining private, modular, affordable, maintainable,
> and under the user's control.

# END OF BRAINOS MASTER CONTEXT
