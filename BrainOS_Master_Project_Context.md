# BrainOS — MASTER PROJECT CONTEXT

## Single Source of Truth for Future Development Chats

**Project:** BrainOS
**Purpose:** Private Personal AI Operating System / Second Brain / AI Companion
**Repository:** `D:\Project\BrainOS`
**Branch:** `main`
**OS:** Windows
**Editor:** VS Code
**Current date checkpoint:** 2026-09-04
**Latest verified Git commit:** `debd156 feat(computer): add agent persistence and lifecycle`
**Working tree at latest user verification:** clean
**Remote:** `origin/main` matched local `main` at `debd156`

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


---

# 37. ADDITIVE UPDATE — COMPUTER AGENT AUTHENTICATION & CURRENT CHECKPOINT

**Updated:** 2026-09-04

This section is an additive update to the original BrainOS context. It does **not** replace or remove the earlier product vision, roadmap, architectural history, or completed milestones.

## Computer Agent dependency injection — COMPLETE

Computer tools were refactored so they no longer construct the concrete local agent directly.

Composition now follows:

```text
ToolContainer
    ↓
ComputerAgentGateway
    ↓
ComputerAgent
```

`createToolRegistry()` accepts an optional `ComputerAgentGateway`.

The default composition remains:

```text
ComputerAgentGateway(new LocalComputerAgent())
```

This keeps the tool layer testable and prevents concrete-agent coupling.

Commit:

```text
775421a refactor(computer): inject agent gateway into tools
```

## Computer Agent Authentication Contract — COMPLETE

A transport-independent authentication contract has now been implemented.

Files:

```text
apps/backend/src/services/computer/security/computer-agent-auth.service.ts
apps/backend/src/services/computer/security/computer-agent-auth.types.ts
apps/backend/test/security/computer-agent-auth.test.ts
```

The contract provides:

- cryptographically random credentials using Node `crypto`
- 32-byte default credentials
- minimum 16-byte generation guard
- `scrypt` hashing
- random salt
- timing-safe comparison
- fail-closed malformed input handling
- injectable credential storage
- in-memory storage for local/test execution
- agent ID preservation
- no raw credential persistence
- no raw credential logging

Core contracts:

```text
ComputerAgentCredentials
StoredAgentCredential
ComputerAgentAuthResult
ComputerAgentCredentialStore
```

The authentication service currently supports:

```text
registerAgent(agentId)
registerAgentHash(agentId, credentialHash)
authenticate({ agentId, credential })
authenticate(agentId, credential)
```

Raw credentials are generated/returned during registration but only the hash is stored.

The implementation intentionally does **not** introduce:

```text
HTTP
WebSocket
JWT
database persistence
pairing protocol
new computer capabilities
```

Those belong to later lifecycle/transport milestones.

## Security review observations

The implementation was reviewed and accepted for the current milestone.

Known non-blocking observations:

1. `scryptSync()` is synchronous and can block the Node event loop. This is acceptable for the current local/low-volume contract. Revisit if remote/high-frequency authentication is introduced.
2. The current authentication result distinguishes `"Unknown agent ID"` from `"Invalid credentials"`. If a remote transport is later introduced, the externally visible failure response may need to become generic to reduce agent-ID enumeration while internal audit logging can remain specific.

These observations do not require changes to the completed milestone.

## Validation completed

Computer Agent Authentication Contract:

```text
Focused authentication tests:
11/11 PASS

Existing computer tests:
29/29 PASS

Full backend regression:
57/57 test files PASS
514/514 tests PASS

Backend TypeScript:
PASS

git diff --cached --check:
PASS
```

The root repository `npm test` remains a placeholder and does not run the backend suite.

Correct backend regression command:

```powershell
cd D:\Project\BrainOS\apps\backend
npm test -- --run
```

## Latest Git checkpoint

The authentication milestone was committed and pushed.

```text
e728986 feat(computer): add agent authentication contract
775421a refactor(computer): inject agent gateway into tools
3c6e70c feat(reminders): add reminders REST API
```

Latest verified state:

```text
Branch:
main

HEAD:
e728986

origin/main:
e728986

Working tree:
clean
```

## Next milestone — Agent Registration & Trust Lifecycle

The next milestone is **design first, implementation second**.

Do not immediately add Prisma, HTTP, WebSocket, or pairing code.

First define:

### Registration authority

Only an authenticated BrainOS user should be able to register an agent for that user.

Never trust a client-supplied arbitrary `userId` for ownership.

### Agent ownership

The future trusted-agent model should associate a computer agent with exactly one BrainOS user.

Conceptually:

```text
User
  1
  │
  └──────< ComputerAgent
```

The exact Prisma model should be designed only after the lifecycle contract is clear.

### Initial credential delivery

Define how the first credential is securely delivered to the local agent.

Do not place a permanent credential in:

```text
source code
Git
logs
normal URLs
LLM prompts
unsafe browser storage
```

Prefer secure OS credential storage for long-lived local credentials, such as Windows Credential Manager or an equivalent secure mechanism.

### Trust state

Design the lifecycle states before implementation. The final names may differ, but the lifecycle needs to represent concepts such as:

```text
registered
trusted / active
revoked
```

### Revocation

The owner must be able to revoke an agent.

After revocation:

```text
future authentication → FAIL
```

Revocation must be owner-scoped and fail closed.

### Identity separation

Keep these three concepts separate:

```text
Clerk User Identity
        ≠
Computer Agent Identity
        ≠
Agent Credential
```

Clerk authenticates the BrainOS user.

The agent credential authenticates the computer agent.

Ownership connects the agent to the user but does not make the agent a Clerk session.

## Target architecture after trust lifecycle

```text
Browser / Clerk
      ↓
BrainOS Backend
      ↓
Authenticated User
      ↓
Agent Registration / Ownership
      ↓
Credential Issuance
      ↓
Trusted Local Agent
      ↓
Agent Authentication
      ↓
ComputerAgentGateway
      ↓
Authorized Computer Actions
```

Revocation:

```text
User
 ↓
Revoke Agent
 ↓
Agent trust disabled
 ↓
Future authentication fails
```

Do not implement HTTP/WebSocket transport until this lifecycle is defined and accepted.

---

# 38. ADDITIVE UPDATE — COMPUTER AGENT PERSISTENCE & TRUST LIFECYCLE

**Updated:** 2026-09-05

This section is an additive update to the original BrainOS context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Computer Agent Persistence — COMPLETE

Computer Agent identity and credential persistence have now been added to the BrainOS Prisma/PostgreSQL architecture.

The persistence model is:

```text
User
  └── ComputerAgent
        └── ComputerAgentCredential
        ---

# 39. ADDITIVE UPDATE — COMPUTER AGENT HTTP TRANSPORT

**Updated:** 2026-09-05

This section is an additive update to the BrainOS context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Computer Agent HTTP Transport — COMPLETE

A secure HTTP ingress layer for Computer Agents has now been implemented and verified.

The transport is deliberately limited to:

```text
HTTP Ingress
    ↓
Agent Credential Authentication
    ↓
Protocol Envelope Validation
    ↓
Agent Identity Verification
    ↓
Timestamp Validation
    ↓
Replay Protection
    ↓
Safe Protocol Acknowledgement
```

---

# 40. ADDITIVE UPDATE — COMPUTER AGENT ACTION AUTHORIZATION & DISPATCH CONTRACT

**Updated:** 2026-09-05

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Computer Agent Action Authorization & Dispatch Contract — COMPLETE

A transport-independent action authorization and dispatch contract has now been implemented and verified for the BrainOS Computer Agent subsystem.

### Architectural flow

```text
Action Request (with Correlation ID)
         ↓
Input & Envelope Validation
         ↓
Action Name Resolution (Typed ComputerActionName)
         ↓
Server-Derived Context (agentId + persisted owner userId)
         ↓
Policy Check (Safe Read-only vs Privileged Action)
         ↓
Trusted Permission Provider Evaluation (Server-side grants only)
         ├── If Unauthorized → Record Tool Audit Event & Return Error (Fail-Closed)
         └── If Authorized →
                   ↓
         Injectable Action Handler Execution (Handler called ONLY after authorization)
                   ↓
         Action Response (Mirrors Correlation ID & Typed Data / Protocol Error)
```

### Core contracts & implementation files

```text
apps/backend/src/services/computer/dispatch/computer-agent-dispatch.types.ts
apps/backend/src/services/computer/dispatch/computer-agent-action-authorizer.ts
apps/backend/src/services/computer/dispatch/computer-agent-action-dispatcher.ts
apps/backend/src/services/computer/dispatch/index.ts
apps/backend/test/services/computer/dispatch/computer-agent-dispatch.test.ts
```

### Key architectural and security guarantees

1. **Strongly-Typed Action Names**:
   - Supported actions are codified in `ComputerActionName`:
     - `computer_get_status`
     - `computer_list_applications`
     - `computer_list_files`
     - `computer_read_file`
     - `computer_launch_application`
     - `computer_write_file`
   - Validated via `ALL_COMPUTER_ACTION_NAMES` and `isComputerActionName()`.
   - Directly maps to registered computer tools in `computer-action.policy.ts`.

2. **Server-Derived Security Context (`ComputerAgentActionContext`)**:
   - `agentId` is verified strictly via authenticated credentials.
   - `userId` is strictly server-derived from the persisted agent owner record.
   - The context strictly forbids client-supplied permissions or grant overrides.

3. **Trusted Server-Side Permission Provider (`ComputerActionPermissionProvider`)**:
   - Privileged permissions are evaluated exclusively via trusted server-side sources (`InMemoryComputerActionPermissionProvider` implementing `isActionPermitted(action, context)`).
   - Grants support agent-scoped (`agentId`) and compound owner-agent (`userId:agentId`) granularity.
   - Client requests cannot self-grant or elevate privileges.

4. **Fail-Closed Privileged Authorization (`ComputerAgentActionAuthorizer`)**:
   - Fails closed if `userId` or `agentId` is missing, blank, or malformed (`ProtocolErrorCode.UNAUTHORIZED`).
   - Fails closed on unknown or unmapped action names (`ProtocolErrorCode.ACTION_FAILED`).
   - Preserves established security policy:
     - Safe read-only actions (`computer_get_status`, `computer_list_applications`, `computer_list_files`, `computer_read_file`) are automatically authorized for authenticated agents (`authorizationRequired: false`).
     - State-modifying / high-risk actions (`computer_launch_application`, `computer_write_file`) require explicit server grants (`authorizationRequired: true`). Unauthorized attempts fail closed.

5. **Audit Logging Integration**:
   - Unauthorized privileged action attempts are recorded synchronously to `ToolAuditService` matching `ToolExecutor` invariants (`toolName`, `userId`, `outcome: "UNAUTHORIZED"`, `durationMs`, `computerTool: true`, `authorizationRequired: true`, error).

6. **Transport-Independent Dispatch Contract (`DefaultComputerAgentActionDispatcher`)**:
   - Structured request envelope (`ComputerActionRequest`) carrying required `correlationId`, `action`, optional `params`, and `timestamp`.
   - Structured response envelope (`ComputerActionResponse`) mirroring `correlationId`, `action`, `success`, `timestamp`, `data` (on success), or `error` (`ComputerAgentProtocolError` on failure).
   - Structured error handling via `ComputerAgentActionException` extending `AppError`.
   - Helper constructors: `createActionRequest()`, `createActionSuccessResponse()`, `createActionErrorResponse()`, `generateCorrelationId()`.

7. **Strict Authorization Order & Handler Boundary**:
   - **Authorization ALWAYS executes before handler invocation**: Handlers are never called if authorization fails.
   - Supports pluggable, injectable `ComputerActionHandler` for testing and future execution bindings.
   - Default dispatcher fails closed when no handler is bound without executing OS actions.

8. **Milestone Boundaries & Security Invariants**:
   - **No OS / LocalComputerAgent / Gateway execution**: No live OS processes, shells, or filesystem side-effects are connected in this milestone.
   - **No HTTP changes**: Existing HTTP routes and controllers remain untouched.
   - Security tests specifically verify that client request bodies cannot self-grant permissions.

### Verification completed

```text
Dispatch Contract Tests:
test/services/computer/dispatch/computer-agent-dispatch.test.ts
20/20 PASS

Full Computer Agent Subsystem Suites:
184/184 PASS (9 test files)
- computer-agent-dispatch.test.ts (20/20 PASS)
- computer-agent-http-transport.test.ts (28/28 PASS)
- computer-agent-protocol.test.ts (20/20 PASS)
- computer-agent.api.test.ts (26/26 PASS)
- computer-agent.service.test.ts (29/29 PASS)
- computer-agent.repository.test.ts (22/22 PASS)
- computer-agent-auth.test.ts (11/11 PASS)
- computer.tools.test.ts (21/21 PASS)
- computer-agent.tool.test.ts (7/7 PASS)

TypeScript Compilation:
npm run build (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)
```

### Latest Git checkpoint

```text
7131e03 feat(computer): add action authorization and dispatch contract
5dbb858 feat(computer): add agent HTTP transport
9ff1c18 feat(computer): add agent protocol contract
debd156 feat(computer): add agent persistence and lifecycle
e728986 feat(computer): add agent authentication contract
```

Verified state:

```text
Branch: main
HEAD: 7131e03
origin/main: 7131e03 (synchronized)
Working tree: clean (context update pending)
```

### Explicitly deferred work

The following items are intentionally deferred to future milestones:

1. **Live Action Execution**: Implementing and binding concrete OS execution handlers (process spawning, window management, filesystem operations) to `ComputerActionHandler`.
2. **Gateway Connection**: Connecting `ComputerAgentGateway` and `LocalComputerAgent` to the dispatch pipeline.
3. **Persistent Permission Storage**: Moving beyond in-memory permission evaluation to database-backed persistent permission tables / RBAC in Prisma.
4. **Remote Agent Authorization Policy**: Dynamic policy negotiation and authorization delegation for multi-device / remote-agent configurations.
5. **HTTP / WebSocket Dispatch Ingress**: Exposing action dispatch over authenticated transport endpoints.

---

# 42. ADDITIVE UPDATE — COMPUTER AGENT PERSISTENT ACTION PERMISSIONS

**Updated:** 2026-09-05

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Computer Agent Persistent Action Permissions — COMPLETE

Persistent, database-backed action authorization has now been implemented and verified for the BrainOS Computer Agent subsystem.

### Architectural flow & Permission Evaluation

```text
Action Request
      ↓
Server-Derived Context (agentId + verified owner userId)
      ↓
Action Policy Evaluation (computer-action.policy.ts)
      ├── If Safe Read-Only Action (e.g. computer_get_status, computer_read_file, computer_list_files, computer_list_applications)
      │     └── Policy-Authorized (No DB row required, authorizationRequired: false)
      │           ↓
      │     Proceed to Dispatch / Handler
      │
      └── If Privileged Action (computer_write_file, computer_launch_application)
            └── Server-Side Database Evaluation (PrismaComputerActionPermissionProvider)
                  ↓
            Query Active Permission in PostgreSQL (ComputerAgentPermission where deletedAt IS NULL)
                  ├── If Active Grant Exists → Authorized (authorizationRequired: true) → Handler Execution
                  ├── If No Grant / Soft-Deleted → Unauthorized (Fail-Closed, Tool Audit Logged)
                  └── If Invalid Identity / Action / DB Error → Unauthorized (Fail-Closed)
```

### Core models, contracts & implementation files

```text
apps/backend/prisma/schema.prisma (ComputerAgentPermission model & partial unique index)
apps/backend/prisma/migrations/20260905115400_add_computer_agent_permissions/migration.sql
apps/backend/src/services/computer/repositories/computer-agent-permission.repository.ts
apps/backend/src/services/computer/dispatch/prisma-computer-action-permission-provider.ts
apps/backend/src/services/computer/computer-agent.service.ts (grantPermission, revokePermission, listPermissions)
apps/backend/src/services/computer/computer-agent.types.ts
apps/backend/test/services/computer/repositories/computer-agent-permission.repository.test.ts
apps/backend/test/services/computer/dispatch/prisma-computer-action-permission-provider.test.ts
apps/backend/test/services/computer/computer-agent.service.test.ts
```

### Key architectural and security guarantees

1. **Persistent PostgreSQL `ComputerAgentPermission` Model**:
   - Stored in PostgreSQL with relational linkage to `ComputerAgent`:
     - `id` (cuid primary key)
     - `agentId` (foreign key to `ComputerAgent.id` with onDelete: Restrict)
     - `action` (string representing privileged action name)
     - `createdAt`, `updatedAt`, `deletedAt` (timestamp fields supporting soft-deletion)
   - Prisma migration `20260905115400_add_computer_agent_permissions` generated and applied.

2. **Active-Permission Partial Unique Index**:
   - Backed by PostgreSQL partial unique index:
     ```sql
     CREATE UNIQUE INDEX "computer_agent_permissions_agent_id_action_key"
       ON "ComputerAgentPermission"("agentId", "action")
       WHERE "deletedAt" IS NULL;
     ```
   - Guarantees at most one active grant per `(agentId, action)` pair at the database engine level, while fully supporting historical soft-deleted records and subsequent re-granting.

3. **Concurrency-Safe & Idempotent Grant Lifecycle**:
   - `ComputerAgentPermissionRepository.grantPermission` handles the full permission lifecycle:
     - **Active grant exists** → Idempotent no-op returning existing active permission record.
     - **Soft-deleted grant exists** → Reactivate record by resetting `deletedAt: null` and updating `updatedAt`.
     - **Missing grant** → Create new `ComputerAgentPermission` record.
     - **Concurrent create collision (Prisma P2002)** → Safely catches unique constraint violation and recovers by querying and returning the active permission record.

4. **Owner-Scoped Management Operations**:
   - `grantPermission(agentId, userId, action)`: Validates owner scoping (`agent.userId === userId`) and active agent status (`status === 'ACTIVE'`) before granting.
   - `revokePermission(agentId, userId, action)`: Soft-deletes the permission (`deletedAt: new Date()`) under owner scope.
   - `listPermissions(agentId, userId)`: Returns only active permissions (`deletedAt: null`) for owner-verified active agents.

5. **Privileged Actions Policy Boundary (Single Source of Truth)**:
   - Only privileged Computer Agent actions that require authorization support persistent permissions:
     - `computer_write_file`
     - `computer_launch_application`
   - Policy helper `requiresComputerAuthorization(action)` and `isComputerTool(action)` from `computer-action.policy.ts` serves as the sole source of truth.
   - Read-only actions and unknown actions are rejected fail-closed during grant/revoke.

6. **Read-Only Actions Remain Policy-Authorized**:
   - Read-only actions (`computer_get_status`, `computer_list_applications`, `computer_list_files`, `computer_read_file`) do not require database permission rows and evaluate as authorized via policy check.

7. **Fail-Closed Prisma Permission Provider (`PrismaComputerActionPermissionProvider`)**:
   - Implements `ComputerActionPermissionProvider` interface for runtime authorization.
   - Fails closed on missing or blank `agentId`/`userId`, non-privileged/invalid action names, missing active database grants, or database connection/query failures.
   - Unauthorized privileged action attempts are audited by the authorization layer (`ComputerAgentActionAuthorizer`) via `ToolAuditService`.

8. **Transactional Cascade on Agent Revocation / Deletion**:
   - When an agent is revoked (`revokeAgent`) or deleted (`deleteAgent`), all active permissions for that agent are transactionally soft-deleted (`deletedAt: new Date()`) alongside credentials within the same Prisma `$transaction`.

9. **Server-Side Authorization & Anti-Self-Granting**:
   - Clients cannot self-grant or elevate permissions through request payloads or protocol envelopes.
   - Action authorization is evaluated strictly server-side using server-derived security context before any execution handler is reached.

10. **Preserved Security Boundary**:
    ```text
    Clerk User Identity
            ≠
    Computer Agent Identity
            ≠
    Agent Credential
    ```
    - Clerk authenticates the human user.
    - Computer Agent identity represents the registered workstation owned by the user.
    - Agent credentials authenticate transport envelopes.
    - Persistent permissions govern specific privileged capabilities granted to the agent by its owner.

11. **System Invariants Preserved**:
    - Existing authentication, protocol envelope verification, HTTP transport replay protection, dispatch contract, execution handler boundary, `ComputerAgentGateway`, and `LocalComputerAgent` remain completely intact.

### Current Computer Agent Subsystem Architecture

```text
HTTP Ingress (POST /api/v1/computer-agents/protocol/messages)
      ↓
Agent Credential Authentication (scrypt Hash Verification)
      ↓
Protocol Envelope & Replay Verification (Envelope ID + Timestamp Validation + Replay Guard)
      ↓
Safe Protocol Acknowledgement (Current HTTP transport ends here)

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
[FUTURE / DEFERRED: HTTP Action-Dispatch Execution Wiring connects ingress below]
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

Transport-Independent Action Dispatch Pipeline (DefaultComputerAgentActionDispatcher)
      ↓
Action Authorization (ComputerAgentActionAuthorizer)
      ├── Safe Read-Only Policy Check (Policy-authorized, 0 DB queries)
      └── Privileged Persistent Permission Evaluation (PrismaComputerActionPermissionProvider)
            ↓ (Only if authorized)
Execution Boundary Handler (GatewayComputerActionHandler)
      ├── Strict Parameter Validation
      └── Explicit Switch Mapping to ComputerAgentGateway (getInfo, listApps, listFiles, readFile, launchApp, writeFile)
            ↓
ComputerAgentGateway / LocalComputerAgent Execution
```

### Verification completed

```text
Prisma Migration Status:
npx prisma migrate status → "Database schema is up to date!"
Migration: 20260905115400_add_computer_agent_permissions (APPLIED)

Focused Permission Tests:
- test/services/computer/repositories/computer-agent-permission.repository.test.ts (15/15 PASS)
- test/services/computer/dispatch/prisma-computer-action-permission-provider.test.ts (7/7 PASS)
- test/services/computer/computer-agent.service.test.ts (29/29 PASS)
Total: 51/51 PASS

Full Backend Regression Suite:
66/66 test files passed, 695/695 tests passed (100% PASS)

TypeScript Compilation:
npx tsc --noEmit (0 errors, CLEAN)
npm run build (0 errors, CLEAN)

Diff Check:
git diff --cached --check (0 warnings, CLEAN)
```

### Git checkpoints

```text
bb6cdf8 feat(computer): persist agent action permissions
9727455 feat(computer): add execution boundary
7131e03 feat(computer): add action authorization and dispatch contract
5dbb858 feat(computer): add agent HTTP transport
9ff1c18 feat(computer): add agent protocol contract
debd156 feat(computer): add agent persistence and lifecycle
e728986 feat(computer): add agent authentication contract
```

Verified state:

```text
Branch: main
HEAD: bb6cdf8
origin/main: bb6cdf8 (synchronized)
Working tree: clean (context update pending)
```

### Explicitly deferred work (NOT implemented)

The following items remain explicitly deferred to future milestones:

1. **HTTP Action-Dispatch Execution Wiring**: Connecting incoming HTTP message transport payloads directly to the dispatch pipeline.
2. **WebSocket Real-Time Ingress**: Bi-directional real-time communication channel for computer agent streaming.
3. **Remote Pairing Protocol**: QR-code or PIN-based out-of-band agent registration and pairing flow.
4. **JWT Session Tokens**: Short-lived scoped session tokens for agent interactions.
5. **Distributed Replay Protection**: Redis-backed shared nonce/timestamp cache for multi-instance deployments.
6. **Permission Admin UI / API**: Frontend interface and REST endpoints for managing agent permissions.
7. **Expanded OS / Process Automation**: Additional OS capabilities beyond the core 6 registered actions.
8. **Visual Execution / Screen Capture**: Screen streaming, canvas capture, and coordinate-based mouse/keyboard actions.
9. **Heartbeat & Presence Monitoring**: Periodic health-checks and online status tracking.
10. **Multi-Device Coordination**: Fleet routing and multi-agent task distribution.

---

# 43. ADDITIVE UPDATE — COMPUTER AGENT HTTP ACTION DISPATCH

**Updated:** 2026-09-05

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Mission 43 — Computer Agent HTTP Action Dispatch — COMPLETE

The Computer Agent HTTP transport (`POST /api/v1/computer-agents/protocol/messages`) has now been connected to the existing action-dispatch pipeline.

### Architectural Flow

```text
HTTP Request
    ↓
Credential Authentication
    ↓
Envelope Validation
    ↓
Agent Identity Validation
    ↓
Timestamp Validation (±60s window)
    ↓
Replay Protection (Atomic check & record)
    ↓
Action Dispatcher (DefaultComputerAgentActionDispatcher)
    ↓
Action Authorization (ComputerAgentActionAuthorizer + PrismaComputerActionPermissionProvider)
    ↓
Execution Boundary (GatewayComputerActionHandler → ComputerAgentGateway → LocalComputerAgent)
    ↓
Protocol Response Envelope
```

### Completed

- **HTTP Transport Action Ingress**: Connected `POST /api/v1/computer-agents/protocol/messages` to the action-dispatch pipeline for envelopes where `type === "action_request"`.
- **Dispatcher Injection**: `ComputerAgentHttpTransportService` accepts an optional `ComputerAgentActionDispatcher` dependency.
- **Server-Derived Context Security**: Derives `ComputerAgentActionContext` exclusively from authenticated server context `{ agentId, userId }`. Client request payloads cannot supply or override `userId` or authorization parameters.
- **Preserved Authorization Boundary**: Existing `ComputerAgentActionAuthorizer` and `PrismaComputerActionPermissionProvider` remain the trusted authorization boundary. Safe read-only actions are policy-authorized without DB rows; privileged actions (`computer_write_file`, `computer_launch_application`) require active PostgreSQL permissions.
- **Preserved Execution Boundary**: Existing `GatewayComputerActionHandler` remains the single execution boundary delegating strictly to `ComputerAgentGateway` with validated parameters.
- **Fail-Closed Guarantees**: Missing or unconfigured dispatcher fails closed with `ACTION_FAILED` protocol error envelope without executing anything.
- **Preserved Non-Action Ingress**: Ingress handling for non-action envelopes (e.g., `"ping"`) remains completely intact, returning safe protocol acknowledgement `{ status: "acknowledged", receivedAt: now }`.
- **Preserved Tool Audit Invariants**: Unauthorized privileged action attempts continue to trigger synchronous security audit logging through `ToolAuditService`.
- **Closed Action Surface**: Confined strictly to existing registered `ComputerActionName` values.
- **No Unapproved Infrastructure**: No new database schema, capabilities, JWT, pairing protocol, or WebSocket transport was introduced.

### Verification Completed

```text
HTTP Transport Tests:
38/38 PASS (test/services/computer/transport/computer-agent-http-transport.test.ts)

All Computer Agent Subsystem Tests:
208/208 PASS (9 test files)

Full Backend Regression Suite:
66/66 test files PASS, 723/723 tests PASS (100% PASS)

TypeScript Compilation:
npx tsc --noEmit (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)

Security Review:
PASSED

Architectural Review:
PASSED
```

### Git Checkpoint

```text
d0b60f3 feat(computer): connect HTTP action dispatch
3496b04 feat(computer): add permissions REST API
9de9f98 docs(context): update computer agent permissions milestone
bb6cdf8 feat(computer): persist agent action permissions
```

### Important Roadmap Note

The Computer Agent HTTP transport-to-dispatch execution path is now implemented. Do not claim future Computer Agent capabilities are complete unless they actually exist in the repository.

---

# 44. ADDITIVE UPDATE — ASSISTANT REMINDER TOOLS INTEGRATION

**Updated:** 2026-09-05

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Mission 44 — Assistant Reminder Tools Integration — COMPLETE

The four Assistant Reminder tools (`create_reminder`, `list_reminders`, `get_reminder`, and `cancel_reminder`) have now been implemented and registered in the `ToolRegistry` via `ToolContainer`, connecting the existing Reminders subsystem directly to the conversational AI Assistant.

### Architectural Flow

```text
User / Conversational Prompt ("Remind me to review budget tomorrow at 9am")
    ↓
AssistantService Orchestration (ask)
    ↓
LLM Tool Call Selection (create_reminder / list_reminders / get_reminder / cancel_reminder)
    ↓
ToolExecutor
    ├── Authorization & Classification Check (isComputerTool === false)
    ├── Parameter Validation (requireObject, requireString, requireDate, optionalDate, optionalEnum, optionalPositiveInteger)
    ├── Server-Derived User Context (context.userId from authenticated session)
    ↓
Reminder Tools Execution Layer (reminder.tools.ts)
    ↓
ReminderService (createReminder, listReminders, getReminder, cancelReminder)
    ↓
ReminderRepository (PostgreSQL database operations)
    ↓
Synchronous Audit Logging (ToolAuditService records outcome: SUCCEEDED / FAILED)
    ↓
Assistant Response Generation
```

### Completed

- **Four Assistant Reminder Tools**:
  - `create_reminder`: Creates a scheduled notification with required `message` and ISO 8601 `scheduledFor`, plus optional `taskId`.
  - `list_reminders`: Lists active user reminders with optional `status` enum filter (`PENDING`, `PROCESSING`, `DELIVERED`, `FAILED`, `CANCELLED`), optional ISO `dueBefore` date, and optional integer `limit` (1–50, default 50).
  - `get_reminder`: Retrieves details of a specific reminder owned by the user via `reminderId`.
  - `cancel_reminder`: Cancels a pending scheduled reminder owned by the user via `reminderId`, returning `{ success: true, reminderId, status: "CANCELLED" }`.
- **ReminderService Reused As-Is**: Reused existing `ReminderService` methods without modifying domain business logic, validation rules, or worker execution semantics.
- **ToolContainer Registration**: `createToolRegistry()` in `tool.container.ts` registers all four reminder tools; accepts optional `reminderService` override in `ToolContainerOptions`.
- **Server-Derived User Identity**: `userId` is extracted strictly from `ToolContext.userId` (`context.userId`). Tool argument JSON schemas omit `userId`, preventing any client-side or prompt-injected ownership spoofing.
- **Strict Multi-Tenant Isolation**: Ownership queries and soft-deletion/cancellation operations remain scoped to `context.userId` via repository `where: { userId, deletedAt: null }` filters.
- **Audit Invariants Preserved**: `ToolExecutor` synchronously records `SUCCEEDED` / `FAILED` audit events with execution durations and sanitized error messages to `ToolAuditService`.
- **No Computer Authorization Overhead**: Reminder tools evaluate to `isComputerTool === false` and `requiresComputerAuthorization === false`.
- **No AI Provider Coupling**: Standard `ToolDefinition` schemas are provider-agnostic and work seamlessly across Ollama, OpenRouter, DeepSeek, and Gemini providers.
- **Zero Database Schema Changes**: No Prisma schema modifications or migrations were introduced; the existing PostgreSQL `Reminder` model was reused completely.

### Verification Completed

```text
Focused Reminder Tool Tests:
23/23 PASS (test/tools/reminder.tools.test.ts)

All Tool Subsystem Tests:
62/62 PASS (7 test files in test/tools/)

Full Backend Regression Suite:
67/67 test files PASS, 746/746 tests PASS (100% PASS)

TypeScript Compilation:
npx tsc --noEmit (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)

Security Review:
PASSED (Server-derived context, tenant isolation, information hiding, fail-closed validation)

Architectural Review:
PASSED (Clean tool container composition, zero database/domain drift)
```

### Git Checkpoint

```text
6ae0a7e feat(tools): add assistant reminder tools
ccdb29b docs(context): update HTTP action dispatch milestone
d0b60f3 feat(computer): connect HTTP action dispatch
3496b04 feat(computer): add permissions REST API
```

Verified state:
- Branch: `main`
- HEAD: `6ae0a7e`
- Remote: `origin/main` synchronized (`HEAD == origin/main`)
- Working tree: clean (context update pending)

---

# 45. MISSION 45 — ASSISTANT MEMORY TOOLS INTEGRATION

**Updated:** 2026-09-05

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Mission 45 — Assistant Memory Tools Integration — COMPLETE

Mission 45 adds explicit conversational memory operations to the BrainOS AI Assistant. Through standard tool definitions, the assistant can now explicitly store, search, list, retrieve, and delete personal memories and facts in the user's persistent Second Brain memory engine.

### Architectural Flow

```text
User / Conversational Prompt ("Remember that my doctor is Dr. Smith at City Clinic")
    ↓
AssistantService Orchestration (ask)
    ↓
LLM Tool Call Selection (store_memory / search_memories / list_memories / get_memory / delete_memory)
    ↓
ToolExecutor
    ├── Classification Check (isComputerTool === false, requiresComputerAuthorization === false)
    ├── Parameter Validation (requireObject, requireString, optionalImportance [0.0–1.0], optionalIntegerInRange [1–50])
    ├── Server-Derived User Context (context.userId from authenticated session)
    ↓
Memory Tools Execution Layer (memory.tools.ts)
    ↓
MemoryService (createMemory, searchMemories, listMemories, getMemoryById, deleteMemory)
    ├── EmbeddingsService (768-dimensional nomic-embed-text via Ollama)
    ↓
MemoryRepository (PostgreSQL database operations & pgvector cosine similarity)
    ↓
Synchronous Audit Logging (ToolAuditService records outcome: SUCCEEDED / FAILED)
    ↓
Assistant Response Generation
```

### 1. Added Tools

- **`store_memory`**: Stores a new personal fact, preference, note, or piece of knowledge in the user's Second Brain memory with required `content` string and optional float `importance` ($0.0 \le \text{importance} \le 1.0$, default $0.5$).
- **`search_memories`**: Semantically searches stored memories using natural language query with required `query` string and optional integer `limit` ($1 \le \text{limit} \le 50$, default $5$).
- **`list_memories`**: Lists recent stored memories and personal knowledge notes in reverse chronological order with optional integer `limit` ($1 \le \text{limit} \le 50$, default $20$).
- **`get_memory`**: Retrieves details of a specific stored memory by required `memoryId` string.
- **`delete_memory`**: Soft-deletes (forgets) a stored memory by required `memoryId` string, returning `{ success: true, memoryId }`.

### 2. Implementation Files

- `apps/backend/src/services/tools/memory.tools.ts`
- `apps/backend/src/services/tools/tool.container.ts`
- `apps/backend/test/tools/memory.tools.test.ts`

### 3. Reused Domain Contracts (Without Modification)

- `MemoryService.createMemory({ userId, content, importance? })`
- `MemoryService.searchMemories({ userId, query, limit? })`
- `MemoryService.listMemories({ userId, limit? })`
- `MemoryService.getMemoryById({ userId, memoryId })`
- `MemoryService.deleteMemory({ userId, memoryId })`

### 4. Actual Validation Boundaries

- `importance`: Float number between `0.0` and `1.0` inclusive ($0.0 \le \text{importance} \le 1.0$).
- `default importance`: `0.5`, handled authoritatively by `MemoryService` and `DEFAULT_MEMORY_IMPORTANCE`.
- `search limit`: Integer between `1` and `50` ($1 \le \text{limit} \le 50$), default `5`.
- `list limit`: Integer between `1` and `50` ($1 \le \text{limit} \le 50$), default `20`.
- Non-empty strings required for `content`, `query`, and `memoryId`.

### 5. Security & Isolation

- **Server-Derived Identity**: `userId` is derived exclusively from `ToolContext.userId` (`context.userId`).
- **No Client Spoofing**: `userId` is never accepted as a tool argument in parameter schemas.
- **Fail-Closed Context**: Missing or whitespace-only `context.userId` immediately throws an error before calling service logic.
- **Tenant Isolation**: `MemoryService` and `MemoryRepository` enforce user ownership and `deletedAt: null` filtering on all operations.
- **Cross-User Protection**: Attempting to fetch or delete another user's memory throws `NotFoundError`.
- **Information Hiding**: 768-dimensional float embedding vectors and internal database identifiers are never exposed in tool output.
- **Audit Logging**: `ToolExecutor` synchronously records `SUCCEEDED` / `FAILED` audit records to `ToolAuditService` with sanitized error messages.
- **Tool Classification**: Memory tools evaluate to `isComputerTool === false` and `requiresComputerAuthorization === false`.

### 6. Architecture & Composition

- Follows the established `ToolDefinition` / `ToolContext` architecture.
- `createToolRegistry(options)` in `tool.container.ts` accepts an optional `memoryService?: MemoryService` in `ToolContainerOptions` for dependency injection and testing.
- Zero modifications to `MemoryService`, `MemoryRepository`, `EmbeddingsService`, `AssistantService`, Computer Agent, AI provider abstraction, Prisma schema, or migrations.
- Standard JSON parameter schemas are provider-agnostic across Ollama, OmniRoute, and other LLM backends.

### 7. Verification Completed

```text
Focused Memory Tool Tests:
24/24 PASS (test/tools/memory.tools.test.ts)

All Tool Subsystem Tests:
86/86 PASS (8 test files in test/tools/)

Full Backend Regression Suite:
68/68 test files PASS, 770/770 tests PASS (100% PASS)

TypeScript Compilation:
npx tsc --noEmit (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)

Security Review:
PASSED (Server-derived context, tenant isolation, information hiding, fail-closed validation)

Architectural Review:
PASSED (Clean tool container composition, zero database/domain drift)
```

### 8. Git Checkpoint

```text
feaaed3 feat(tools): add assistant memory tools
99f9b43 docs(context): update assistant reminder tools milestone
6ae0a7e feat(tools): add assistant reminder tools
ccdb29b docs(context): update HTTP action dispatch milestone
```

Verified state:
- Branch: `main`
- HEAD: `feaaed3`
- Remote: `origin/main` synchronized (`HEAD == origin/main`)
- Working tree: context update uncommitted

### 9. Mission Impact

The BrainOS assistant can now explicitly store, search, list, retrieve, and forget user memories through the existing tool-calling architecture, completing the conversational memory tool surface without changing the underlying memory domain or database schema.

### 10. Deferred / Unchanged

- Assistant Automation Tools remain future work.
- Frontend tool visualization in Next.js remains future work.
- Native desktop daemon / OS drivers remain deferred.
- No database schema or migration changes were required.

---

# 46. MISSION 46 — ASSISTANT AUTOMATION TOOLS INTEGRATION

**Updated:** 2026-09-06

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Mission 46 — Assistant Automation Tools Integration — COMPLETE

Mission 46 connects the existing Automations subsystem directly to the conversational AI Assistant. Through standard tool definitions, the assistant can now create, list, inspect, update (pause/resume/reconfigure), and delete automated workflows across schedules, task due triggers, and reminder due triggers.

### Architectural Flow

```text
User / Conversational Prompt ("Create an automation to review weekly tasks every Friday at 5pm")
    ↓
AssistantService Orchestration (ask)
    ↓
LLM Tool Call Selection (create_automation / list_automations / get_automation / update_automation / delete_automation)
    ↓
ToolExecutor
    ├── Classification Check (isComputerTool === false, requiresComputerAuthorization === false)
    ├── Parameter Validation (requireObject, requireString, requireEnum, optionalDate, optionalPositiveIntegerInRange)
    ├── Server-Derived User Context (context.userId from authenticated session)
    ↓
Automation Tools Execution Layer (automation.tools.ts)
    ↓
AutomationService (createAutomation, listAutomations, getAutomation, updateAutomation, deleteAutomation)
    ├── AutomationRecurrence (calculateNextRunAt, daily/weekly rules)
    ↓
AutomationRepository (PostgreSQL database operations)
    ↓
Synchronous Audit Logging (ToolAuditService records outcome: SUCCEEDED / FAILED)
    ↓
Assistant Response Generation
```

### 1. Added Tools

- **`create_automation`**: Creates an automated workflow for trigger types (`SCHEDULE`, `TASK_DUE`, `REMINDER_DUE`) and action types (`CREATE_TASK`, `CREATE_REMINDER`) with required `name`, `triggerType`, `actionType`, `config`, and optional `nextRunAt` ISO date.
- **`list_automations`**: Lists automations for the authenticated user, with optional `status` filter (`ACTIVE`, `PAUSED`, `COMPLETED`, `FAILED`) and integer `limit` (1–50, default 50).
- **`get_automation`**: Retrieves full details of a specific automation by required `automationId` string.
- **`update_automation`**: Updates an existing automation's `name`, `status` (`ACTIVE` / `PAUSED`), `config`, or `nextRunAt` ISO date by `automationId`.
- **`delete_automation`**: Soft-deletes an automation rule by required `automationId` string, returning `{ success: true, automationId }`.

### 2. Implementation Files

- `apps/backend/src/services/tools/automation.tools.ts`
- `apps/backend/src/services/tools/tool.container.ts`
- `apps/backend/test/tools/automation.tools.test.ts`

### 3. Reused Domain Contracts (Without Modification)

- `AutomationService.createAutomation({ userId, name, triggerType, actionType, config, nextRunAt? })`
- `AutomationService.listAutomations({ userId, status?, limit? })`
- `AutomationService.getAutomation(automationId, userId)`
- `AutomationService.updateAutomation(automationId, userId, { name?, status?, config?, nextRunAt? })`
- `AutomationService.deleteAutomation(automationId, userId)`

### 4. Actual Validation Boundaries

- `triggerType`: `SCHEDULE`, `TASK_DUE`, `REMINDER_DUE`.
- `actionType`: `CREATE_TASK`, `CREATE_REMINDER`.
- `status`: `ACTIVE`, `PAUSED`, `COMPLETED`, `FAILED`.
- `limit`: Integer between 1 and 50 ($1 \le \text{limit} \le 50$), default 50.
- `config`: Object containing action parameters (`title`/`description`/`dueAt` or `message`/`scheduledFor`/`taskId`) and recurrence rules (`DAILY`/`WEEKLY`).
- Server-derived `userId` enforced on all operations.

### 5. Security & Isolation

- **Server-Derived Identity**: `userId` is derived exclusively from `ToolContext.userId` (`context.userId`).
- **No Client Spoofing**: `userId` is omitted from tool parameter schemas; prompt/client attempts to supply `userId` are ignored.
- **Fail-Closed Context**: Missing or whitespace-only `context.userId` immediately throws an error before calling service logic.
- **Tenant Isolation**: `AutomationService` and `AutomationRepository` enforce multi-tenant isolation (`where: { id, userId, deletedAt: null }`).
- **Cross-User Protection**: Attempting to fetch, update, or delete another user's automation throws `NotFoundError`.
- **No External Egress**: Automations trigger internal task/reminder creations only; no arbitrary outbound HTTP requests or webhook calls.
- **Audit Logging**: `ToolExecutor` synchronously records `SUCCEEDED` / `FAILED` audit records with sanitized error messages to `ToolAuditService`.
- **Tool Classification**: Automation tools evaluate to `isComputerTool === false` and `requiresComputerAuthorization === false`.

### 6. Architecture & Composition

- Follows the established `ToolDefinition` / `ToolContext` architecture.
- `createToolRegistry(options)` in `tool.container.ts` accepts an optional `automationService?: AutomationService` in `ToolContainerOptions` for dependency injection and testing.
- Zero modifications to `AutomationService`, `AutomationRepository`, `AutomationScheduler`, `AssistantService`, Computer Agent, AI provider abstraction, Prisma schema, or migrations.
- Provider-independent standard JSON parameter schemas compatible with Ollama, OmniRoute, and other LLM backends.

### 7. Verification Completed

```text
Focused Automation Tool Tests:
27/27 PASS (test/tools/automation.tools.test.ts)

All Tool Subsystem Tests:
113/113 PASS (9 test files in test/tools/)

Full Backend Regression Suite:
69/69 test files PASS, 797/797 tests PASS (100% PASS)

TypeScript Compilation:
npx tsc --noEmit (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)

Security Review:
PASSED (Server-derived context, tenant isolation, fail-closed validation, information hiding)

Architectural Review:
PASSED (Clean tool container composition, zero database/domain drift)
```

### 8. Git Checkpoint

```text
11c187d feat(tools): add assistant automation tools
24034fa docs(context): update assistant memory tools milestone
feaaed3 feat(tools): add assistant memory tools
99f9b43 docs(context): update assistant reminder tools milestone
```

Verified state:
- Branch: `main`
- HEAD: `11c187d`
- Status: synchronized with origin/main at 11c187d
- Working tree: context update uncommitted (`.agents/rules/` remains untracked user customization)

### 9. Mission Impact

All five core BrainOS backend domains (**Tasks**, **Documents/RAG**, **Computer Actions**, **Reminders**, and **Automations**) are now fully wired into the AI Assistant runtime via standardized, secure, audited tool definitions.

### 10. Deferred / Unchanged

- Assistant Streaming & Token Generation Protocol (SSE) remains future work.
- Frontend assistant UI tool visualization widgets in Next.js remain future work.
- Native desktop daemon / OS drivers remain deferred.
- No database schema or migration changes were required.

---

# 47. MISSION 47 — ASSISTANT DOCUMENT MANAGEMENT TOOLS

**Updated:** 2026-09-06

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Mission 47 — Assistant Document Management Tools — COMPLETE

Mission 47 extends the Assistant tool subsystem by exposing document inspection and lifecycle management capabilities alongside the existing semantic RAG retrieval tool (`document_search`). The conversational AI assistant can now list uploaded knowledge base documents, inspect full document content and metadata by document ID, and soft-delete unneeded documents.

### Architectural Flow

```text
User / Conversational Prompt ("List my uploaded documents" / "Show me document doc_123" / "Delete document doc_456")
    ↓
AssistantService Orchestration (ask)
    ↓
LLM Tool Call Selection (list_documents / get_document / delete_document / document_search)
    ↓
ToolExecutor
    ├── Classification Check (isComputerTool === false, requiresComputerAuthorization === false)
    ├── Parameter Validation (requireObject, requireString, optionalEnum, optionalPositiveIntegerInRange)
    ├── Server-Derived User Context (context.userId from authenticated session)
    ↓
Document Tools Execution Layer (document.tools.ts)
    ├── list_documents / get_document / delete_document → DocumentService (listDocuments, getDocument, deleteDocument)
    │   ↓
    │   DocumentRepository (PostgreSQL database operations, soft-delete via deletedAt)
    └── document_search → DocumentRetrievalService (search)
    ↓
Synchronous Audit Logging (ToolAuditService records outcome: SUCCEEDED / FAILED)
    ↓
Assistant Response Generation
```

### 1. Tools Added & Preserved

- **`list_documents` [NEW]**: Lists documents for the authenticated user, with optional `status` filter (`PENDING`, `READY`, `FAILED`, `DELETED`) and optional integer `limit` (1–50, default 20). Returns sanitized metadata array.
- **`get_document` [NEW]**: Retrieves complete details, metadata, and full text content of a specific document for the authenticated user by required `documentId`.
- **`delete_document` [NEW]**: Soft-deletes a document for the authenticated user by required `documentId`, returning `{ success: true, documentId }`.
- **`document_search` [PRESERVED]**: Continues to perform hybrid semantic/keyword search over chunked document embeddings with required `query` and optional integer `limit` (1–20).

### 2. Implementation Files

- `apps/backend/src/services/tools/document.tools.ts`
- `apps/backend/src/services/tools/tool.container.ts`
- `apps/backend/test/tools/document.tools.test.ts`

### 3. Reused Domain Contracts (Without Modification)

- `DocumentService.listDocuments({ userId, status?, limit? })`
- `DocumentService.getDocument({ documentId, userId })`
- `DocumentService.deleteDocument({ documentId, userId })`
- `DocumentRetrievalService.search({ userId, query, limit? })`

### 4. Actual Validation Boundaries

- `status` (`list_documents`): `PENDING`, `READY`, `FAILED`, `DELETED` (matches Prisma schema `DocumentStatus`).
- `limit` (`list_documents`): Integer between 1 and 50 ($1 \le \text{limit} \le 50$, default 20).
- `documentId` (`get_document`, `delete_document`): Required non-empty string.
- `query` (`document_search`): Required non-empty string.
- `limit` (`document_search`): Integer between 1 and 20 ($1 \le \text{limit} \le 20$).
- Server-derived `userId` enforced across all operations.

### 5. Security & Tenant Isolation

- **Server-Derived Identity**: `userId` is obtained strictly from `ToolContext.userId` (`context.userId`).
- **No Client Spoofing**: `userId` is omitted from tool schemas; user/client/prompt cannot provide or override `userId`.
- **Fail-Closed Validation**: Missing, null, or whitespace-only `context.userId` immediately throws an error before reaching domain services.
- **Tenant Isolation**: `DocumentService` and `DocumentRepository` enforce strict user ownership (`where: { id, userId, deletedAt: null }`).
- **Cross-User Protection**: Accessing or deleting another user's document throws `NotFoundError` ("Document not found for the authenticated user.").
- **Soft-Delete Behavior**: `delete_document` sets `deletedAt` timestamp without hard deleting underlying records.
- **Audit Logging**: All document tool executions record `SUCCEEDED` / `FAILED` audit records with sanitized error messages in `ToolAuditService`.
- **Tool Classification**: Document tools evaluate to `isComputerTool === false` and `requiresComputerAuthorization === false`.

### 6. Sanitized Outputs

- Returns only public document metadata and text content (`id`, `title`, `sourceType`, `source`, `mimeType`, `status`, `createdAt`, `updatedAt`, and `content` for `get_document`).
- Completely omits raw vector embeddings, chunk vectors, and internal chunking metadata.

### 7. Architecture & Tool Registration / DI

- Follows standard `ToolDefinition` / `ToolContext` contracts.
- Individual factory functions exported: `createListDocumentsTool`, `createGetDocumentTool`, `createDeleteDocumentTool`, `createDocumentSearchTool`.
- `createDocumentTools` bundles all 4 tools and accepts `documentRetrievalService?: DocumentRetrievalService` and `documentService?: DocumentService`.
- `createToolRegistry(options)` in `tool.container.ts` registers all 4 document tools and accepts optional `documentRetrievalService` and `documentService` in `ToolContainerOptions`.
- Zero modifications to `DocumentService`, `DocumentRepository`, `DocumentRetrievalService`, Prisma schema/migrations, RAG search behavior, `AssistantService`, Computer Agent, or AI provider abstraction.

### 8. Verification Completed

```text
Focused Document Tool Tests:
25/25 PASS (test/tools/document.tools.test.ts)

All Tool Subsystem Tests:
127/127 PASS (9 test files in test/tools/)

Full Backend Regression Suite:
69/69 test files PASS, 811/811 tests PASS (100% PASS)

TypeScript Compilation:
npx tsc --noEmit / npm run build (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)

Security Review:
PASSED (Server-derived context, tenant isolation, fail-closed validation, information hiding)

Architectural Review:
PASSED (Clean tool container composition, zero database/domain drift)
```

### 9. Git Checkpoint

```text
c4bf8e4 feat(tools): add assistant document management tools
96c3da2 docs(context): update assistant automation tools milestone
11c187d feat(tools): add assistant automation tools
```

Verified state:
- Branch: `main`
- HEAD: `c4bf8e4`
- Status: 1 commit ahead of origin/main (push pending)
- Working tree: context update uncommitted (`.agents/rules/` remains untracked user customization)

### 10. Mission Impact

The conversational AI Assistant now has full visibility and lifecycle control over the user's uploaded documents and Second Brain knowledge base without modifying any underlying ingestion, retrieval, or database models.

### 11. Deferred / Unchanged

- Assistant Streaming & Token Generation Protocol (SSE) remains future work.
- Frontend assistant UI document management/preview widgets in Next.js remain future work.
- Native desktop daemon / OS drivers remain deferred.
- No database schema or migration changes were required.

---

# 48. MISSION 48 — ASSISTANT SSE STREAMING TRANSPORT

**Updated:** 2026-09-06

This section is an additive update to the BrainOS master context. It does **not** replace, remove, or rewrite any earlier product vision, roadmap, architectural history, or completed milestones.

## Mission 48 — Assistant Server-Sent Events (SSE) Streaming Transport — COMPLETE

Mission 48 introduces real-time streaming transport for the BrainOS AI Assistant using standard Server-Sent Events (SSE) over HTTP (`POST /api/v1/assistant/stream`). Instead of blocking the client until full RAG retrieval, multi-round tool cycles, and final response synthesis complete, the assistant now streams live runtime state transitions and tool execution progress events directly to the client as they occur, concluding with the synthesized final response and stream termination.

### Architectural Flow

```text
Client / Frontend (POST /api/v1/assistant/stream with Bearer Token)
    ↓
Express requireAuth Middleware (Validates Clerk token, sets req.user)
    ↓
AssistantController (streamAssistant)
    ├── Shared Request Validation (validateAssistantRequest)
    ├── SSE Response Headers (Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive)
    ├── Request-Scoped AssistantRuntime Allocation (isolated new AssistantRuntime() per request)
    ├── Event Listener Subscription (runtime.subscribe)
    ├── Socket Disconnect Handler (req.on("close", cleanup) -> unsubscribe())
    ↓
AssistantService Orchestration (ask with input.runtime)
    ├── runtime.setState("THINKING") -> SSE event: state_changed
    ├── Tool Execution Cycle
    │   ├── runtime.startTask(taskId) -> SSE event: state_changed (EXECUTING) & event: task_event (TASK_STARTED)
    │   ├── runtime.progressTask(taskId) -> SSE event: task_event (TASK_PROGRESS)
    │   ├── ToolExecutor.execute(...) (runs domain tools: task, reminder, memory, automation, document, computer)
    │   └── runtime.completeTask(taskId) / failTask -> SSE event: task_event (TASK_COMPLETED / TASK_FAILED)
    ├── runtime.setState("SPEAKING") -> SSE event: state_changed
    ├── Final AssistantResponse Generation
    └── runtime.setState("IDLE") -> SSE event: state_changed
    ↓
Stream Completion
    ├── SSE event: response (data: final AssistantResponse payload)
    ├── SSE event: done (data: {})
    └── res.end() & unsubscribe()
```

### 1. Why Server-Sent Events (SSE) Was Selected

- **Standard HTTP Compatibility**: Operates seamlessly over standard HTTP/1.1 and HTTP/2 without requiring WebSocket handshake negotiation, separate protocols, or custom connection state machines.
- **Unidirectional Fit**: Assistant orchestration streaming is strictly server-to-client after the initial client message request.
- **Simplicity & Resilience**: Standard text streaming format (`text/event-stream`) works out of the box with browser fetch streams, `EventSource`, and server-side proxies without additional dependencies.

### 2. Request-Scoped AssistantRuntime Design & Tenant Isolation

- **Request Scoping**: Each `/stream` request allocates a dedicated `new AssistantRuntime()` instance rather than binding to a shared global singleton.
- **Zero Cross-User Leakage**: Subscriptions are bound strictly to the specific HTTP response stream. Concurrent requests from different users or sessions execute on completely isolated runtime instances with zero event crosstalk.
- **Fail-Closed Cleanup**: Both graceful stream completion and early client socket disconnection (`req.on("close")`) invoke `unsubscribe()` to prevent lingering listeners or memory leaks.

### 3. SSE Event Protocol

The streaming endpoint emits five structured SSE event types:

1. **`event: state_changed`**:
   - Emits runtime lifecycle state snapshots (`{ state: "IDLE" | "THINKING" | "EXECUTING" | "SPEAKING" | "ERROR", activeTaskId: string | null }`).
   - Emitted upon initial connection and on every internal runtime transition.
2. **`event: task_event`**:
   - Emits tool execution progress updates (`{ type: "TASK_STARTED" | "TASK_PROGRESS" | "TASK_COMPLETED" | "TASK_FAILED", taskId: string, message: string, timestamp: string }`).
3. **`event: response`**:
   - Emits the complete, synthesized `AssistantResponse` (`{ text, model, provider, retrievedMemories, retrievedDocuments }`) prior to closing.
4. **`event: error`**:
   - Emits a sanitized error payload (`{ message: string }`) if orchestration fails during the stream, stripping sensitive connection strings, Prisma internal tokens, or stack traces.
5. **`event: done`**:
   - Emits `{}` to signal stream completion, followed immediately by `res.end()`.

### 4. Shared Validation & Existing /ask Preservation

- Extracted a unified, fail-closed `validateAssistantRequest(body)` helper verifying all parameters (`message`, `conversationId`, `systemPrompt`, `memorySearchLimit`, `documentSearchLimit`, `model`, `authorizedComputerActions`, `timezone`).
- Unauthenticated requests fail closed with `401 Unauthorized` JSON before stream initialization.
- Invalid payloads fail closed with `400 Bad Request` JSON before stream initialization.
- Existing `POST /api/v1/assistant/ask` endpoint is 100% preserved and functionally identical, continuing to return synchronous `200 OK` JSON responses.

### 5. Implementation Files

- `apps/backend/src/services/assistant/assistant.types.ts`: Added optional `runtime?: AssistantRuntime` to `AssistantMessageInput`.
- `apps/backend/src/services/assistant/assistant.service.ts`: Scoped runtime resolution (`const runtime = input.runtime ?? this.runtime;`) and added `getRuntime()`.
- `apps/backend/src/controllers/assistant/assistant.controller.ts`: Extracted shared validation, implemented `streamAssistant`, SSE formatting, and error sanitization.
- `apps/backend/src/routes/assistant.routes.ts`: Registered `POST /api/v1/assistant/stream` with `requireAuth`.
- `apps/backend/test/assistant/assistant.stream.api.test.ts` [NEW]: Focused 9-scenario integration test suite.

### 6. Verification Completed

```text
Focused Assistant SSE Streaming Tests:
9/9 PASS (test/assistant/assistant.stream.api.test.ts)

All Assistant Subsystem Tests:
83/83 PASS (13 test files in test/assistant/)

Full Backend Regression Suite:
70/70 test files PASS, 820/820 tests PASS (100% PASS)

TypeScript Compilation:
npx tsc --noEmit / npm run build (0 errors, CLEAN)

Diff Check:
git diff --check (0 warnings, CLEAN)

Security & Tenant Isolation Review:
PASSED (Request-scoped runtime, zero cross-user leakage, fail-closed auth/validation, sanitized error payloads)

Architectural Review:
PASSED (Zero database/schema changes, zero provider interface changes, clean SSE transport composition)
```

### 7. Git Checkpoint

```text
726aa1c feat(assistant): add SSE streaming transport
3ab3d81 docs(context): update assistant document management milestone
c4bf8e4 feat(tools): add assistant document management tools
```

Verified state:
- Branch: `main`
- HEAD: `726aa1c`
- Status: 1 commit ahead of origin/main (push pending)
- Working tree: context update uncommitted (`.agents/rules/` remains untracked user customization)

### 8. Mission Impact

The BrainOS assistant now provides real-time event streaming and live progress visibility across all tool cycles (tasks, reminders, memories, automations, documents, and computer actions) over standard Server-Sent Events, establishing the foundational streaming transport for real-time frontend user experiences.

### 9. Deferred / Unchanged

- Token-by-token LLM generation streaming remains deferred (requires AI provider streaming abstraction).
- WebSocket bidirectional real-time channels remain deferred.
- Frontend assistant streaming UI widgets in Next.js remain future work.
- Computer Agent and native desktop drivers remain deferred.
- No database schema or migration changes were required.
