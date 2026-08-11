BrainOS --- Phase 9 Handoff Context

Phase: 9 --- Clerk Webhooks & PostgreSQL User SynchronizationStatus: Completed through Phase 9.4Purpose: This document is the continuation context for the nextBrainOS development chat. Do not restart previous setup. Continue fromPhase 10.

1. Project Mission

BrainOS is being built as a production-quality AI Operating System, notmerely a chatbot.

Core architectural goals:

Replaceable AI providers.

Replaceable authentication providers.

Replaceable database providers.

PostgreSQL as the source of truth for BrainOS application data.

Clean separation between transport, business logic, integrations,and persistence.

Every completed phase ends with testing and a Git commit.

Development should follow production engineering practices ratherthan quick hacks.

2. Current Technology Stack

Monorepo

BrainOS/
├── apps/
│   ├── backend/
│   └── web/
└── ...

Backend

Express

TypeScript

Prisma

PostgreSQL

Clerk Webhooks

Svix for webhook signature verification

ngrok for local webhook tunneling

Backend runs locally on:

http://localhost:3001

Web

Next.js 16

Clerk Authentication

ClerkProvider

Clerk middleware

Sign In

Sign Up

Dashboard

Frontend runs locally on:

http://localhost:3000

3. Important Architecture Decisions

Authentication

Clerk handles authentication only.

The frontend does NOT synchronize users directly with PostgreSQL.

Instead:

Clerk
  ↓
Webhook
  ↓
BrainOS Backend
  ↓
PostgreSQL

Database

PostgreSQL is the source of truth for BrainOS user/application data.

Clerk's user ID is stored as an external identity reference:

User.clerkId

BrainOS uses its own internal:

User.id

as the database primary key.

Migrations

Every database schema change must use Prisma migrations.

Do not manually modify the database schema.

Important Prisma commands learned during Phase 9:

npx prisma migrate dev --name <migration_name>

Schema → Database.

npx prisma db pull

Database → Schema.

Do NOT use db pull casually after editing schema.prisma, because itcan overwrite the schema with the current database structure.

npx prisma validate

Validates Prisma schema configuration.

4. Environment Variables

Current environment organization:

Backend .env

Contains:

CLERK_WEBHOOK_SECRET=

.env.example

Contains placeholders such as:

# PostgreSQL
DATABASE_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

Web .env.local

Contains local development configuration such as:

PORT=3000

NODE_ENV=development

DATABASE_URL="postgresql://..."

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

CLERK_SECRET_KEY=sk_test_...

Never commit real secrets.

5. Phase 9.1 --- Webhook Infrastructure

Completed.

Implemented:

Clerk webhook endpoint.

Svix signature verification.

Required Svix header validation.

ngrok local tunneling.

Webhook secret configuration.

The endpoint used during development was:

/webhooks/clerk

The public URL was provided by ngrok and configured in Clerk.

Important: ngrok URLs can change when restarted, so Clerk's webhookendpoint must use the current URL during local testing.

6. Phase 9.1 Webhook Service

File:

apps/backend/src/services/webhook/clerk.service.ts

Current responsibility:

Read CLERK_WEBHOOK_SECRET.

Create a Svix Webhook.

Verify the raw request body against:

svix-id

svix-timestamp

svix-signature

Return the verified Clerk event.

The service follows the single-responsibility principle.

It does NOT access Prisma.

7. Phase 9.1 Controller

File:

apps/backend/src/controllers/webhook/clerk.controller.ts

The controller was intentionally kept thin.

Current responsibilities:

Read Svix headers.

Reject requests with missing headers.

Verify the webhook through the webhook service.

Dispatch the verified event.

Return an HTTP response.

The controller no longer contains user database logic.

Current conceptual flow:

HTTP Request
    ↓
Controller
    ↓
Webhook Verification
    ↓
Event Dispatcher
    ↓
Handler

8. Phase 9.2 --- User Database Schema

Completed.

The original Phase 8 User model was:

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}

It was expanded for Clerk synchronization.

Current canonical User model

model User {
  id          String   @id @default(cuid())
  clerkId     String   @unique
  email       String   @unique
  firstName   String?
  lastName    String?
  imageUrl    String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
}

The full Prisma schema also contains:

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

9. Prisma Configuration

File:

apps/backend/prisma.config.ts

Current configuration:

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});

10. Prisma Migration History

At the time of Phase 9 work, the project had an initial migration:

apps/backend/prisma/migrations/
└── 20260801153632_init/

A subsequent migration was created for the Clerk user fields.

The migration was successfully applied and Prisma Client wasregenerated.

Successful migration verification included:

Your database is now in sync with your schema.
Generated Prisma Client

11. Important Prisma Debugging Lesson

During Phase 9, prisma db pull was used while diagnosing adatabase/Studio issue.

That command introspected PostgreSQL successfully, but it rewroteschema.prisma back to the database's existing schema.

This demonstrated:

prisma migrate dev
Schema → Database

prisma db pull
Database → Schema

Going forward:

Treat schema.prisma + migrations as the source of truth.

Do not run db pull unless intentionally importing a databaseschema.

12. Phase 9.3 --- Prisma Client Singleton

File:

apps/backend/src/lib/prisma.ts

Purpose:

Create one shared Prisma Client instance.

Avoid repeatedly constructing Prisma clients.

Preserve a global instance during development hot reloads.

Conceptual implementation:

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

Prisma is accessed through this shared client, not by creating newclients inside individual services.

13. Phase 9.3 --- User Service

File:

apps/backend/src/services/user/user.service.ts

Purpose:

Own user persistence/business logic.

Keep Prisma access out of controllers and webhook transport code.

The createUser operation uses upsert:

clerkId exists
    ↓
update user

clerkId does not exist
    ↓
create user

This makes webhook processing idempotent when the same event isdelivered more than once.

The user fields synchronized include:

clerkId

email

firstName

lastName

imageUrl

isActive

14. Clerk Webhook Event Type

File:

apps/backend/src/types/clerk.ts

A TypeScript type was introduced to describe the event shape used by theapplication.

It contains:

event.type

event.data.id

event.data.first_name

event.data.last_name

event.data.image_url

event.data.email_addresses[]

This was added to avoid relying on untyped any throughout thecontroller.

15. Phase 9.3 --- User Created Flow

The user.created event was implemented.

Flow:

User signs up
      ↓
Clerk creates user
      ↓
Clerk sends user.created webhook
      ↓
ngrok
      ↓
Express backend
      ↓
Svix signature verification
      ↓
Clerk event type validation/dispatch
      ↓
user-created handler
      ↓
User service
      ↓
Prisma
      ↓
PostgreSQL

The primary email is checked before persistence.

If no email is present, the handler rejects the operation rather thaninserting an empty email.

16. End-to-End Verification

Phase 9.3 was successfully verified with a real Clerk user.

Prisma Studio showed a user row containing populated fields including:

clerkId

email

firstName

lastName

imageUrl

isActive = true

This proves the full Clerk → webhook → Express → Prisma → PostgreSQLpipeline works.

This is an important milestone and should be treated as a verifiedintegration, not merely code that compiles.

17. Phase 9.4 --- Event Dispatcher

Completed.

The original controller contained:

if (event.type === "user.created") {
   ...
}

This was refactored into a dispatcher architecture so the controllerdoes not accumulate event-specific business logic.

Current structure:

apps/backend/src/
├── handlers/
│   └── clerk/
│       ├── index.ts
│       ├── user-created.handler.ts
│       ├── user-updated.handler.ts
│       └── user-deleted.handler.ts

18. Clerk Event Dispatcher

File:

apps/backend/src/handlers/clerk/index.ts

Conceptual responsibility:

dispatchClerkEvent(event)

Routes:

user.created
    ↓
user-created.handler.ts

user.updated
    ↓
user-updated.handler.ts

user.deleted
    ↓
user-deleted.handler.ts

Unknown event types are currently ignored/logged rather than causing theentire webhook system to fail.

19. User Created Handler

File:

apps/backend/src/handlers/clerk/user-created.handler.ts

Responsibilities:

Extract Clerk user data.

Find the primary email.

Reject the event if no email exists.

Call createUser().

Log successful synchronization.

The handler does not perform raw HTTP handling.

20. User Updated Handler

File:

apps/backend/src/handlers/clerk/user-updated.handler.ts

A handler skeleton was created during Phase 9.4.

Current state:

Created, but real update logic is NOT implemented yet.

It currently logs that user.updated is not implemented.

This must be completed in the next phase/work session.

21. User Deleted Handler

File:

apps/backend/src/handlers/clerk/user-deleted.handler.ts

A handler skeleton was created.

Current state:

Created, but real deletion/soft-delete logic is NOT implemented yet.

It currently logs that user.deleted is not implemented.

The intended database strategy is soft deletion:

isActive = false
deletedAt = current timestamp

rather than immediately deleting the row.

22. Current Controller Architecture

The Clerk controller should now be approximately:

1. Read Svix headers.
2. Validate required headers.
3. Verify webhook.
4. Convert/interpret the verified event as ClerkWebhookEvent.
5. Log event type.
6. Call dispatchClerkEvent(event).
7. Return success.

It should NOT:

Call Prisma directly.

Call createUser directly.

Contain user.created/user.updated/user.deleted business logic.

23. Current Backend Request Flow

POST /webhooks/clerk
        │
        ▼
clerk.controller.ts
        │
        ▼
clerk.service.ts
        │
        ▼
Svix verification
        │
        ▼
ClerkWebhookEvent
        │
        ▼
dispatchClerkEvent()
        │
        ├── user-created.handler.ts
        │          ↓
        │     user.service.ts
        │          ↓
        │       Prisma
        │
        ├── user-updated.handler.ts
        │
        └── user-deleted.handler.ts

24. Phase 9 Completion State

Phase 9 is considered complete at the architectural milestone levelafter Phase 9.4.

Completed:

Webhook infrastructure.

Svix verification.

Clerk → PostgreSQL synchronization.

Prisma migration for Clerk fields.

Prisma client singleton.

User service.

Clerk event type.

User-created handler.

Event dispatcher.

Updated controller architecture.

Real end-to-end user synchronization verification.

Not yet implemented:

Full user.updated persistence logic.

Full user.deleted soft-delete logic.

Centralized environment configuration.

Centralized logger.

Zod runtime validation.

Global error classes/middleware.

More advanced transaction patterns.

Those belong to subsequent backend-core work rather than pretending theyare already complete.

25. Git Checkpoint

The project rule is:

Every completed phase ends with a Git commit.

A Phase 9.4 commit was intended with:

git add .
git commit -m "Phase 9.4: Implement Clerk event dispatcher architecture"

Before continuing, verify the actual repository state with:

git status
git log --oneline -5

Do not assume a commit exists if Git says otherwise.

26. Important Development Commands

Backend

From:

D:\Project\BrainOS\apps\backend

run:

npm run dev

Backend:

http://localhost:3001

Frontend

From:

D:\Project\BrainOS\apps\web

run:

npm run dev

Frontend:

http://localhost:3000

Prisma Studio

From backend:

npx prisma studio

Prisma migration

From backend:

npx prisma migrate dev --name <name>

Prisma validation

From backend:

npx prisma validate

ngrok

From the location containing ngrok:

ngrok http 3001

The public ngrok URL must be configured in the Clerk webhook endpoint.

27. Known Development Issue: Frontend Root Page

During webhook testing, http://localhost:3000/ displayed the defaultNext.js starter page.

The Clerk Sign Up route was available at:

http://localhost:3000/sign-up

A screenshot showed Clerk authentication functioning, although the/sign-up page at one point displayed a sign-in component. This shouldbe verified/fixed separately.

Do not confuse this frontend issue with the successful backendwebhook/database integration.

28. Important Clerk Webhook Testing Notes

For local development:

Clerk
  ↓
ngrok public URL
  ↓
localhost:3001

If ngrok is restarted, its URL may change.

Always verify the current forwarding URL before testing.

Clerk's webhook delivery dashboard is useful for checking:

Whether Clerk sent the event.

HTTP response status.

Delivery failures.

Event payload/delivery history.

ngrok should show incoming requests when Clerk actually sends thewebhook.

29. Production Architecture Direction

BrainOS must remain provider-independent.

Authentication:

BrainOS Auth Interface
        │
        └── Clerk
        └── Future providers

AI:

AI Provider Interface
        │
        ├── Ollama
        ├── OpenAI
        ├── Azure OpenAI
        ├── Claude
        └── Gemini

Database:

Prisma
   ↓
PostgreSQL

The PostgreSQL hosting provider can change without changing theapplication data layer.

30. Student Pack / Cost Context

The project is being developed with strong cost constraints.

Previously identified useful student resources include:

GitHub Pro

GitHub Copilot

DigitalOcean credits

Microsoft Azure credits

Clerk Pro

MongoDB Atlas credits

Heroku credits

JetBrains

Appwrite

GitHub Codespaces

VS Code and related resources

Current core database choice remains PostgreSQL rather than MongoDBbecause BrainOS's primary data is relational.

Local PostgreSQL is currently being used for development.

Ollama is intended as the primary local AI provider during developmentbecause there is no OpenAI API billing available and the developmentmachine has no dedicated GPU.

31. Next Phase --- Phase 10

Continue from here.

Planned Phase 10:

Backend Core Infrastructure

Goals:

10.1 Centralized Environment Configuration

Create a configuration layer so application code does not repeatedlyaccess:

process.env.*

directly.

Expected direction:

src/config/env.ts

with validated environment variables.

10.2 Centralized Logger

Replace scattered:

console.log()
console.error()

with a centralized logger abstraction.

Future implementation can use Pino/Winston without forcing the rest ofthe application to depend directly on the logging library.

10.3 Runtime Validation

Introduce Zod for runtime validation of external/untrusted data.

Especially important for:

Webhooks.

API requests.

Configuration.

Provider responses where appropriate.

10.4 Error Architecture

Introduce consistent application errors such as:

ValidationError
AuthenticationError
AuthorizationError
NotFoundError
DatabaseError

and centralized Express error middleware.

10.5 Database Transaction Patterns

Prepare services for Prisma transactions when operations span multiplerecords.

Example future flow:

Create User
    +
Create Settings
    +
Create Workspace
        ↓
One transaction

10.6 Shared Backend Utilities

Establish reusable utilities without creating unnecessary abstractions.

32. Future AI Provider Phase

After backend core stabilization, the AI layer should follow:

AI Service
    ↓
Provider Interface
    ↓
Provider Adapter
    ├── Ollama
    ├── OpenAI
    ├── Azure OpenAI
    ├── Claude
    └── Gemini

Changing an AI provider should not require rewriting the assistant,memory, task, or API layers.

33. Engineering Rules for the Next Chat

The next chat must:

NOT restart Phase 8 or Phase 9.

NOT repeat Clerk setup.

NOT recreate the Prisma User migration.

NOT move user synchronization back into the frontend.

NOT put business logic into controllers.

Continue from Phase 10.

Verify actual repository state before assuming commits/files exist.

Use Prisma migrations for all database changes.

Test each infrastructure component before moving on.

End Phase 10 with a Git commit and a new handoff context.

34. Senior Engineer Working Style

The assistant should behave as the senior engineer for BrainOS.

For each task:

Understand
   ↓
Review existing implementation
   ↓
Explain architectural reason
   ↓
Implement incrementally
   ↓
Run/test
   ↓
Fix errors
   ↓
Verify
   ↓
Commit
   ↓
Handoff

Do not blindly overwrite existing code.

When asking the user to modify a file:

Give the exact file path.

Say whether to replace the whole file or modify a section.

Give exact commands and where to run them.

Explain what success should look like.

If an error occurs, inspect the actual error before proposingdestructive changes.

35. Final Phase 9 Summary

Phase 9 established the complete identity synchronization foundation forBrainOS.

The most important verified result is:

Clerk user created
      ↓
Secure Svix webhook
      ↓
BrainOS Express backend
      ↓
Event dispatcher
      ↓
User-created handler
      ↓
User service
      ↓
Prisma
      ↓
PostgreSQL

A real user was successfully observed in Prisma Studio after signing upthrough Clerk.

The next development milestone is:

PHASE 10 — BACKEND CORE INFRASTRUCTURE

Start there.