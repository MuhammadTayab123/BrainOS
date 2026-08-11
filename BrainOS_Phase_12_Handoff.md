BrainOS --- Phase 12 Handoff

Phase: 12 --- AI Memory FoundationStatus: COMPLETEHandoff Target: Phase 13 --- Memory PersistenceDate: 2026-08-11Project: BrainOSBackend: apps/backend

1. Phase Objective

Phase 12 established the AI/Memory foundation for BrainOS.

The goal was to create a clean, provider-independent memory architectureand connect it to a local Ollama embedding model. By the end of thephase, BrainOS could receive an HTTP request, generate a real embeddingvector through Ollama, and return the result through the backend API.

The phase deliberately stopped before vector persistence and similaritysearch. Those are Phase 13 responsibilities.

2. Phase 12 Completed Work

2.1 PostgreSQL Foundation

PostgreSQL 17 is running through Docker.

The BrainOS PostgreSQL environment includes:

PostgreSQL 17

pgAdmin

Docker network: brainos-network

PostgreSQL persistent volume: brainos-postgres-data

pgAdmin persistent volume: brainos-pgadmin-data

The PostgreSQL container was verified as healthy.

2.2 pgvector

The vector PostgreSQL extension was installed successfully.

Verification used:

CREATE EXTENSION vector;

Then:

SELECT extname
FROM pg_extension;

The result included:

plpgsql
vector

The extension was also checked through PostgreSQL's available extensionsand was available at version 0.8.6.

This means the database is ready for vector storage and similarityoperations in Phase 13.

2.3 PostgreSQL Version Verification

The database was verified with:

SELECT version();

The environment reported PostgreSQL 17.x.

3. Prisma Foundation

The project uses Prisma as the ORM.

The active schema is:

apps/backend/prisma/schema.prisma

A duplicate/unused Prisma schema location was removed so that theproject has one authoritative schema.

Prisma Client generation was successfully verified with:

npx prisma generate

The generated Prisma Client version used during Phase 12 was:

6.16.3

4. Current Prisma Domain Models

The schema currently contains:

User

Fields include:

id

clerkId

email

firstName

lastName

imageUrl

isActive

timestamps

soft-delete timestamp

Relationships:

User
 ├── Conversation[]
 └── Memory[]

Conversation

Contains:

id

userId

title

timestamps

soft-delete timestamp

Relationship:

Conversation
 └── Message[]

Message

Contains:

id

conversationId

role

content

timestamps

MessageRole enum:

USER
ASSISTANT
SYSTEM

Memory

Current model:

model Memory {
  id String @id @default(cuid())

  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  content String

  importance Float @default(0.5)

  lastAccessedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  @@index([userId])
}

IMPORTANT:

The Memory model currently does not contain an embedding/vectorfield.

This is intentional for the Phase 12 boundary.

Adding vector persistence belongs to Phase 13.

5. Memory Architecture

The memory system was organized into separate layers.

Current structure:

apps/backend/src/services/memory/
│
├── constants/
│   └── memory.constants.ts
│
├── providers/
│   ├── embedding.provider.ts
│   ├── index.ts
│   └── ollama.provider.ts
│
├── repositories/
│   └── memory.repository.ts
│
├── embeddings.service.ts
├── memory.service.ts
├── memory.types.ts
└── similarity.service.ts

5.1 Domain Types

File:

src/services/memory/memory.types.ts

This file is intentionally framework-independent.

It contains:

export interface CreateMemoryInput {
  userId: string;
  content: string;
  importance?: number;
}

export interface SearchMemoryInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  similarity: number;
  importance: number;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  provider: string;
  model: string;
}

Design rule:

memory.types.ts must not depend on:

Prisma

Express

Ollama

OpenAI

pgvector

6. Embedding Provider Abstraction

File:

src/services/memory/providers/embedding.provider.ts

The provider contract is:

import { EmbeddingResult } from "../memory.types";

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingResult>;
}

This creates provider independence.

Future providers can implement the same interface, including:

Ollama

OpenAI

Azure OpenAI

VoyageAI

Gemini

The Memory layer does not need to know which provider is being used.

7. Ollama Embedding Provider

File:

src/services/memory/providers/ollama.provider.ts

The provider uses:

OllamaClient

and the configured embedding model:

env.OLLAMA_EMBEDDING_MODEL

The provider calls:

POST /api/embed

and converts the Ollama response into the project'sframework-independent EmbeddingResult.

Returned information includes:

vector
dimensions
provider
model

8. Ollama Client

File:

src/services/ai/clients/ollama.client.ts

The client centralizes HTTP communication with Ollama.

The base URL is configuration-driven:

env.OLLAMA_HOST

The client performs POST requests with JSON bodies and validatesunsuccessful HTTP responses.

The application does not hardcode:

http://localhost:11434

inside provider logic.

9. Ollama Models

Ollama was installed and verified locally.

Available models during Phase 12:

qwen2.5:3b
nomic-embed-text:latest

The models are used for different responsibilities:

qwen2.5:3b
    → chat/generation

nomic-embed-text
    → embeddings

10. Environment Configuration

Ollama configuration was added to the backend environment:

OLLAMA_HOST=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

Environment validation is handled through:

apps/backend/src/config/env.ts

using Zod.

The configuration includes:

NODE_ENV

PORT

DATABASE_URL

Clerk configuration

Ollama configuration

future AI provider keys

LOG_LEVEL

11. Embeddings Service

File:

src/services/memory/embeddings.service.ts

The service depends on the provider abstraction:

export class EmbeddingsService {
  constructor(
    private readonly provider: EmbeddingProvider
  ) {}

  async generate(text: string): Promise<EmbeddingResult> {
    return this.provider.embed(text);
  }
}

Important architectural principle:

EmbeddingsService
        ↓
EmbeddingProvider

not:

EmbeddingsService
        ↓
Ollama directly

This keeps the service independent from the AI vendor/provider.

12. Memory Repository

File:

src/services/memory/repositories/memory.repository.ts

The repository is responsible for persistence concerns.

The initial implementation was prepared around Prisma.

The repository currently does not persist an embedding vector becausethe Prisma Memory model has not yet been extended with a vector field.

Vector persistence begins in Phase 13.

13. Memory Service

File:

src/services/memory/memory.service.ts

The service sits above the repository layer.

The intended architecture is:

Controller
    ↓
MemoryService
    ↓
MemoryRepository

and for embeddings:

MemoryService
    ↓
EmbeddingsService
    ↓
EmbeddingProvider
    ↓
OllamaProvider

14. Backend Development Endpoint

A temporary development endpoint was created to verify the complete AIpipeline.

Files:

src/controllers/dev.controller.ts
src/routes/dev.routes.ts

Route:

GET /api/v1/dev/test-embedding

The route is registered in:

src/app.ts

using:

app.use("/api/v1/dev", devRoutes);

15. End-to-End AI Verification

The endpoint was successfully tested through the actual running Expressbackend.

Request:

GET http://localhost:3001/api/v1/dev/test-embedding

Successful response included:

{
  "success": true,
  "provider": "ollama",
  "model": "nomic-embed-text",
  "dimensions": 768,
  "preview": [
    0.031178586,
    0.100853086,
    -0.10445573,
    ...
  ]
}

This is the most important verification result of Phase 12.

It proves the complete pipeline:

Browser / HTTP Client
        ↓
Express
        ↓
Dev Route
        ↓
Dev Controller
        ↓
EmbeddingsService
        ↓
EmbeddingProvider
        ↓
OllamaProvider
        ↓
OllamaClient
        ↓
Ollama
        ↓
nomic-embed-text
        ↓
768-dimensional vector

16. TypeScript Verification

The backend was repeatedly verified with:

npm run typecheck

The final Phase 12 implementation passed type checking.

Current package script:

"typecheck": "tsc --noEmit"

17. Temporary Embedding Test Script

A standalone script was briefly created:

scripts/test-embedding.ts

It was removed.

Reason:

The standalone script introduced unnecessary environment/module-loadingcomplexity. Testing through the real Express backend proved cleaner andcloser to the application's actual runtime.

The test:embedding npm script was also removed.

Future feature verification should generally use the actual backendexecution path or proper integration tests rather than ad-hoc scripts.

18. Backend Runtime

The backend is started with:

npm run dev

Development command:

tsx watch src/server.ts

Build:

npm run build

Production start:

npm start

The backend runs on:

http://localhost:3001

19. Important Configuration Observation

The current env.ts validates several subsystems globally whenimported.

This caused the standalone embedding test to require values such as:

DATABASE_URL

Clerk configuration

even though the test itself only needed Ollama.

This was not changed during Phase 12 because the real backend runtimealready initializes the complete application environment correctly.

Planned future improvement:

Split configuration into domain-specific modules, for example:

src/config/
├── env.ts
├── ai.ts
├── database.ts
└── clerk.ts

Do not introduce this refactor in the middle of Phase 13 unlessnecessary.

20. Dependency Injection Observation

The current development controller constructs dependencies directly:

new EmbeddingsService(
  new OllamaProvider()
)

This is acceptable for the temporary development endpoint.

For production memory/chat features, BrainOS should eventually introducea composition root/dependency injection approach so controllers do notmanually instantiate service graphs.

Potential future direction:

Composition Root
      ↓
Service Graph
      ↓
Controllers

Again, this is a planned architectural improvement, not a Phase 12blocker.

21. Temporary Development Route Warning

The following route is intended for development verification:

/api/v1/dev/test-embedding

Before production deployment, either:

remove the route, or

protect it behind a development-only condition/authenticationmechanism.

Do not expose unrestricted development endpoints in production.

22. Git Checkpoint

A Phase 12 checkpoint commit was prepared with the intended message:

git add .
git commit -m "feat(memory): implement Phase 12 AI memory foundation"

The intended Phase 12 milestone is:

feat(memory): implement Phase 12 AI memory foundation

Before starting Phase 13, verify:

git status

Preferred state:

nothing to commit, working tree clean

If the commit has not yet been pushed:

git push origin main

Use the actual project branch if it is not main.

23. Phase 12 Definition of Done

Phase 12 is considered complete because all of the following are true:

PostgreSQL 17 available

Docker PostgreSQL environment working

pgAdmin available

pgvector extension installed

PostgreSQL version verified

Prisma schema established

Prisma Client generated

Duplicate Prisma schema confusion resolved

Memory domain types created

Memory repository layer established

Memory service layer established

Embeddings service established

Provider abstraction established

Ollama provider implemented

Ollama client implemented

Ollama embedding model installed

Environment configuration added

Zod environment validation working

Development controller created

Development route created

Route registered in Express

TypeScript typecheck passing

Real Ollama embedding generated

768-dimensional embedding verified

End-to-end backend integration verified

24. What Phase 12 Does NOT Include

Do not consider these complete yet:

Vector persistence

Memory.embedding database column

pgvector similarity queries

cosine similarity search in PostgreSQL

automatic embedding storage with memories

semantic memory retrieval

RAG context assembly

memory ranking

memory deduplication

production memory API

production chat integration

These belong to later phases, beginning with Phase 13.

25. Phase 13 Starting Point

Phase 13 --- Memory Persistence

Start Phase 13 from the current state.

Primary objective:

Persist generated embeddings in PostgreSQL.

Target architecture:

Create Memory Request
        ↓
MemoryService
        ↓
EmbeddingsService
        ↓
OllamaProvider
        ↓
768-dimensional vector
        ↓
MemoryRepository
        ↓
PostgreSQL + pgvector

Then implement:

Memory Search Request
        ↓
Generate query embedding
        ↓
pgvector similarity search
        ↓
Relevant memories
        ↓
Ranked results

26. Phase 13 Recommended Sequence

Do not jump directly into RAG.

Recommended order:

13.1 Schema Design

Determine the correct vector representation for the currentnomic-embed-text model.

The current verified output is:

768 dimensions

13.2 Prisma Migration

Add the database representation for the embedding.

Because pgvector support can require raw SQL/custom migration handlingdepending on the Prisma version and schema strategy, verify thegenerated migration rather than blindly trusting it.

13.3 Memory Persistence

Update:

MemoryService
MemoryRepository

so creating a memory generates and stores its embedding.

13.4 Database Verification

Verify the actual vector is stored in PostgreSQL.

13.5 Similarity Search

Implement vector similarity search using pgvector.

13.6 API

Create the production memory API only after persistence/search isproven.

27. Engineering Rules for Phase 13

Continue using:

Design
  ↓
Implement
  ↓
Typecheck
  ↓
Run
  ↓
Verify
  ↓
Commit

Do not assume a feature works because TypeScript compiles.

For database/vector work, verify both:

application behavior

actual PostgreSQL state

28. Important Naming Convention

The correct file name is:

embeddings.service.ts

not:

embedding.service.ts

The corresponding class is:

EmbeddingsService

Keep this naming consistent.

29. Current Architecture Snapshot

                         BrainOS Backend
                                │
                                ▼
                           Express App
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
           User API        Dev API          Webhooks
                                │
                                ▼
                         DevController
                                │
                                ▼
                       EmbeddingsService
                                │
                                ▼
                       EmbeddingProvider
                                │
                                ▼
                         OllamaProvider
                                │
                                ▼
                          OllamaClient
                                │
                                ▼
                         Ollama Server
                                │
                                ▼
                      nomic-embed-text
                                │
                                ▼
                         768-d Vector

Database side:

PostgreSQL 17
     │
     ├── User
     ├── Conversation
     ├── Message
     └── Memory
            │
            └── vector embedding → Phase 13

30. Handoff Instruction

The next developer/session should NOT redo Phase 12.

Start directly from:

Phase 13 — Memory Persistence

First inspect the current:

apps/backend/prisma/schema.prisma
apps/backend/src/services/memory/repositories/memory.repository.ts
apps/backend/src/services/memory/memory.service.ts
apps/backend/src/services/memory/similarity.service.ts

Then design the vector persistence approach before modifying the schema.

The verified embedding model is:

nomic-embed-text

The verified vector size is:

768

The verified Ollama host is:

http://localhost:11434

The verified AI endpoint is:

POST /api/embed

The verified BrainOS development endpoint is:

GET /api/v1/dev/test-embedding

Phase 12 is complete and should be treated as a stable foundation.