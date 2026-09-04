# BrainOS — MASTER PROJECT CONTEXT

## Single Source of Truth for Future Development Chats

**Project:** BrainOS
**Purpose:** Private Personal AI Operating System / Second Brain / AI Companion
**Repository:** `D:\Project\BrainOS`
**Branch:** `main`
**OS:** Windows
**Editor:** VS Code
**Current date checkpoint:** 2026-09-04
**Latest verified Git commit:** `49e7675 feat(ai): add OmniRoute provider routing`
**Working tree at latest user verification:** modified (unrelated unstaged edit in `apps/backend/test/tools/tool.executor.audit.test.ts`)
**Remote:** `origin/main` matched local `main` at `49e7675`

---

# 0. CRITICAL RULE FOR EVERY FUTURE CHAT

Before changing BrainOS:

1. Read this context completely.
2. Inspect the actual repository.
3. Run `git status` and `git log --oneline -10`.
4. Inspect the relevant existing files.
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

Never:
- restart completed work
- blindly overwrite working code
- bypass authentication or authorization
- trust client-supplied ownership IDs
- put Prisma access or business logic in controllers
- expose secrets, tokens, session IDs, authorization headers, or private content in logs
- claim planned work is implemented or verified
- edit an already-applied Prisma migration
- use `prisma migrate reset` as the first migration fix
- introduce a new technology without an architectural reason
- add features merely because they are popular

If this context conflicts with the repository, inspect the repository and resolve the difference first. The repository is the final authority for implemented behavior.

---

# 1. BRAINOS MISSION

BrainOS is a **private personal AI operating system**, not merely a chatbot.

The long-term goal is to build an AI assistant that understands the user's authorized context, remembers useful information, retrieves knowledge, reasons over information, manages tasks and time, understands documents, uses tools, automates appropriate work, communicates naturally, and eventually operates across the user's computer and mobile devices.

## North-star

> BrainOS should feel like an intelligent second person working alongside the user — while remaining clearly an AI, secure, private, controllable, and transparent.

The desired experience is:

> "I am not working alone. BrainOS understands what I am doing, talks with me naturally, remembers useful context, helps me make decisions, and can perform authorized tasks."

BrainOS should **not** become an uncontrolled autonomous system.

User control, authorization, privacy, security, and explainability remain core requirements.

---

# 2. PRODUCT VISION

## 2.1 Core intelligence loop

```text
User
 ↓
BrainOS Interface
 ↓
Understand intent
 ↓
Retrieve relevant context
 ├── Conversation
 ├── Memory
 ├── Documents / RAG
 └── Structured data
 ↓
Reason / plan
 ↓
Choose tool or action when required
 ↓
Authorization / safety check
 ↓
Execute
 ↓
Observe result
 ↓
Respond naturally
 ↓
Optionally remember useful information
```

## 2.2 Future companion experience

BrainOS should eventually support:

- natural conversation
- short conversational replies
- human-like voice interaction
- contextual follow-up
- proactive but controlled assistance
- task progress updates
- cross-device continuity
- persistent personal context
- authorized computer control
- authorized mobile actions
- documents and personal knowledge
- tasks, reminders, and automation
- calendar, email, and messaging integrations

BrainOS should not simply return long generated paragraphs for every interaction.

The assistant should be able to say:

```text
"Yep, doing it."

"Opening WhatsApp."

"I found the conversation."

"Typing it now."

"Done."
```

when short progress updates are more natural.

---

# 3. PRODUCT SCOPE PRINCIPLE

This is the first major BrainOS product.

The feature set described below is intentionally the **long-term product target**, not a requirement to implement everything at once.

Build in controlled milestones.

For every capability:

```text
Requirement
 ↓
Architecture
 ↓
Small implementation
 ↓
Focused tests
 ↓
Security review
 ↓
Behavioral verification
 ↓
Documentation
 ↓
Git checkpoint
```

Do not turn BrainOS into a collection of disconnected demos.

Every new capability should connect to the same BrainOS core.

---

# 4. CURRENT TECHNOLOGY STACK

## Frontend

- Next.js
- React
- TypeScript
- Clerk

## Backend

- Express
- TypeScript
- Prisma
- PostgreSQL

## Authentication

- Clerk

## AI

- Multi-provider abstraction (`LLMProvider` interface + `createLLMProvider()` factory)
- Configured via `LLM_PROVIDER` environment variable (`ollama` | `omniroute`)
- **Ollama**: Local development provider (`http://localhost:11434`, default `qwen2.5:3b`)
- **OmniRoute**: OpenAI-compatible gateway (`http://localhost:20128`, default model `BrainOS-Coding`) for high-performance agent reasoning and function calling
- Extensible to other OpenAI/Azure/Claude adapters without domain rewrites

## Embeddings

- Ollama
- `nomic-embed-text`
- pgvector
- 768-dimensional vectors

## Validation / errors / logging

- Zod
- centralized error handling
- centralized logger abstraction

## Development environment

```text
Windows
VS Code
Git/GitHub
Node.js
Docker
PostgreSQL
Prisma
Ollama
No dedicated GPU
```

## Cost constraint

Target development cost:

**approximately $0–$5/month where practical.**

Prefer existing Student Developer Pack resources where appropriate.

Do not add paid AI APIs merely for testing unless explicitly requested.

**Supabase is NOT part of the current BrainOS architecture.**

---

# 5. ENGINEERING PRINCIPLES

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
- least privilege
- auditable actions
- secure defaults

Avoid:

- quick hacks
- duplicated business logic
- giant controllers
- direct Prisma access from controllers
- unvalidated external input
- unnecessary abstractions
- secrets in Git
- tightly coupling the assistant to one AI provider
- uncontrolled autonomous actions

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

Controllers stay thin.

Prisma access stays in repositories.

Business rules stay in services.

External integrations stay behind provider interfaces.

Tools call services rather than embedding database/business logic.

---

# 6. AUTHENTICATION AND OWNERSHIP

Clerk owns authentication.

Conceptually:

```text
Clerk
 ↓
Bearer session
 ↓
Express authentication middleware
 ↓
Authenticated Clerk user
 ↓
BrainOS PostgreSQL User
```

BrainOS database identity and Clerk identity remain separate.

Never trust a client-supplied ownership ID.

Ownership must be derived from authenticated context.

All memory, documents, conversations, tasks, reminders, automations, devices, credentials, and future user resources must be owner-scoped.

---

# 7. SECURITY PRINCIPLES

Security is part of the product architecture, not an afterthought.

Requirements:

- least-privilege tools
- explicit authorization
- secure local-agent authentication
- device binding where appropriate
- fail-closed behavior
- auditability
- no plaintext credential exposure
- no credentials inside LLM prompts
- no secrets in logs
- no arbitrary remote device unlock
- sensitive actions require appropriate confirmation
- external integrations use authorized provider connections
- private data remains isolated per user

Sensitive actions include:

- unlocking devices
- sending messages automatically
- sending email
- deleting data
- destructive file operations
- changing accounts
- purchases/payments
- security settings
- account submissions

BrainOS must not bypass Windows security controls.

For credentials, prefer OS-secure storage such as Windows Credential Manager or equivalent secure mechanisms rather than storing raw passwords in the BrainOS database.

---

# 8. VERIFIED IMPLEMENTATION HISTORY

Already implemented and should not be restarted:

```text
Authenticated semantic memory — COMPLETE
Memory production hardening — COMPLETE
Memory regression / test database safety — COMPLETE
AI assistant integration / orchestration — COMPLETE
Conversation + persistent context — COMPLETE

Document foundation — COMPLETE
Document API — COMPLETE
Document ingestion — COMPLETE
Document chunking — COMPLETE
Document chunk persistence — COMPLETE
Document embeddings — COMPLETE
Semantic document retrieval — COMPLETE
Assistant document retrieval context — COMPLETE
Automated document processing pipeline — COMPLETE
Document retrieval similarity threshold verification — COMPLETE

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

Computer action authorization API — COMPLETE
Computer file operation security & limits — COMPLETE
Tool execution audit recording — COMPLETE
Assistant document search tool integration — COMPLETE
Assistant graceful tool error recovery — COMPLETE
Pluggable LLM provider abstraction & factory — COMPLETE
OmniRoute provider & BrainOS-Coding model routing — COMPLETE
```

---

# 9. CURRENT VERIFIED REPOSITORY CHECKPOINT

Latest user-verified Git state:

```text
Branch:
main

HEAD:
49e7675 feat(ai): add OmniRoute provider routing

origin/main:
49e7675 (synchronized)

Working tree:
modified (unrelated unstaged edit in apps/backend/test/tools/tool.executor.audit.test.ts)
```

Recent relevant commits:

```text
49e7675 feat(ai): add OmniRoute provider routing
1014923 feat(assistant): recover gracefully from tool errors
cbdb56a test(assistant): verify document search tool flow
34661de refactor(documents): reuse source reference type
c11c440 feat(tools): add document search tool
dd7bc3b feat(assistant): expose computer action authorization API
d27081d feat(assistant): pass authorized computer actions to tools
0acd488 feat(tools): add tool execution auditing
ef5db62 feat(computer): enforce action authorization
563319b feat(computer): enforce file operation limits
```

The latest verified checkpoint is clean and synchronized.

Do not assume this remains true after making changes. Re-run Git verification.

---

# 10. CURRENT DOCUMENT / RAG STATUS

The document/RAG foundation is complete for the current milestone.

Verified architecture:

```text
Document
 ↓
Ingestion / Extraction
 ↓
Normalized content
 ↓
Chunking
 ↓
DocumentChunk
 ↓
Ollama embedding
 ↓
pgvector
 ↓
Semantic retrieval
 ↓
Assistant context
 ↓
LLM
```

Retrieval is owner-scoped.

Current retrieval uses:

- authenticated user ID
- vector similarity
- similarity threshold
- result limit
- deleted-document filtering
- non-null embedding filtering

The current similarity threshold has been covered by tests.

Document retrieval is integrated into AssistantService through the centralized retrieval policy.

Current policy:

```text
memory:
  enabled by default unless explicitly disabled

documents:
  disabled by default unless explicitly enabled
```

Document retrieval should not become permanently always-on without an explicit performance/product decision.

---

# 11. CURRENT ASSISTANT ARCHITECTURE

Current orchestration:

```text
Assistant API
 ↓
AssistantService
 ↓
Retrieval Policy
 ├── Memory
 └── Documents
 ↓
Conversation Context
 ↓
Context Builder
 ↓
LLMService
 ↓
createLLMProvider() Factory
 ├── OllamaLLMProvider (Ollama local /api/chat)
 └── OmniRouteLLMProvider (OpenAI-compatible /v1/chat/completions + BrainOS-Coding)
 ↓
Tool Executor (with audit logging & authorization enforcement)
 ↓
Tool Registry
 ↓
Domain Services
```

Current tool example:

```text
create_task
 ↓
TaskService
 ↓
TaskRepository
 ↓
PostgreSQL
```

The assistant remains provider-independent.

---

# 12. TESTING / VALIDATION STATUS

Recent verified backend validation includes:

```text
Backend TypeScript build:
PASS

AI provider factory dynamic resolution tests:
PASS (test/ai/provider.factory.test.ts)

OmniRoute provider & tool-calling tests:
PASS (test/ai/omniroute.provider.test.ts)

OmniRoute client URL normalization & secret redaction tests:
PASS (test/ai/omniroute.client.test.ts)

Document retrieval service & search tool tests:
PASS

Assistant context & tool recovery tests:
PASS

Full backend test suite:
PASS (52 test files, 424 passed)
```

A successful TypeScript build does not replace behavioral testing.

Known non-blocking warnings may include:

```text
Vite configLoader: 'native'
LF/CRLF conversion warnings on Windows
Prisma warnings for unsupported PostgreSQL vector fields
Next.js middleware/proxy migration warning
```

Do not change configuration merely to silence warnings unless there is a concrete reason.

---

# 13. PRODUCT EXPERIENCE — PERSONAL AI COMPANION

The long-term BrainOS experience should feel like an intelligent companion working alongside the user.

The user may say:

```text
"Hi BrainOS."

"How are you?"

"What are we working on today?"

"I'm going to take a break."

"Keep an eye on the laptop."

"Search this for me."

"Send him a message."

"Call this person."

"Open WhatsApp."

"Check this document."

"What do I need to do today?"
```

BrainOS should understand conversational language rather than requiring rigid commands.

It should maintain context across turns and devices where authorized.

---

# 14. VOICE EXPERIENCE

Voice should eventually be a first-class interface.

Architecture:

```text
Microphone
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

Voice is an interface, not a separate assistant brain.

The same:

- authentication
- retrieval
- orchestration
- authorization
- tools
- safety rules

must apply to voice requests.

Future voice behavior:

- natural conversational voice
- fast responses
- short replies when appropriate
- conversational interruption handling
- contextual follow-up
- spoken progress updates
- optional proactive speech
- configurable voice/personality

Potential providers may be evaluated later based on cost, quality, privacy, latency, and platform support.

Do not couple business logic to a voice vendor.

---

# 15. FUTURE COMPUTER AGENT

Computer control is a major future capability, but it must remain a separate security boundary.

Architecture:

```text
BrainOS Assistant
       ↓
Action Authorization Layer
       ↓
Authenticated Local Agent Gateway
       ↓
Windows BrainOS Agent
       ↓
OS / Apps / Files / Browser
```

Initial milestones:

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

Computer unlock is intentionally later.

It requires dedicated security architecture and must not bypass Windows security.

---

# 16. COMPUTER TASK VISUALIZATION

A major product requirement is that BrainOS should **show what it is doing**.

The user should not have to guess whether BrainOS actually performed an action.

Example:

```text
BRAINOS

● LISTENING

User:
"Open WhatsApp and message Ali."

BrainOS:
UNDERSTANDING
        ↓
PLANNING
        ↓
OPENING WHATSAPP
        ↓
FINDING CONVERSATION
        ↓
TYPING MESSAGE
        ↓
READY TO SEND
```

The actual application interaction should also be visible where technically possible.

For example:

```text
WhatsApp opens
 ↓
conversation opens
 ↓
message is typed
 ↓
send action occurs after authorization
```

For sensitive side effects, BrainOS should show the intended action and request confirmation when required.

---

# 17. FUTURE COMPUTER OPERATIONS

Eventually BrainOS may support authorized:

- opening applications
- closing applications
- finding files
- creating files
- reading authorized local content
- organizing files
- moving/renaming files
- browser navigation
- web searching
- form filling
- downloading files
- window control
- system information
- locking the computer
- launching predefined workflows

Consequential actions such as:

- purchases
- account changes
- submissions
- destructive operations
- sending external communications

require appropriate confirmation/authorization.

---

# 18. FUTURE LAPTOP GUARD MODE

The user described a future mode similar to:

> "I'm going away. Take care of the laptop."

This should become an explicit **Guard Mode**, not uncontrolled surveillance.

Possible future capabilities:

```text
Guard Mode
 ↓
authorized device monitoring
 ↓
detect configured computer interaction
 ↓
record security event
 ↓
notify user
```

Optional security-image capture may be considered later, but only with:

- explicit user opt-in
- visible/clear configuration
- limited capture behavior
- secure storage
- configurable retention
- privacy controls

BrainOS should never silently become a surveillance system.

---

# 19. DEVICE PRESENCE / RETURN EXPERIENCE

Future BrainOS may use authorized device signals to determine that the user has returned.

Possible signals:

- local device presence
- Bluetooth
- phone proximity
- camera presence detection
- OS activity

Possible experience:

```text
User returns

BrainOS:
"Welcome back."

"I finished the research."

"One thing needs your attention."
```

This must be opt-in and privacy-controlled.

---

# 20. CROSS-DEVICE BRAINOS

BrainOS should eventually exist on:

```text
Desktop / Windows
        +
Mobile
        +
BrainOS Cloud / Backend
```

Conceptually:

```text
                 BRAINOS CORE
                      │
          ┌───────────┴───────────┐
          │                       │
       Desktop                  Mobile
        Agent                    App
          │                       │
          └───────────┬───────────┘
                      │
                BrainOS Backend
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    Memory         Knowledge       Tools
```

The same user identity and authorized context should work across devices.

Example:

```text
Phone:
"Remember that I need to finish the database architecture tonight."

Laptop:
"You wanted to finish the database architecture today.
Want to continue?"
```

---

# 21. MULTI-USER / COMMERCIAL FUTURE

The first product should be useful for one primary user.

However, the architecture should remain capable of becoming a commercial product later.

Future SaaS requirements:

```text
User
 ↓
Authentication
 ↓
Personal BrainOS workspace
 ↓
Conversations
Memory
Documents
Tasks
Devices
Tools
Preferences
```

Each user's resources must remain isolated.

Future commercial capabilities may include:

- multiple users
- account management
- subscription/billing
- usage limits
- device management
- provider configuration
- workspace settings

Do not build billing or complex enterprise RBAC prematurely.

---

# 22. PROVIDER INDEPENDENCE

BrainOS does not permanently depend on one AI provider.

Implemented provider architecture:

```text
BrainOS AI Service (LLMService)
        ↓
createLLMProvider(provider = env.LLM_PROVIDER)
        ↓
LLMProvider Interface (generate(input))
        ├── OllamaLLMProvider (local /api/chat)
        ├── OmniRouteLLMProvider (OpenAI-compatible /v1/chat/completions + BrainOS-Coding model)
        └── Future provider adapters (Azure, Claude, etc.)
```

The assistant, memory, document, task, computer agent, and tool layers interact strictly through the unified `LLMProvider` contract and require zero changes when switching models or providers.

OmniRoute acts as a flexible OpenAI-compatible routing and gateway layer, enabling BrainOS to leverage specialized models such as `BrainOS-Coding` for complex agentic workflows and tool execution while keeping local development seamless with Ollama.

---

# 23. EXTERNAL INTEGRATION ROADMAP

Use provider interfaces.

## Calendar

```text
CalendarProvider
 ├── Google Calendar
 └── Other supported provider(s)
```

Future capabilities:

- read events
- create events
- update events
- cancel events
- detect conflicts
- availability-aware planning
- combine tasks and calendar

## Email

```text
EmailProvider
 ├── Gmail
 └── Other supported provider(s)
```

Future capabilities:

- search
- summarize
- detect important messages
- draft replies
- follow-up tasks
- reminders
- authorized sending

## Messaging

```text
MessagingProvider
 ├── WhatsApp
 └── Other supported provider(s)
```

Future capabilities:

- read authorized messages
- summarize conversations
- identify attention-needed messages
- draft replies
- authorized sending
- task/reminder creation

BrainOS must not silently impersonate the user.

---

# 24. PROACTIVE ASSISTANT

BrainOS should eventually become proactive without becoming annoying or uncontrolled.

Potential signals:

- task deadlines
- reminders
- calendar events
- email
- messages
- document processing
- recurring routines
- explicit user rules

Potential actions:

```text
notify
remind
summarize
suggest
create task
draft response
request confirmation
execute authorized low-risk workflow
```

Proactive behavior must be:

- configurable
- explainable
- privacy-preserving
- rate-limited
- user-controlled
- based on reliable signals

Never use proactive behavior as an excuse for unrestricted background autonomy.

---

# 25. PERSONALITY / CONVERSATION LAYER

BrainOS should eventually have a configurable personality layer controlling:

- tone
- response length
- voice style
- familiarity
- humor
- progress updates
- proactive communication
- interaction pacing

The assistant should adapt to the user's conversational style.

Human-like interaction does **not** mean pretending BrainOS is human.

BrainOS should remain transparent that it is an AI system.

---

# 26. TASK / AUTOMATION FUTURE

Current Tasks / Reminders / Automation foundations are verified for the implemented scope.

Future enhancements may include:

```text
recurring reminders
richer conditions
advanced workflow composition
retry policies
advanced idempotency
richer execution history
additional triggers/actions
timezone-aware recurrence
missed-schedule policies
proactive workflows
```

Do not reopen completed milestones without a concrete requirement.

---

# 27. RAG / KNOWLEDGE FUTURE

The current document/RAG path is proven.

Future quality improvements can include:

```text
document metadata
source references
citations
retrieval thresholds
hybrid search
context-size controls
duplicate handling
reranking if justified
knowledge organization
```

Do not optimize retrieval merely because optimization is possible.

Every optimization needs a measurable requirement.

---

# 28. DATA MODEL PRINCIPLES

Keep these concepts separate:

```text
Source documents
        �
Extracted content
        �
Semantic chunks
        �
Personal memories
        �
Structured application data
```

Do not automatically turn every document into permanent memory.

Use relational columns for structured facts.

Use vectors for semantic retrieval.

---

# 29. CURRENT ROADMAP

```text
Foundation
    ↓
Authenticated Memory
    ↓
AI Orchestration
    ↓
Conversation + Persistent Context
    ↓
Tasks
    ↓
Reminders
    ↓
Automation
    ↓
Documents / RAG
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
Cross-device Companion
    ↓
Advanced Agent Workflows
    ↓
Multi-user / Commercial Product
```

These are directional product milestones.

They are not a promise that every feature will be implemented immediately or in exactly this order.

The next milestone must always be selected after inspecting the actual repository.

---

# 30. DEFINITION OF DONE

A feature is not complete because code exists or TypeScript compiles.

```text
Requirements
 ↓
Architecture
 ↓
Implementation
 ↓
Focused tests
 ↓
TypeScript
 ↓
Behavioral testing
 ↓
Security verification
 ↓
Full regression when appropriate
 ↓
Documentation/context
 ↓
Git review
 ↓
Commit
 ↓
Push
 ↓
Final Git verification
```

Completion claims must be based on actual evidence.

---

# 31. DATABASE / MIGRATION RULES

Once a Prisma migration is applied:

```text
DO NOT edit migration.sql
DO NOT rename migration directory
DO NOT delete applied migrations
DO NOT recreate an applied migration under another timestamp
```

For schema changes:

```text
1. Check migration status.
2. Check Git status.
3. Inspect current schema.
4. Change schema.prisma.
5. Create a NEW migration.
6. Validate.
7. Generate Prisma Client.
8. Typecheck.
9. Run tests.
10. Verify behavior.
11. Commit schema + migration together.
```

Do not use `prisma migrate reset` as the first response to migration problems.

---

# 32. IMPORTANT DEVELOPMENT COMMANDS

Repository:

```powershell
cd D:\Project\BrainOS
```

Git:

```powershell
git status
git branch --show-current
git log --oneline -10
git diff
git diff --check
```

Backend:

```powershell
cd D:\Project\BrainOS\apps\backend
npm run dev
npm test
npm run build
```

Focused test:

```powershell
npm test -- --run <test-file>
```

Frontend:

```powershell
cd D:\Project\BrainOS\apps\web
npm run dev
npm run build
```

Prisma:

```powershell
cd D:\Project\BrainOS\apps\backend
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma studio
```

Push:

```powershell
cd D:\Project\BrainOS
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

# 33. SENIOR DEVELOPER WORKING STYLE

The assistant is the senior developer and architect for BrainOS.

Expected behavior:

- challenge weak architectural choices
- protect working features
- inspect before changing
- use repository evidence
- troubleshoot root causes
- prefer the smallest correct change
- distinguish verified facts from assumptions
- avoid unnecessary rewrites
- keep tests and documentation synchronized

When an error is shown:

1. Read the actual error.
2. Identify the likely root cause.
3. Inspect relevant files.
4. Make the smallest correct fix.
5. Retest.
6. Verify.

When asking the user to edit a file:

- exact path
- exact replacement or edit
- exact command
- exact working directory
- expected output

Do not give random destructive fix lists.

---

# 34. MASTER NEW-CHAT INSTRUCTION

When this file is supplied to a new BrainOS chat, the user may say:

> "This is the BrainOS master context. Read it completely. Work as my senior developer. Before making any changes, inspect the actual repository and follow this context."

The assistant must:

1. read the context
2. identify the current milestone
3. inspect the actual repository
4. inspect Git state
5. inspect relevant files
6. continue from the current milestone
7. never restart completed work
8. never assume historical state is still current
9. keep implementation, tests, documentation, and Git synchronized
10. distinguish verified facts from plans
11. verify actual behavior before declaring completion

---

# 35. CURRENT DEVELOPMENT CHECKPOINT

```text
Date:
2026-09-04

Current product state:
Core BrainOS foundation + Tasks/Reminders/Automation + Documents/RAG foundation + Computer Action Authorization/Audit + Provider-independent LLM Architecture (Ollama & OmniRoute with BrainOS-Coding) verified.

Latest Git checkpoint:
49e7675 feat(ai): add OmniRoute provider routing

Branch:
main

Working tree:
modified (unrelated unstaged edit in apps/backend/test/tools/tool.executor.audit.test.ts)

Remote:
origin/main synchronized at 49e7675
```

The immediate next development direction is **not to rebuild existing foundations**.

The product should now move toward the next layer of the BrainOS experience:

```text
BrainOS Core
    ↓
Agent Runtime / Action Authorization
    ↓
Local Computer Agent
    ↓
Visual Task Execution
    ↓
Voice Interface
    ↓
Mobile Companion
    ↓
Proactive Cross-device Assistance
```

Before choosing the exact next implementation milestone, inspect the repository and define a focused acceptance criterion.

---

# 36. FINAL PROJECT STATEMENT

BrainOS is being built to become a private personal AI operating system that:

- remembers
- understands
- retrieves
- reasons
- recommends
- organizes
- plans
- communicates naturally
- uses tools
- automates appropriate workflows
- understands documents
- controls authorized computer actions
- eventually works across desktop and mobile
- eventually supports natural voice
- eventually provides proactive assistance
- eventually supports multiple users as a commercial product

The technical foundation is deliberately being built before broad autonomy.

The product must remain:

```text
Private
Secure
User-controlled
Provider-independent
Modular
Affordable
Maintainable
Observable
Testable
```

## Ultimate mission

> Build a personal AI companion that feels like an intelligent second person working alongside the user: it understands context, remembers useful information, communicates naturally, can perform authorized tasks on the user's devices, shows what it is doing, helps manage work and life, and proactively assists when appropriate — while never taking control away from the user.

# END OF BRAINOS MASTER PROJECT CONTEXT
