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

If this context and the repository disagree, inspect the repository and resolve the difference before coding.

---

# 1. BRAINOS MISSION

BrainOS is a **private personal AI operating system**, not merely a chatbot.

The long-term goal is an AI assistant that understands the user's personal context and helps manage information, work, study, communication, and computer-based activities while remaining private, secure, modular, affordable, maintainable, and under the user's control.

## North-star idea

> BrainOS should become a private second brain and personal operating system that reduces cognitive load.

The eventual assistant should feel like:

> "My assistant knows my context and helps me manage my life, work, study, communication, and computer."

Not:

> "A chatbot with a database attached."

---

# 2. LONG-TERM PRODUCT VISION

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

Core loop:

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

## 3.1 Personal memory

- remember important user information
- store preferences and facts when appropriate
- retrieve relevant memories
- maintain authenticated ownership/isolation
- use memory to personalize responses
- allow the user to control what is remembered

## 3.2 Knowledge and documents

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

## 3.3 Tasks

BrainOS should manage structured tasks:

```text
"Create a task to finish the API."
"Show my overdue tasks."
"Complete the task."
"Move this task to tomorrow."
```

Task operations remain authenticated and user-owned.

## 3.4 Reminders and alarms

Target capabilities:

- one-time reminders
- scheduled reminders
- recurring reminders
- alarm-like notifications
- reminder delivery
- failure/retry handling
- cancellation
- proactive reminders

## 3.5 Planning and scheduling

Target capabilities:

- task planning
- daily planning
- weekly planning
- calendar awareness
- deadline awareness
- schedule conflict detection
- prioritization
- time-aware recommendations

## 3.6 Calendar integration

Eventually integrate with a calendar provider for:

- reading events
- creating/updating/canceling events
- conflict detection
- availability-aware planning
- combining tasks, reminders, and calendar

Calendar access must use authenticated provider integrations and explicit user authorization.

## 3.7 Email management

Eventually support:

- email summaries/search
- importance detection
- draft replies
- authorized sending
- follow-up tasks
- reminders
- deadline detection
- connections to tasks/documents/calendar

External sending is a side effect and requires appropriate authorization/confirmation.

## 3.8 WhatsApp / messaging integration

Eventually support authorized messaging workflows:

- read authorized incoming messages
- summarize conversations
- identify messages requiring attention
- draft replies
- send authorized replies
- create tasks/reminders
- maintain context where permitted

BrainOS must not silently impersonate the user.

## 3.9 Local computer control

A local BrainOS Windows agent is required for computer control.

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

The local agent must enforce authentication, permissions, least privilege, secure transport, action controls, and safe logging.

## 3.10 Computer unlock / lock

Computer unlock is a **high-security capability**.

Requirements:

- strong local authentication
- device binding
- secure credential/key storage
- explicit authorization
- no plaintext passwords
- no credential exposure to the LLM
- no arbitrary remote unlock command
- auditability
- fail-closed behavior

Do not bypass Windows security controls.

## 3.11 Application and file management

Future authorized operations include:

- opening applications
- opening/finding files
- organizing files
- launching workflows
- reading authorized local content
- creating files
- moving/renaming files

These belong in the local agent/action layer.

## 3.12 Browser automation

Future authorized browser capabilities include:

```text
"Open the website."
"Search for this."
"Fill this form."
"Download the report."
"Find the information I need."
```

Consequential actions such as purchases, account changes, and submissions require appropriate confirmation.

## 3.13 Voice

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

Voice should use the same orchestration, authorization, and tool system.

## 3.14 Proactive assistant

Eventually surface useful information such as:

```text
"You have a deadline tomorrow."
"You have three overdue tasks."
"You have an email that needs a reply."
"You have a meeting in 30 minutes."
```

Proactive behavior must be configurable, explainable, privacy-preserving, rate-limited, non-annoying, user-controlled, and based on reliable signals.

## 3.15 Automation engine

BrainOS should support:

```text
WHEN condition
IF condition
THEN action
```

Automation must have:

- triggers
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

Prioritize usefulness before:

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

Sensitive actions include:

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

Do not add paid AI APIs merely for testing unless explicitly requested.

---

# 9. VERIFIED IMPLEMENTATION HISTORY

Already completed; do not restart:

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

Automation API/backend engine — COMPLETE for implemented scope
Automation dashboard UI — COMPLETE for implemented scope
Automation create/pause/resume/delete flow — VERIFIED
Scheduled CREATE_TASK automation execution — VERIFIED
TASK_DUE → CREATE_TASK execution — VERIFIED
Future due-date TASK_DUE behavior — VERIFIED
TASK_DUE duplicate-execution protection — VERIFIED
Real Task creation from automation — VERIFIED
AutomationExecution success recording — VERIFIED
```

---

# 10. CURRENT VERIFIED GIT CHECKPOINT

Previously committed checkpoint:

```text
6a04c89 feat(web): add automation dashboard
44fcdf4 feat: add automation API routes
df407db feat: add automation engine
db2ba9e docs(context): update BrainOS project roadmap
af078eb test(assistant): verify task tool execution
293ade9 feat(reminders): add reminder processing worker
f1ccda1 feat(documents): automate document processing pipeline
f6c3b96 feat(assistant): integrate document retrieval context
fdb8608 feat(documents): add semantic search API
bf0429a feat(documents): add semantic retrieval
616f8b7 feat(documents): add chunk embeddings
```

Current repository checkpoint before the final Phase 19 commit:

```text
Branch:
main

HEAD:
6a04c89

origin/main:
6a04c89

Working tree:
modified, with intentional Phase 19 recurring-automation changes
```

Current intentional modified files:

```text
BrainOS_Master_Project_Context.md
apps/backend/src/services/automation/automation.service.ts
apps/web/app/dashboard/automations/page.tsx
```

The recurring-automation implementation was added after the previously committed
`6a04c89` checkpoint and has not yet been committed.

Do not discard these changes.

Before committing:

```text
git status
git diff --name-only
git diff --stat
git diff --check
```

After committing and pushing, verify:

```text
git status
git branch --show-current
git log --oneline -10
git remote -v
```

The final Phase 19 checkpoint must have a clean working tree and local `main`
synchronized with `origin/main`.

# 11. CURRENT TEST / VALIDATION STATUS

## Focused automation regression

Verified on 2026-08-28:

```text
Test Files: 4 passed (4)
Tests:      32 passed (32)
Failures:   0
```

Focused files:

```text
test/services/automation/automation.scheduler.test.ts
test/services/automation/automation.recurrence.test.ts
test/services/automation/execution/automation.worker.test.ts
test/services/automation/repositories/automation.repository.test.ts
```

Breakdown:

```text
Automation scheduler tests:       6/6   PASS
Automation recurrence tests:     6/6   PASS
Automation worker tests:        12/12   PASS
Automation repository tests:     8/8   PASS
```

Recurrence coverage includes:

```text
DAILY next-run calculation
DAILY upcoming same-day calculation
WEEKLY next-run calculation
invalid hour rejection
invalid weekday rejection
invalid date rejection
recurring worker rescheduling
invalid recurrence failure handling
```

## Full backend regression

Verified on 2026-08-28:

```text
Test Files: 37 passed (37)
Tests:      343 passed (343)
Failures:   0
```

This confirms the recurring automation changes did not introduce a backend
regression.

## Backend TypeScript

Verified:

```text
npm --prefix .\apps\backend run typecheck
PASS
```

## Web production build

Verified:

```text
npm --prefix .\apps\web run build
PASS
```

Routes included:

```text
○ /
○ /_not-found
○ /dashboard
○ /dashboard/automations
ƒ /dashboard/memory-test
ƒ /sign-in/[[...sign-in]]
ƒ /sign-up/[[...sign-in]]
ƒ Proxy (Middleware)
```

Non-blocking warnings:

```text
Next.js ignored package-lock.json in D:\Project because it is outside
the current Git repository (D:\Project\BrainOS).

The "middleware" file convention is deprecated. Use "proxy" in a future
Next.js migration.
```

## Git integrity

Verified:

```text
git diff --check
PASS
```

Windows LF/CRLF warnings are non-blocking.

## Root npm test note

Running:

```text
npm test -- ...
```

from the repository root does not execute BrainOS tests because the root
package has no test implementation and returns:

```text
Error: no test specified
```

The correct backend test command is:

```text
npm --prefix .\apps\backend run test:run
```

## Backend lint

The backend package currently has no `lint` script.

Do not claim backend lint passed until a real lint script exists and succeeds.

## Behavioral verification already completed before the current recurrence work

Previously verified and should not be unnecessarily repeated:

```text
SCHEDULE → CREATE_TASK
TASK_DUE → CREATE_TASK
future TASK_DUE does not fire early
TASK_DUE fires after due time
successful execution is recorded
one-time automation does not repeatedly execute
real Task record is created
TASK_DUE duplicate protection
```

The current recurrence work is covered by focused automated tests and the full
backend regression above.

A separate manual multi-run recurring automation against the live scheduler and
database was not recorded in this checkpoint. Do not claim that manual E2E
scenario as verified unless it is actually performed.

# 12. CURRENT ASSISTANT TOOL ARCHITECTURE

Verified path:

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

The authenticated user ID is propagated into task operations.

The real task registry has been tested.

Reuse this pattern for future tools.

---

# 13. CURRENT AUTOMATION ARCHITECTURE

Relevant backend files:

```text
apps/backend/src/services/automation/automation.recurrence.ts
apps/backend/src/services/automation/automation.runtime.ts
apps/backend/src/services/automation/automation.scheduler.ts
apps/backend/src/services/automation/automation.service.ts
apps/backend/src/services/automation/automation.types.ts
apps/backend/src/services/automation/execution/automation.worker.ts
apps/backend/src/services/automation/repositories/automation-execution.repository.ts
apps/backend/src/services/automation/repositories/automation.repository.ts
```

Automation execution repository supports:

```text
createRunning(...)
markSucceeded(...)
markFailed(...)
```

Automation repository also supports atomic due-claiming and recurring
rescheduling.

Database enums:

```text
AutomationStatus:
  ACTIVE
  PAUSED
  COMPLETED
  FAILED

AutomationTriggerType:
  SCHEDULE
  TASK_DUE
  REMINDER_DUE

AutomationActionType:
  CREATE_TASK
  CREATE_REMINDER

AutomationExecutionStatus:
  RUNNING
  SUCCEEDED
  FAILED
```

Automation model includes:

```text
id
userId
name
status
triggerType
actionType
config
nextRunAt
lastRunAt
claimedAt
executions
createdAt
updatedAt
deletedAt
```

Recurring schedules are represented inside `config.recurrence`.
Current supported recurrence types are:

```text
DAILY
WEEKLY
```

The scheduler/worker architecture remains:

```text
AutomationScheduler
        ↓
AutomationWorker
        ↓
find due automations
        ↓
claim automation
        ↓
create execution
        ↓
execute action
        ↓
success:
  recurring → calculate next occurrence → reschedule
  one-time  → mark completed
```

# 14. AUTOMATION SCHEDULER

Current polling interval:

```text
DEFAULT_INTERVAL_MS = 30_000
```

The scheduler checks approximately every 30 seconds.

Flow:

```text
start()
 ↓
runOnce()
 ↓
processDueAutomations()
 ↓
processTaskDueAutomations()
```

The scheduler prevents overlapping runs using a `running` guard.

Architecture:

```text
AutomationScheduler
        ↓
AutomationWorker
        ↓
processDueAutomations()
        +
processTaskDueAutomations()
```

Scheduler unit tests cover:

```text
immediate execution on start
duplicate start prevention
overlap prevention
stop behavior
minimum interval validation
both worker paths
```

The scheduler has been behaviorally verified for the existing TASK_DUE path.
Recurring execution is driven by the same scheduler → worker path.

# 15. AUTOMATION RECURRENCE

Current recurrence helper supports:

```text
DAILY
WEEKLY
```

with:

```text
DAILY:
  hour
  minute

WEEKLY:
  dayOfWeek
  hour
  minute
```

Validation:

```text
valid Date
hour 0–23
minute 0–59
dayOfWeek 0–6
```

Current recurrence calculation uses JavaScript `Date` local-time setters.

Current tested behavior:

```text
daily schedule after today's time
daily schedule later today
weekly schedule
invalid hour rejection
invalid weekday rejection
invalid date rejection
```

Recurring worker behavior:

```text
due recurring automation
 ↓
claim
 ↓
execute action
 ↓
execution SUCCEEDED
 ↓
calculate next occurrence
 ↓
reschedule ACTIVE automation
```

Atomic rescheduling requires the automation to remain active and to have a
claimed state represented by `nextRunAt = null`.

Future recurrence work should explicitly consider:

- timezone ownership
- daylight-saving transitions
- user-local scheduling
- missed schedules
- recurring action semantics
- idempotency
- manual multi-run live scheduler verification

# 16. AUTOMATION SERVICE

`AutomationService` provides:

```text
createAutomation
listAutomations
getAutomation
updateAutomation
pauseAutomation
resumeAutomation
deleteAutomation
```

Validation includes:

```text
userId
automation ID
name
trigger type
action type
config
nextRunAt
```

For `TASK_DUE`:

```text
config.taskId
```

is required and trimmed before persistence.

Completed automations cannot retain a future `nextRunAt`.

Authorization is based on the authenticated user.

---

# 17. AUTOMATION API / WEB IMPLEMENTATION

Frontend API wrapper:

```text
apps/web/lib/brainos-api.ts
```

supports:

```text
createAutomation
listAutomations
getAutomation
updateAutomation
pauseAutomation
resumeAutomation
deleteAutomation
```

Dashboard entry:

```text
apps/web/app/dashboard/page.tsx
```

Automation dashboard:

```text
apps/web/app/dashboard/automations/page.tsx
```

Dashboard currently supports:

- authenticated automation listing
- automation creation
- schedule trigger selection
- task-due trigger selection
- create-task action
- create-reminder action
- task title/configuration
- task description/configuration
- task due date/configuration
- reminder message/configuration
- reminder scheduling/configuration
- one-time schedule selection
- daily recurrence selection
- weekly recurrence selection
- recurrence time selection
- weekly recurrence day selection
- first-run display for recurring schedules
- recurrence display in automation listings
- pause
- resume
- delete
- refresh
- success/error feedback
- status display
- next-run display
- last-run display

Recurring schedule configuration is stored in `config.recurrence`:

```text
DAILY:
{
  type: "DAILY",
  hour,
  minute
}

WEEKLY:
{
  type: "WEEKLY",
  dayOfWeek,
  hour,
  minute
}
```

The first run is explicitly supplied by the dashboard. After a successful
recurring execution, the backend calculates the next occurrence automatically.

The dashboard uses the authenticated Clerk token.

Client ownership IDs are not used to establish authorization.

# 18. VERIFIED AUTOMATION BEHAVIOR

## 18.1 SCHEDULE → CREATE_TASK

Verified flow:

```text
Create scheduled automation
 ↓
Automation appears in dashboard
 ↓
Automation stored in PostgreSQL
 ↓
Scheduler sees active automation
 ↓
Worker claims due automation
 ↓
AutomationExecution created
 ↓
CREATE_TASK action runs
 ↓
TaskService / TaskRepository creates real Task
 ↓
AutomationExecution = SUCCEEDED
 ↓
Automation = COMPLETED
 ↓
nextRunAt = null
```

A real scheduled automation was tested:

```text
Name:
Test task creation

Trigger:
SCHEDULE

Action:
CREATE_TASK

Task title:
Buy groceries

Task description:
Milk and bread
```

Database verification:

```text
Automation:
status = COMPLETED
triggerType = SCHEDULE
actionType = CREATE_TASK
nextRunAt = null
```

Resulting task:

```text
title = Buy groceries
description = Milk and bread
status = TODO
priority = MEDIUM
```

This proves the scheduled automation path creates a real task.

---

# 19. VERIFIED TASK_DUE → CREATE_TASK

Fully tested end-to-end.

Flow:

```text
Source Task
    ↓
dueAt reached
    ↓
AutomationScheduler
    ↓
AutomationWorker.processTaskDueAutomations()
    ↓
TASK_DUE automation matched
    ↓
AutomationExecution created
    ↓
CREATE_TASK action
    ↓
TaskService
    ↓
TaskRepository
    ↓
New Task created
    ↓
AutomationExecution = SUCCEEDED
    ↓
Automation = COMPLETED
```

Example source due time:

```text
2026-08-28T10:05:00.000Z
```

Local UTC+5 development time:

```text
3:05 PM
```

Observed execution:

```text
scheduled due:
2026-08-28T10:05:00.000Z

execution:
2026-08-28T10:05:04.790Z
```

The resulting follow-up task was created successfully.

Example description:

```text
Created by TASK_DUE automation
```

Final states:

```text
Automation:
COMPLETED

AutomationExecution:
SUCCEEDED
```

---

# 20. VERIFIED TASK_DUE FUTURE-DATE BEHAVIOR

Separate future-due test:

```text
Source task:
TASK_DUE future test
```

Due time:

```text
2026-08-28T10:05:00.000Z
```

Equivalent local time:

```text
3:05 PM
```

Before due time:

```text
Task:
TODO

Automation:
ACTIVE

No follow-up task:
YES
```

After due time:

```text
Automation:
COMPLETED

AutomationExecution:
SUCCEEDED

Follow-up task:
CREATED
```

This confirms the TASK_DUE automation did not fire before the configured due time and did fire after the due time.

---

# 21. VERIFIED TASK_DUE DUPLICATE PROTECTION

The TASK_DUE automation was observed after successful execution while the scheduler continued polling for approximately 1–2 minutes.

Expected:

```text
One execution
One follow-up task
Automation completed
No repeated execution
```

Observed:

```text
AutomationExecution:
one successful execution

Follow-up task:
one created task

Automation:
COMPLETED
```

No duplicate follow-up task was created.

Therefore the current one-time TASK_DUE execution path has passed manual duplicate-execution verification.

---

# 22. AUTOMATION EXECUTION STATE

Verified lifecycle:

```text
RUNNING
   ↓
SUCCEEDED
```

or:

```text
RUNNING
   ↓
FAILED
```

Successful one-time automation:

```text
ACTIVE
 ↓
claimed
 ↓
execution RUNNING
 ↓
action succeeds
 ↓
execution SUCCEEDED
 ↓
automation COMPLETED
 ↓
nextRunAt null
```

A previous failed automation test existed during debugging. That historical failure is not evidence of a current system-wide failure.

Later SCHEDULE and TASK_DUE tests succeeded.

---

# 23. AUTOMATION API CRUD VERIFICATION

Verified:

```text
CREATE
LIST
PAUSE
RESUME
DELETE / soft delete
```

Dashboard status updates correctly.

API requests are authenticated.

Backend validates user ownership and automation identifiers.

---

# 24. AUTOMATION MILESTONE STATUS

## Phase 19 — Tasks / Reminders / Automation

```text
Task foundation                         COMPLETE
Reminder foundation                     COMPLETE
Automation backend foundation           COMPLETE
Automation API routes                   COMPLETE
Automation dashboard                    COMPLETE
Automation CRUD                         VERIFIED
Automation pause/resume                 VERIFIED
Scheduled CREATE_TASK execution         VERIFIED
Real Task creation from automation      VERIFIED
TASK_DUE trigger                        VERIFIED
TASK_DUE future-date behavior           VERIFIED
TASK_DUE duplicate protection            VERIFIED
AutomationExecution success recording   VERIFIED

Recurring automation:
DAILY recurrence calculation             VERIFIED
WEEKLY recurrence calculation            VERIFIED
Recurrence validation                    VERIFIED
Recurring worker rescheduling            VERIFIED
Recurring scheduler path                 IMPLEMENTED
Recurring dashboard UI                   BUILD VERIFIED

Focused automation tests                 32/32 PASS
Full backend regression                  343/343 PASS
Backend TypeScript                       PASS
Web production build                     PASS
git diff --check                         PASS
```

### Automation testing milestone

The original one-time automation milestone remains behaviorally verified.

The newly added recurring automation scope is implemented and covered by
focused automated tests and full backend regression.

Do not claim a separate manual live multi-run recurring E2E test unless it is
actually performed and recorded.

Previously verified one-time tests should not be restarted unless a future
code change could affect them.

# 25. PHASE 19 COMPLETION NOTE

Phase 19 has completed its implemented Tasks / Reminders / Automation scope.

The current automation implementation includes:

```text
one-time SCHEDULE automations
TASK_DUE automations
CREATE_TASK actions
CREATE_REMINDER actions
automation CRUD
pause/resume
execution history
claiming / duplicate protection
DAILY recurrence
WEEKLY recurrence
automatic next-run calculation
recurring rescheduling
recurring dashboard configuration
```

Current verification:

```text
Focused automation tests: 32/32 PASS
Full backend regression: 343/343 PASS
Backend typecheck: PASS
Web production build: PASS
git diff --check: PASS
```

The existing one-time SCHEDULE and TASK_DUE paths have also been manually
verified end-to-end in earlier Phase 19 work.

A separate manual live multi-run recurring scheduler/database test is not
recorded in this checkpoint. Therefore, future work must not describe that
specific live E2E scenario as already proven.

Future enhancements remain:

```text
recurring reminders
richer conditions
advanced workflow composition
retry policies
advanced idempotency
richer execution history UI
proactive assistant behavior
additional trigger/action types
timezone-aware recurrence
missed-schedule policy
```

Treat these as future focused milestones rather than reasons to rewrite the
current automation architecture.

# 26. IMPORTANT CURRENT LIMITATIONS

The current automation dashboard is a first usable implementation, not the
final autonomous workflow builder.

Current trigger enum:

```text
SCHEDULE
TASK_DUE
REMINDER_DUE
```

Current action enum:

```text
CREATE_TASK
CREATE_REMINDER
```

Current recurring schedule types:

```text
DAILY
WEEKLY
```

Current recurrence uses JavaScript local-time date calculations.

The dashboard requires the first run time for recurring schedules.

The backend calculates the next occurrence after each successful recurring
execution.

The current TASK_DUE flow is verified.

The current SCHEDULE → CREATE_TASK flow is verified.

The presence of:

```text
REMINDER_DUE
CREATE_REMINDER
```

does not automatically mean their complete end-to-end behavior has been
verified in the latest session.

A manual live multi-run recurring scheduler/database scenario has not been
recorded as verified in this checkpoint.

Future work should preserve the current service/repository/worker architecture
and explicitly define timezone, missed-schedule, idempotency, and recurring
action semantics before expanding recurrence behavior.

# 27. NEXT MAJOR ROADMAP

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

# 28. COMPUTER AGENT ROADMAP

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

Computer unlock is intentionally later and requires a dedicated security design.

---

# 29. INTEGRATION ROADMAP

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

Choose exact providers when implementation begins based on API support, privacy, reliability, platform rules, and cost.

---

# 30. VOICE ROADMAP

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

# 31. PROACTIVE AGENT ROADMAP

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

# 32. RAG / KNOWLEDGE QUALITY ROADMAP

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

# 33. TESTING PHILOSOPHY

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

# 34. DATABASE / MIGRATION RULES

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

# 35. FUTURE ACCEPTANCE EXAMPLES

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

# 36. CURRENT DEVELOPMENT CHECKPOINT SUMMARY

```text
Repository:
D:\Project\BrainOS

Branch:
main

Committed HEAD:
6a04c89 feat(web): add automation dashboard

origin/main:
6a04c89

Current working tree:
3 intentional modified files

Modified files:
BrainOS_Master_Project_Context.md
apps/backend/src/services/automation/automation.service.ts
apps/web/app/dashboard/automations/page.tsx
```

Current feature state:

```text
Tasks:
COMPLETE

Reminders:
COMPLETE

Automation:
COMPLETE for implemented scope

Recurring automation:
IMPLEMENTED

Daily recurrence:
TESTED

Weekly recurrence:
TESTED

Recurring worker rescheduling:
TESTED

Automation dashboard recurrence UI:
BUILD VERIFIED
```

Current validation:

```text
Focused automation tests:
32/32 PASS

Full backend regression:
37/37 test files
343/343 tests
0 failures

Backend TypeScript:
PASS

Web production build:
PASS

git diff --check:
PASS
```

Previously verified behavioral automation paths:

```text
SCHEDULE → CREATE_TASK:
verified end-to-end

TASK_DUE → CREATE_TASK:
verified end-to-end

future TASK_DUE does not fire early:
verified

TASK_DUE fires after due time:
verified

TASK_DUE duplicate protection:
verified

real Task creation:
verified

AutomationExecution success:
verified
```

Current recurring limitation:

```text
No separate manual live multi-run recurring scheduler/database E2E
verification has been recorded yet.
```

This limitation must not be silently converted into a "verified" claim.

The next immediate repository action is to review the final diff, commit the
intentional recurring automation changes, push them, and verify a clean
working tree.

After the final Phase 19 commit is clean and synchronized with origin, the
next major development milestone is:

```text
Phase 20 — Documents / Knowledge / RAG
```

# 37. NEXT CHAT INSTRUCTION

The next development chat should start from the final Phase 19 Git checkpoint.

Before changing code:

```text
cd D:\Project\BrainOS

git status
git branch --show-current
git log --oneline -10
git remote -v
```

The intended Phase 19 recurring-automation changes are:

```text
apps/backend/src/services/automation/automation.service.ts
apps/web/app/dashboard/automations/page.tsx
```

plus this context document.

The current focused and full backend tests are already green:

```text
Automation focused:
32/32 PASS

Full backend:
343/343 PASS
```

Backend typecheck and web production build are also passing.

Do not restart the previously verified one-time TASK_DUE/SCHEDULE behavioral
tests unless a future code change could affect them.

Before declaring the repository ready for Phase 20:

```text
git diff --check
git diff --stat
git diff
git add <intentional files>
git commit
git push origin main
git status
git log --oneline -10
```

The final Git state must be:

```text
branch:
main

working tree:
clean

local main:
same as origin/main
```

Then begin:

```text
Phase 20 — Documents / Knowledge / RAG
```

Use the normal BrainOS workflow:

```text
requirements
 ↓
repository inspection
 ↓
architecture decision
 ↓
small implementation
 ↓
focused testing
 ↓
TypeScript
 ↓
behavioral verification
 ↓
full regression
 ↓
context update
 ↓
Git review
 ↓
commit
 ↓
push
 ↓
final Git verification
```

Do not assume the old roadmap is sufficient. Reconcile the Phase 20 plan with
the actual repository before coding.

# 38. FINAL PROJECT STATEMENT

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
