# BrainOS — MASTER PROJECT CONTEXT

## Single Source of Truth for Future Development Chats

**Project:** BrainOS  
**Purpose:** Private Personal AI Operating System / Second Brain / Personal Assistant  
**Repository:** `D:\Project\BrainOS`  
**Branch:** `main`  
**OS:** Windows  
**Editor:** VS Code  

---

# 0. CRITICAL RULE FOR EVERY FUTURE CHAT

Before changing BrainOS:

1. Read this context completely.
2. Inspect the actual repository.
3. Check `git status` and recent commits.
4. Inspect the relevant files.
5. Confirm the current milestone against the repository.
6. Explain the architectural reason for significant changes.
7. Make the smallest correct change.
8. Run focused tests.
9. Run TypeScript validation.
10. Run the broader regression when appropriate.
11. Verify actual behavior.
12. Update this context after meaningful milestones.
13. Review the Git diff.
14. Commit completed work.
15. Push completed work.
16. Verify final Git state.

Never:

- restart completed phases
- blindly overwrite working code
- make changes only because they seem stylistically nicer
- bypass authentication/authorization
- trust client-supplied ownership IDs
- put Prisma/database access in controllers
- put business logic in controllers
- expose secrets, tokens, Authorization headers, session IDs, or private document content in logs
- claim planned work is implemented or verified when it is not
- edit an already-applied Prisma migration
- use `prisma migrate reset` as the first response to migration problems

If this context and the repository disagree, the repository must be inspected and the difference resolved before coding.

---

# 1. BRAINOS MISSION

BrainOS is being built as a **private personal AI operating system**, not merely a chatbot.

The long-term goal is an AI assistant that understands the user's personal context and can help manage information, work, study, communication, and computer-based activities while remaining private, secure, modular, affordable, maintainable, and under the user's control.

## North-star idea

> BrainOS should become a private second brain and personal operating system that reduces cognitive load.

The eventual assistant should feel like:

> "My assistant knows my context and helps me manage my life, work, study, communication, and computer."

Not:

> "A chatbot with a database attached."

---

# 2. LONG-TERM PRODUCT VISION

The intended final BrainOS system is:

```text
                         USER
                          │
                          ▼
                  BrainOS Assistant
                          │
                          ▼
                 AI Orchestrator
                          │
          ┌───────────────┼────────────────┐
          │               │                │
          ▼               ▼                ▼
       Memory         Knowledge          Tools
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                    Action Layer
                          │
       ┌──────────┬───────┼────────┬───────────┐
       ▼          ▼       ▼        ▼           ▼
     Tasks     Reminders Calendar Email     Messaging
                                           / WhatsApp
       │          │       │        │           │
       └──────────┴───────┼────────┴───────────┘
                          ▼
                  Local Computer Agent
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Apps/files   Windows      Browser
```

The core loop is:

```text
User request
 ↓
Understand intent
 ↓
Retrieve personal context / memory / documents
 ↓
Reason
 ↓
Choose tool(s)
 ↓
Validate authorization and safety
 ↓
Execute action
 ↓
Observe result
 ↓
Respond
 ↓
Optionally remember useful information
```

---

# 3. FINAL CAPABILITY TARGET

When the project is mature, BrainOS should be able to provide the following capabilities.

## 3.1 Personal memory

- remember important user information
- store preferences and facts when appropriate
- retrieve relevant memories
- maintain authenticated ownership/isolation
- use memory to personalize responses
- allow the user to control what is remembered

Examples:

```text
"Remember my project architecture."

"What did I decide about the database?"

"What do you know about this project?"
```

---

## 3.2 Knowledge and documents

BrainOS should understand the user's documents and knowledge base.

Target flow:

```text
Document
 ↓
Ingestion
 ↓
Extraction
 ↓
Chunking
 ↓
Embedding
 ↓
Vector storage
 ↓
Semantic retrieval
 ↓
Assistant context
 ↓
Answer / reasoning / action
```

Examples:

```text
"Read this document and tell me what matters."

"Find the section where I discussed the database."

"Use my project documents when answering this."
```

---

## 3.3 Tasks

BrainOS should manage structured tasks.

Examples:

```text
"Create a task to finish the API."

"Show my overdue tasks."

"Complete the task."

"Move this task to tomorrow."
```

Task operations should remain authenticated and user-owned.

---

## 3.4 Reminders and alarms

BrainOS should eventually support:

- one-time reminders
- scheduled reminders
- recurring reminders
- alarm-like notifications
- reminder delivery
- failure/retry handling
- cancellation
- proactive reminders

Examples:

```text
"Remind me tomorrow at 9 AM."

"Remind me every Monday."

"Wake me at 7 AM."

"Remind me if I haven't completed this task."
```

Reminder scheduling and delivery must remain behind service/provider boundaries.

---

## 3.5 Planning and scheduling

BrainOS should help organize time.

Target capabilities:

- task planning
- daily planning
- weekly planning
- calendar awareness
- deadline awareness
- schedule conflict detection
- prioritization
- time-aware recommendations

Examples:

```text
"Plan my week around my classes and projects."

"When can I finish this?"

"Do I have time for this tomorrow?"

"Move my tasks around my calendar."
```

---

## 3.6 Calendar integration

Eventually BrainOS should integrate with a calendar provider.

Target capabilities:

- read calendar events
- create events
- update events
- cancel events
- detect conflicts
- use calendar availability during planning
- combine tasks + reminders + calendar

Example:

```text
"Check my calendar and tell me if I have time."

"Schedule this for the first free hour tomorrow."
```

Calendar access must use authenticated provider integrations and explicit user authorization.

---

## 3.7 Email management

Eventually BrainOS should manage email through an authenticated provider integration.

Target capabilities:

- summarize emails
- search emails
- identify important messages
- draft replies
- send replies when explicitly authorized
- create follow-up tasks
- create reminders from email
- detect deadlines
- connect emails with documents/tasks/calendar

Examples:

```text
"Summarize my important emails."

"Find the email about the project deadline."

"Draft a reply."

"Turn this email into a task."
```

Sending email is an external side effect and should have appropriate authorization/confirmation controls.

---

## 3.8 WhatsApp / messaging integration

Eventually BrainOS should be able to assist with WhatsApp/messaging workflows through an appropriate supported integration.

Target capabilities:

- read authorized incoming messages
- summarize conversations
- identify messages requiring attention
- draft replies
- send authorized replies
- create tasks/reminders from messages
- maintain conversation context where permitted
- support away/offline response workflows

Example:

```text
"Check my messages."

"Who needs a reply?"

"Draft a response to this."

"Reply that I will get back to them tomorrow."
```

### Important design rule

BrainOS must not silently impersonate the user.

Messaging automation must respect:

- platform rules
- provider/API capabilities
- authentication
- user authorization
- recipient expectations
- configurable automation boundaries
- explicit confirmation for sensitive/high-impact actions when appropriate

Do not build an unofficial integration merely because it is technically possible if it creates unacceptable account or platform risk.

---

## 3.9 Local computer control

A major long-term capability is a **local BrainOS computer agent** running on the user's Windows computer.

The cloud/backend assistant cannot directly unlock or control the user's computer by itself. A local agent is required.

Target architecture:

```text
BrainOS Backend
      │
      ▼
Authenticated Local-Agent Channel
      │
      ▼
BrainOS Windows Agent
      │
      ├── Application control
      ├── File control
      ├── Browser control
      ├── Window control
      ├── OS actions
      └── Computer state
```

Examples of intended capabilities:

```text
"Open VS Code."

"Open my BrainOS project."

"Open Spotify."

"Find the PDF I downloaded."

"Open my browser."

"Prepare my study environment."
```

The local agent must enforce:

- authenticated communication
- explicit tool permissions
- allowlists/denylists where appropriate
- action logging without leaking secrets
- confirmation for sensitive operations
- least privilege
- secure transport
- local-user ownership

---

## 3.10 Computer unlock / lock

Computer unlock is a **high-security capability** and must not be treated like a normal generic tool.

Possible future capabilities:

```text
"Lock my computer."
```

Unlocking may require a dedicated secure mechanism and should never bypass Windows security controls improperly.

Design requirements:

- strong local authentication
- device binding
- secure credential/key storage
- explicit authorization
- no plaintext passwords
- no credential exposure to the LLM
- no arbitrary remote unlock command
- auditability
- fail-closed behavior

Do not implement unsafe credential automation merely to satisfy a demo.

---

## 3.11 Application and file management

BrainOS should eventually understand the user's computer environment well enough to perform authorized operations such as:

- opening applications
- opening files
- locating files
- organizing files
- launching workflows
- reading authorized local content
- creating files
- moving/renaming files
- starting browser workflows

These operations belong in the **local agent/action layer**, not in the backend controller layer.

---

## 3.12 Browser automation

Eventually BrainOS may operate an authorized browser session.

Target examples:

```text
"Open the website."

"Search for this."

"Fill this form."

"Download the report."

"Find the information I need."
```

Browser automation must use scoped permissions and confirmation for consequential actions such as purchases, account changes, or submissions.

---

## 3.13 Voice

Eventually BrainOS should support natural voice interaction.

Target architecture:

```text
Voice input
 ↓
Speech-to-text
 ↓
BrainOS Assistant
 ↓
Memory / RAG / Tools
 ↓
Action
 ↓
Text response
 ↓
Text-to-speech
```

Voice should be an interface over the same BrainOS orchestration layer rather than a separate brain.

---

## 3.14 Proactive assistant

The mature system should not only wait for commands.

It should proactively surface useful information when appropriate.

Examples:

```text
"You have a deadline tomorrow."

"You have three overdue tasks."

"You have an email that needs a reply."

"You have a meeting in 30 minutes."

"This document is related to your current task."

"You usually do this task on Friday."
```

Proactive behavior must be:

- configurable
- explainable
- privacy-preserving
- rate-limited
- non-annoying
- user-controlled
- based on reliable signals

---

## 3.15 Automation engine

Eventually BrainOS should support rules/workflows such as:

```text
WHEN condition
IF condition
THEN action
```

Examples:

```text
When an important email arrives → create a task.

When a deadline is approaching → remind me.

Every Monday → prepare my weekly plan.

When I receive a message while offline → draft/handle it according to my rules.

When a document is uploaded → process and index it.
```

Automation must have:

- trigger definitions
- conditions
- actions
- schedules
- execution history
- retries
- failure handling
- permissions
- cancellation
- observability
- idempotency where necessary

---

# 4. PRODUCT PRINCIPLES

BrainOS is a one-user-first product.

Prioritize usefulness for the primary user before:

- SaaS billing
- public marketplace
- enterprise RBAC
- organization complexity
- public social features
- unnecessary multi-tenancy

The project should remain:

- private
- modular
- maintainable
- affordable
- testable
- provider-independent
- secure
- incrementally extensible

---

# 5. SECURITY PRINCIPLES

Security is especially important because BrainOS will eventually be able to act on the user's computer and external accounts.

Rules:

- Clerk owns authentication.
- Never trust client-supplied ownership IDs.
- Derive ownership from authenticated context.
- Keep secrets out of logs and Git.
- Keep credentials away from LLM prompts.
- Use least-privilege tool permissions.
- Separate planning from execution.
- Require confirmation for high-impact actions.
- Keep external integrations behind provider interfaces.
- Keep local computer control behind an authenticated local agent.
- Fail closed when authorization is uncertain.
- Maintain auditable action records without storing sensitive secrets.

Sensitive actions include, but are not limited to:

- unlocking devices
- sending messages automatically
- sending email
- deleting data
- changing accounts
- purchases/payments
- security settings
- destructive file operations

---

# 6. ENGINEERING ARCHITECTURE

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

External providers stay behind interfaces.

Tools call services rather than embedding business logic.

The assistant orchestrator decides when tools are needed.

The local computer agent is a separate security boundary.

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

AI:

- Ollama-first during development

Embeddings:

- Ollama
- pgvector

Database:

- PostgreSQL
- Prisma
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

Logging:

- centralized logger abstraction

**Supabase is NOT part of the current BrainOS architecture.**

---

# 8. DEVELOPMENT CONSTRAINTS

Target development cost:

**approximately $0–$5/month where practical.**

Prefer existing/free/student resources when appropriate.

Do not add paid AI APIs merely for testing unless explicitly requested.

Development environment:

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

---

# 9. VERIFIED IMPLEMENTATION HISTORY

The following foundations are already completed and must not be restarted:

```text
Authenticated Semantic Memory — COMPLETE
Memory Production Hardening — COMPLETE
Memory Regression/Test DB Safety — COMPLETE
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
Assistant → real create_task tool execution verification — COMPLETE

Reminder repository/service — COMPLETE
Reminder scheduler — COMPLETE
Reminder worker — COMPLETE
Reminder delivery-provider boundary — COMPLETE
```

---

# 10. CURRENT VERIFIED CHECKPOINT

Latest verified Git state from the active development session:

```text
af078eb test(assistant): verify task tool execution
293ade9 feat(reminders): add reminder processing worker
f1ccda1 feat(documents): automate document processing pipeline
f6c3b96 feat(assistant): integrate document retrieval context
fdb8608 feat(documents): add semantic search API
bf0429a feat(documents): add semantic retrieval
616f8b7 feat(documents): add chunk embeddings
3ce8f72 feat(documents): persist document chunks
3df64b1 feat(documents): add document processing foundation
386faaa feat(documents): add document chunking foundation
8388bac feat(documents): add PDF ingestion
31ffd1d feat(documents): add plain-text upload ingestion
```

Verified Git state at the latest checkpoint:

```text
Branch: main
origin/main: af078eb
Working tree: clean
```

Do not claim any later state unless it is verified from the repository.

---

# 11. CURRENT TEST VERIFICATION

Latest broad regression verified during the active development session:

```text
32 test files passed
296 tests passed
0 failures
```

Also verified:

```text
TypeScript: PASS
Prettier: PASS
git diff --check: PASS
```

The existing Vite warning:

```text
configLoader: 'native'
```

is non-blocking.

Windows Git may report:

```text
LF will be replaced by CRLF
```

This is a line-ending warning, not a functional failure.

---

# 12. CURRENT ARCHITECTURAL MILESTONE

The most important verified assistant tool path is:

```text
LLM
 ↓
AssistantService
 ↓
ToolExecutor
 ↓
ToolRegistry
 ↓
create_task
 ↓
TaskService
 ↓
TaskRepository
```

The authenticated user ID is propagated into the task operation.

The real task registry has been tested rather than relying only on a fake executor.

This pattern should be reused for future tools.

---

# 13. CURRENT PHASE

**Phase 19 — Tasks / Reminders / Automation**

Phase 19 is substantially implemented, but the broader automation acceptance criteria are not yet declared complete.

Do not declare Phase 19 complete until the remaining acceptance criteria are explicitly implemented and verified.

---

# 14. PHASE 19 REMAINING WORK

Potential remaining Phase 19 work includes:

```text
[ ] richer task lifecycle if required
[ ] richer due-date / schedule handling
[ ] recurring tasks/reminders
[ ] automation rule engine
[ ] automation execution history
[ ] retry/idempotency behavior where required
[ ] proactive reminder behavior
[ ] user-facing task/reminder API/UI where required
[ ] complete reminder delivery integration
[ ] final Phase 19 acceptance verification
```

Do not implement all of these at once.

Define one small milestone at a time.

---

# 15. NEXT MAJOR ROADMAP

The project should evolve in controlled layers.

```text
FOUNDATION
    ↓
MEMORY
    ↓
AI ORCHESTRATION
    ↓
CONVERSATION
    ↓
TASKS
    ↓
REMINDERS
    ↓
AUTOMATION
    ↓
DOCUMENTS / RAG
    ↓
COMPUTER AGENT
    ↓
CALENDAR
    ↓
EMAIL
    ↓
WHATSAPP / MESSAGING
    ↓
VOICE
    ↓
PROACTIVE ASSISTANT
    ↓
ADVANCED AGENT WORKFLOWS
```

These are product milestones, not a promise that every capability will be implemented immediately or in exactly this order.

---

# 16. COMPUTER AGENT ROADMAP

The computer-control subsystem should be designed separately from the backend.

Future architecture:

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

Milestones:

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
12. Secure device-bound capabilities
```

Computer unlock is intentionally later and must receive a dedicated security design before implementation.

---

# 17. INTEGRATION ROADMAP

External integrations should use provider interfaces.

## Calendar

```text
CalendarProvider
 ├── Google Calendar
 └── Other supported provider(s)
```

## Email

```text
EmailProvider
 ├── Gmail
 └── Other supported provider(s)
```

## Messaging

```text
MessagingProvider
 └── WhatsApp / supported provider
```

The exact provider should be chosen when implementation begins based on API support, privacy, reliability, platform rules, and cost.

---

# 18. VOICE ROADMAP

Voice is an interface, not a separate assistant brain.

```text
Microphone
 ↓
Speech-to-text
 ↓
BrainOS Assistant
 ↓
Memory / RAG / Tools
 ↓
Action
 ↓
Text-to-speech
 ↓
Speaker
```

The same authorization and tool system must apply to voice requests.

---

# 19. PROACTIVE AGENT ROADMAP

Eventually BrainOS should monitor authorized signals and surface useful actions.

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

- notify
- remind
- summarize
- suggest
- create task
- draft response
- request confirmation
- execute an authorized low-risk workflow

Proactive behavior must never become uncontrolled background autonomy.

---

# 20. RAG / KNOWLEDGE QUALITY ROADMAP

After the current document pipeline is proven, improve retrieval quality with:

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

Do not optimize retrieval before proving the end-to-end path.

---

# 21. TESTING PHILOSOPHY

A feature is not complete because code exists or TypeScript compiles.

Definition of Done:

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
Full regression
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

Actual behavior must be verified.

---

# 22. DATABASE / MIGRATION RULES

Once a Prisma migration is applied:

```text
DO NOT edit migration.sql
DO NOT rename the migration directory
DO NOT delete the migration
DO NOT recreate an applied migration under another timestamp
```

For schema changes:

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

---

# 23. FUTURE ACCEPTANCE EXAMPLES

Eventually these should work through the same BrainOS assistant architecture:

```text
"Remember that BrainOS uses PostgreSQL."

"What did I decide about the document pipeline?"

"Create a task to finish the assistant API."

"Remind me tomorrow at 9."

"Plan my week."

"Check my calendar."

"Summarize my important emails."

"Draft a reply to this message."

"Open VS Code."

"Open my BrainOS project."

"Find the PDF I downloaded."

"Prepare my study environment."

"Remind me if I have not completed the task."

"Every Monday, prepare my weekly plan."
```

High-impact actions should require appropriate confirmation/authorization.

---

# 24. FINAL PROJECT STATEMENT

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
- provides proactive assistance
- eventually supports voice
- eventually acts appropriately with user control

The technical foundation is deliberately being built before broad autonomous behavior.

Ultimate mission:

> Build a private personal AI assistant that knows the user's authorized context, can remember and retrieve useful information, understand documents, manage tasks and time, assist with email and messaging, control the user's computer through a secure local agent, automate repetitive workflows, communicate naturally through text and voice, and provide proactive assistance — while remaining secure, private, modular, affordable, maintainable, and under the user's control.

# END OF BRAINOS MASTER PROJECT CONTEXT
