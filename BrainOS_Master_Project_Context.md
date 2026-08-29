# BrainOS — MASTER PROJECT CONTEXT

## Single Source of Truth for Future Development Chats

**Project:** BrainOS
**Purpose:** Private Personal AI Operating System / Second Brain / Personal Assistant
**Repository:** `D:\Project\BrainOS`
**Branch:** `main`
**OS:** Windows
**Editor:** VS Code
**Current date checkpoint:** 2026-08-29
**Current phase:** Phase 20 — Documents / Knowledge / RAG

---

# 0. CRITICAL RULE FOR EVERY FUTURE CHAT

Before changing BrainOS:

1. Read this context completely.
2. Inspect the actual repository.
3. Check `git status` and recent commits.
4. Inspect relevant files.
5. Confirm the current milestone against the repository.
6. Explain the architectural reason for significant changes.
7. Make the smallest correct change.
8. Run focused tests.
9. Run TypeScript validation.
10. Run broader regression when appropriate.
11. Verify actual behavior.
12. Update this context after meaningful milestones.
13. Review the Git diff.
14. Commit completed work.
15. Push completed work.
16. Verify final Git state.

Never restart completed work, blindly overwrite working code, bypass authentication/authorization, trust client-supplied ownership IDs, put Prisma access/business logic in controllers, expose secrets/tokens/session IDs/private document content in logs, claim unverified work is complete, edit applied Prisma migrations, or use `prisma migrate reset` as the first migration fix.

If this context conflicts with the repository, inspect the repository and resolve the difference first.

---

# 1. BRAINOS MISSION

BrainOS is a **private personal AI operating system**, not merely a chatbot.

North-star:

> BrainOS should become a private second brain and personal operating system that reduces cognitive load.

The long-term assistant should understand authorized context, remember useful information, retrieve knowledge, understand documents, manage tasks/time, use tools, automate appropriate workflows, communicate naturally, and provide proactive assistance while remaining secure, private, affordable, maintainable, and under user control.

---

# 2. CURRENT TECHNOLOGY STACK

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

AI:
- Ollama-first during development
- `qwen2.5:3b` chat model
- `nomic-embed-text` embedding model

Embeddings/database:
- Ollama
- pgvector
- 768-dimensional vectors

Other:
- Zod
- centralized errors
- centralized logger abstraction

Development environment:
```text
Windows
VS Code
Git/GitHub
Node.js
PostgreSQL
Prisma
Ollama
No dedicated GPU
Target development cost: approximately $0–$5/month where practical
```

**Supabase is NOT part of the current BrainOS architecture.**

---

# 3. VERIFIED IMPLEMENTATION HISTORY

Already complete; do not restart:

```text
Authenticated Semantic Memory — COMPLETE
Memory Production Hardening — COMPLETE
Memory Regression / Test DB Safety — COMPLETE
AI Assistant Integration / Orchestration — COMPLETE
Conversation + Persistent Context — COMPLETE

Document foundation — COMPLETE
Document API — COMPLETE
Document ingestion — COMPLETE
Document chunking — COMPLETE
Document chunk persistence — COMPLETE
Document embeddings — COMPLETE
Semantic document retrieval — COMPLETE
Assistant document retrieval context — COMPLETE
Automated document processing pipeline — COMPLETE

Task foundation — COMPLETE
Task repository/service — COMPLETE
Task assistant tools — COMPLETE
Task tool registration — COMPLETE
Assistant → real create_task execution verification — COMPLETE

Reminder repository/service — COMPLETE
Reminder scheduler — COMPLETE
Reminder worker — COMPLETE
Reminder delivery-provider boundary — COMPLETE

Automation API/backend engine — COMPLETE for implemented scope
Automation dashboard UI — COMPLETE for implemented scope
Automation CRUD — VERIFIED
Automation pause/resume — VERIFIED
Scheduled CREATE_TASK execution — VERIFIED
TASK_DUE → CREATE_TASK — VERIFIED
Future TASK_DUE behavior — VERIFIED
TASK_DUE duplicate protection — VERIFIED
Real Task creation from automation — VERIFIED
AutomationExecution success recording — VERIFIED
Recurring automation implementation/tests — VERIFIED
```

---

# 4. PHASE 20 — DOCUMENTS / KNOWLEDGE / RAG

## Current milestone

**Core document/RAG foundation is behaviorally verified.**

Completed:

```text
✓ Document Prisma foundation
✓ Document CRUD repository/service/API
✓ Authenticated owner-scoped document API
✓ Document content persistence
✓ TEXT ingestion / normalization
✓ URL extraction
✓ Plain-text upload ingestion
✓ PDF extraction
✓ PDF extraction tests / fixture
✓ Paragraph/sentence-aware document chunking
✓ DocumentChunk persistence
✓ 768-dimensional embedding persistence
✓ pgvector semantic search
✓ Document retrieval service
✓ POST /api/v1/documents/search
✓ Assistant document retrieval integration
✓ Document context assembly
✓ Automated document processing pipeline
✓ READY / FAILED lifecycle
✓ Main Assistant UI wired to document retrieval
✓ Full backend regression
✓ TypeScript validation
✓ Manual end-to-end RAG verification
```

## Document model

```text
Document
  id
  userId
  title
  sourceType
  source
  content
  mimeType
  status
  createdAt
  updatedAt
  deletedAt

DocumentChunk
  id
  documentId
  chunkIndex
  content
  embedding vector(768)
  createdAt
  updatedAt
```

Current pipeline status values:

```text
PENDING
READY
FAILED
DELETED
```

Use the actual Prisma schema as authoritative if this changes.

## Document processing

```text
Authenticated request
 ↓
Document Controller
 ↓
Document Service
 ↓
Ingestion / Extraction
 ↓
Normalized content
 ↓
Document Processing Pipeline
 ↓
Chunking
 ↓
DocumentChunk persistence
 ↓
Ollama embedding generation
 ↓
pgvector embedding persistence
 ↓
READY
```

Failure:

```text
processing failure → FAILED
```

Documents without content are created without running the processing pipeline.

## Semantic retrieval

```text
User query
 ↓
EmbeddingsService
 ↓
query vector
 ↓
DocumentChunkRepository.searchSimilar()
 ↓
owner-scoped pgvector similarity search
 ↓
ranked document chunks
```

## Assistant RAG

```text
Assistant message
 ↓
memory retrieval
 ↓
optional document retrieval
 ↓
context builder
 ↓
Relevant Memory Context
Relevant Document Context
 ↓
Ollama
 ↓
Answer
```

Document retrieval remains intentionally **opt-in** through `enableDocumentRetrieval`.

---

# 5. CURRENT RAG BEHAVIORAL PROOF

A document titled:

```text
BrainOS Architecture Test
```

was created containing BrainOS architecture information.

The normal Assistant UI was asked:

```text
According to my BrainOS Architecture Test document,
what does BrainOS use PostgreSQL for?
```

The Assistant answered:

```text
Based on the information provided in the test document,
BrainOS uses PostgreSQL with pgvector for semantic retrieval.
```

This verifies:

```text
Frontend
 ↓
Clerk authentication
 ↓
POST /api/v1/assistant/ask
 ↓
AssistantService
 ↓
DocumentRetrievalService
 ↓
Embedding generation
 ↓
pgvector semantic search
 ↓
Document context assembly
 ↓
Ollama
 ↓
Document-grounded answer
```

This is a real behavioral verification.

---

# 6. ASSISTANT ARCHITECTURE

Core orchestration:

```text
AssistantService
 ├── MemoryService
 ├── DocumentRetrievalService
 ├── ConversationRepository
 ├── MessageRepository
 ├── ToolExecutor
 └── LLMService
```

Tool path:

```text
LLM
 ↓
AssistantService
 ↓
ToolExecutor
 ↓
ToolRegistry
 ↓
Tool
 ↓
Domain Service
 ↓
Repository
 ↓
PostgreSQL
```

Authenticated ownership comes from:

```typescript
context.userId
```

The model/client does not choose the owner.

Tool execution is bounded by:

```text
MAX_TOOL_ROUNDS = 5
```

---

# 7. AUTHENTICATION / SECURITY

Authentication is provided by Clerk.

Backend flow:

```text
requireAuth
 ↓
getAuthenticatedUser
```

Never trust client-supplied `userId`.

Never log:

```text
Authorization headers
Clerk session IDs
tokens
secrets
private document content
```

High-impact actions require appropriate confirmation/authorization.

Proactive behavior must never become uncontrolled background autonomy.

---

# 8. DATABASE / MIGRATION RULES

Applied Prisma migrations are immutable.

Never:
```text
edit migration.sql
rename an applied migration
delete an applied migration
recreate an applied migration under another timestamp
```

Future schema change workflow:

```text
1. Check migration status.
2. Inspect git status.
3. Ensure applied migrations are untouched.
4. Change schema.prisma.
5. Create a NEW migration.
6. Validate.
7. Generate Prisma Client.
8. Typecheck.
9. Run tests.
10. Commit schema + migration together.
```

Previous checksum incident involved:

```text
20260810121955_add_memory_embedding
```

It was repaired by restoring the authoritative migration/checksum. Do not repeat the incident.

Relevant document migrations:

```text
20260824003625_add_document_foundation
20260824053010_add_document_content
20260824194956_add_document_chunks
20260824200957_add_document_chunk_embeddings
```

Relevant automation migrations:

```text
20260826162035_add_automation_foundation
20260826202241_add_automation_claim
```

---

# 9. LATEST VALIDATION

Latest full backend regression:

```text
Test Files: 37 passed (37)
Tests:      343 passed (343)
Failures:   0
```

Latest focused checks during the current document work included:

```text
document.ingestion.test.ts
document.processing.pipeline.test.ts
document-chunk-embedding-persistence.service.test.ts
document-retrieval.service.test.ts
document-chunk.repository.test.ts
```

Backend TypeScript:

```text
npx tsc --noEmit
PASS
```

Prisma:

```text
npx prisma validate
PASS
```

`npx prisma db pull` successfully connected to the development database at:

```text
localhost:5432
database: brainos_db
schema: public
```

Expected Prisma warning:

```text
DocumentChunk.embedding uses PostgreSQL vector
Memory.embedding uses PostgreSQL vector
```

This is expected with the current pgvector integration.

Vitest watch output:

```text
PASS — Waiting for file changes...
```

is normal.

---

# 10. CURRENT DEVELOPMENT SERVERS

Backend:

```text
http://localhost:3001
```

Verified:

```powershell
Invoke-RestMethod http://localhost:3001
```

returns:

```text
Welcome to BrainOS �
Your Personal AI Operating System
```

Frontend:

```text
apps/web
```

Current frontend environment keys exist for:

```text
BRAINOS_API_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

Do not put secret values into this context.

---

# 11. CURRENT FRONTEND ASSISTANT

Main Assistant page:

```text
apps/web/app/page.tsx
```

Current request includes:

```typescript
body: JSON.stringify({
  message: message.trim(),
  enableMemoryRetrieval: true,
  enableDocumentRetrieval: true,
})
```

The page:

- uses Clerk authentication
- obtains a token with `useAuth()`
- calls `/api/v1/assistant/ask`
- enables memory retrieval
- enables document retrieval
- displays the response
- handles loading/errors
- supports Enter-to-send

Document/RAG UI also supports document creation, listing, and semantic search.

---

# 12. ASSISTANT CONTROLLER / ROUTE

Route:

```text
POST /api/v1/assistant/ask
```

Route implementation is intentionally thin:

```typescript
router.post("/ask", requireAuth, askAssistant);
```

The controller already:

```text
reads enableDocumentRetrieval
validates it as boolean
reads documentSearchLimit
validates 1–20
passes both to AssistantService
```

Do not add retrieval business logic to the route/controller.

---

# 13. PHASE 19 STATUS

Phase 19 is complete for the currently implemented Tasks / Reminders / Automation scope.

Known limitation:

```text
No separate manual live multi-run recurring scheduler/database E2E
verification has been recorded.
```

Do not convert that limitation into a verified claim.

---

# 14. CURRENT GIT CHECKPOINT

Last explicitly verified clean repository state before the latest frontend RAG wiring:

```text
c740186 feat(assistant): improve document context assembly
```

Recent commits:

```text
c740186 feat(assistant): improve document context assembly
4a4eb6d feat(documents): include metadata in retrieval results
e358a6d feat(assistant): wire document retrieval
6275aff feat: complete recurring automation milestone
6a04c89 feat(web): add automation dashboard
```

At `c740186`:

```text
Branch: main
origin/main: c740186
Working tree: clean
```

After that checkpoint, the intended frontend change was:

```text
apps/web/app/page.tsx
```

to include:

```text
enableDocumentRetrieval: true
```

The latest full backend regression passed after this change:

```text
37 test files
343 tests
0 failures
```

However, **Git state after the latest frontend change has not yet been re-verified**.

Before committing/pushing:

```powershell
cd D:\Project\BrainOS

git status
git diff --stat
git diff --check
git log --oneline -10
git remote -v
```

Do not claim the latest frontend change is committed or pushed until verified.

---

# 15. NEXT PHASE 20 PRIORITIES

The core RAG path is proven. Do not immediately optimize everything.

Potential next milestones:

```text
1. Document metadata / source references
2. Citation/source references in Assistant responses
3. Retrieval thresholds
4. Context-size controls
5. Duplicate handling
6. Hybrid search
7. Reranking if justified
8. Better document management UI
9. Larger document/file workflows
10. Knowledge organization
```

Choose one small milestone at a time based on repository state and product value.

---

# 16. RAG QUALITY ROADMAP

Now that the end-to-end path is proven:

```text
document metadata
source references
citations
retrieval thresholds
hybrid search
context-size controls
duplicate handling
reranking if justified
```

Do not optimize retrieval without a concrete requirement.

---

# 17. COMPUTER AGENT ROADMAP

Computer control must remain a separate security boundary.

```text
BrainOS Assistant
       ↓
Action Authorization Layer
       ↓
Local Agent Gateway
       ↓
Windows BrainOS Agent
       ↓
OS / Apps / Files / Browser
```

Future milestones:

```text
1. Local agent process
2. Secure authenticated connection
3. Agent health/status
4. Read-only computer information
5. Open applications
6. Open/find files
7. Window/application control
8. Browser control
9. Safe file operations
10. Lock computer
11. Sensitive-action authorization
12. Device-bound capabilities
```

Computer unlock requires dedicated security design.

---

# 18. INTEGRATION ROADMAP

Use provider interfaces.

```text
CalendarProvider
 ├── Google Calendar
 └── Other supported provider(s)

EmailProvider
 ├── Gmail
 └── Other supported provider(s)

MessagingProvider
 ├── WhatsApp
 └── Other supported provider(s)
```

Do not tightly couple provider-specific logic to Assistant controllers.

---

# 19. VOICE ROADMAP

```text
User
 ↓
Speech-to-text
 ↓
BrainOS Assistant
 ↓
Memory / RAG / Tools
 ↓
Action / Response
 ↓
Text-to-speech
 ↓
Speaker
```

Add voice after the core text architecture is stable.

---

# 20. PROACTIVE ASSISTANT ROADMAP

Potential actions:

```text
notify
remind
summarize
suggest
create task
draft response
request confirmation
execute an authorized low-risk workflow
```

Proactive behavior must preserve user control and must not become uncontrolled autonomy.

---

# 21. PRODUCT SUCCESS CRITERIA

Eventually BrainOS should support:

```text
"Remember my project architecture."

"What did I decide about the database?"

"Read this document and tell me what matters."

"Plan my week around my classes and projects."

"Compare these options based on my priorities."

"Create a task to finish the assistant API."

"Remind me tomorrow at 9."

"Check my calendar and tell me if I have time."

"Draft a reply to this message."

"You have a deadline tomorrow and this related document has not been reviewed."

"That preference is likely important for future recommendations."
```

High-impact actions require appropriate confirmation/authorization.

---

# 22. DEVELOPMENT COMMANDS

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

TypeScript:

```powershell
cd D:\Project\BrainOSppsackend
npx tsc --noEmit
```

Full backend tests:

```powershell
cd D:\Project\BrainOSppsackend
npm test
```

Non-watch test command when available:

```powershell
npm run test:run
```

Focused test example:

```powershell
npm test -- --run test/documents/document.ingestion.test.ts
```

Prisma:

```powershell
cd D:\Project\BrainOSppsackend
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma studio
```

Web build:

```powershell
cd D:\Project\BrainOSpps\web
npm run build
```

Git:

```powershell
cd D:\Project\BrainOS
git status
git branch --show-current
git log --oneline -10
git diff
git diff --check
```

Push:

```powershell
git push origin main
```

Final verification:

```powershell
git status
git branch --show-current
git log --oneline -10
git remote -v
```

---

# 23. NON-BLOCKING WARNINGS

Expected/non-blocking:

```text
LF will be replaced by CRLF
```

```text
configLoader: 'native'
```

Prisma warning for PostgreSQL `vector` fields.

Next.js middleware deprecation warning:

```text
The "middleware" file convention is deprecated.
Please use "proxy" instead.
```

Do not change configuration merely to suppress non-blocking warnings without a scoped reason.

---

# 24. ENGINEERING ARCHITECTURE

Preferred layering:

```text
Transport / Controller
        ↓
Application Service
        ↓
Domain Service
        ↓
Repository / Provider Interface
        ↓
Database / External Provider
```

Rules:

```text
Controllers stay thin.
Prisma access stays in repositories.
Business rules stay in services.
External providers stay behind interfaces.
Tools call services.
Assistant orchestrates retrieval/tools.
Local computer agent is a separate security boundary.
```

---

# 25. SENIOR DEVELOPER WORKING STYLE

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
Run focused tests
 ↓
Fix actual errors
 ↓
Verify
 ↓
Run full regression
 ↓
Document
 ↓
Review Git diff
 ↓
Commit
 ↓
Push
 ↓
Verify final state
```

When an error is shown:

1. Read the actual error.
2. Identify the likely root cause.
3. Inspect relevant files.
4. Make the smallest correct fix.
5. Retest.
6. Verify.

Do not provide random destructive fix lists.

---

# 26. CURRENT ROADMAP

```text
Phase 14
Authenticated Semantic Memory — COMPLETE
        ↓
Phase 15
Memory Production Hardening — COMPLETE
        ↓
Phase 16
Memory Regression / Test DB Safety — COMPLETE
        ↓
Phase 17
AI Assistant Integration / Orchestration — COMPLETE
        ↓
Phase 18
Conversation + Persistent Context — COMPLETE
        ↓
Phase 19
Tasks / Reminders / Automation — COMPLETE for implemented scope
        ↓
Phase 20
Documents / Knowledge / RAG — CURRENT
        ↓
Computer Agent
        ↓
Calendar
        ↓
Email
        ↓
WhatsApp / Messaging
        ↓
Voice
        ↓
Proactive Assistant
        ↓
Advanced Agent Workflows
```

Re-evaluate after every milestone.

---

# 27. CURRENT STATE SUMMARY

BrainOS now has working foundations for:

```text
Identity
Authentication
User synchronization
PostgreSQL persistence
Prisma data access
Centralized errors
Centralized logging
Memory persistence
Local embeddings
pgvector retrieval
Ownership isolation
Conversation persistence
Assistant orchestration
Tool calling
Tasks
Reminders
Automation
Documents
Document ingestion
Document chunking
Document embeddings
Semantic document retrieval
Document RAG context
Ollama responses
```

The system now has a verified path:

```text
User
 ↓
Authenticated BrainOS UI
 ↓
Assistant
 ↓
Memory / Documents / Tools
 ↓
Ollama
 ↓
Response
```

---

# 28. MASTER NEW-CHAT INSTRUCTION

When this file is supplied in a new BrainOS chat, the user may say:

> "This is the BrainOS master context. Read it completely. Work as my senior developer. Before making any changes, inspect the actual repository and follow this context."

The assistant must:

1. read this context
2. identify the current phase
3. inspect the actual repository
4. inspect Git state
5. inspect relevant files
6. continue from the current milestone
7. never restart completed work
8. never assume historical state is still current
9. keep implementation, tests, documentation, and Git synchronized
10. distinguish verified facts from plans
11. verify behavior before declaring a milestone complete

---

# 29. FINAL PROJECT STATEMENT

BrainOS is being built to become a private personal AI operating system that:

- remembers
- understands
- retrieves
- reasons
- recommends
- organizes
- plans
- integrates
- communicates
- automates
- controls authorized computer actions
- eventually supports voice
- provides proactive assistance

The technical foundation is deliberately being built before broad autonomous behavior.

Ultimate mission:

> Build a private personal AI assistant that knows the user's authorized context, can remember and retrieve useful information, understand documents, manage tasks and time, assist with email and messaging, control the user's computer through a secure local agent, automate repetitive workflows, communicate naturally through text and voice, and provide proactive assistance — while remaining secure, private, modular, affordable, maintainable, and under the user's control.

# END OF BRAINOS MASTER PROJECT CONTEXT
