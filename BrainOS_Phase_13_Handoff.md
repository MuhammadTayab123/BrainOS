BrainOS — Phase 13 Handoff / Context

Project Status

Project: BrainOS — Personal AI Operating System

Current phase: Phase 13 — Memory Embedding Persistence & Semantic Retrieval

Backend: D:\Project\BrainOS\apps\backend

Git branch: main

Latest commit: 86c06df

Commit: feat(memory): add embedding persistence and semantic search

GitHub push: successful

Working tree: clean

Phase 13 Achievement

BrainOS now has a working semantic long-term memory foundation:

Memory text
   ↓
Ollama embedding generation
   ↓
768-dimensional vector
   ↓
PostgreSQL + pgvector
   ↓
Vector persistence
   ↓
Cosine similarity search
   ↓
Relevant memories

Implemented:

Local Ollama embeddings

PostgreSQL pgvector storage

768-dimensional vectors

Transaction-safe memory creation

Semantic memory search

Cosine similarity scoring

Minimum similarity threshold

Search limits

User-specific memory isolation

Soft-delete filtering

Development test endpoints

Database

Database: brainos_db

Docker container: brainos-postgres

Port: 5432

PostgreSQL Memory.embedding was verified directly as:

vector(768)

The database schema is up to date and Prisma reports 4 migrations.

Prisma Schema

Memory now contains:

embedding Unsupported("vector")?

Prisma uses Unsupported("vector") because PostgreSQL pgvector is not represented as a normal Prisma scalar.

Migration

Directory:

prisma/migrations/20260810121955_add_memory_embedding/

File:

migration.sql

Contents:

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Memory"
ADD COLUMN "embedding" vector(768);

Migration is already applied. Do not create it again.

Memory Constants

File:

src/services/memory/constants/memory.constants.ts

Current values:

export const MEMORY_EMBEDDING_DIMENSIONS = 768;
export const DEFAULT_MEMORY_IMPORTANCE = 0.5;
export const DEFAULT_MEMORY_SEARCH_LIMIT = 5;
export const MAX_MEMORY_SEARCH_LIMIT = 50;
export const MIN_MEMORY_SIMILARITY = 0.45;

Prisma Client Abstraction

File:

src/lib/prisma.types.ts

import { Prisma, PrismaClient } from "@prisma/client";

export type DatabaseClient =
  | PrismaClient
  | Prisma.TransactionClient;

This allows the repository to use either the global Prisma client or a transaction-scoped Prisma client.

Memory Repository

File:

src/services/memory/repositories/memory.repository.ts

Responsibilities:

Create memories

Validate embedding dimensions

Validate finite embedding values

Persist embeddings using pgvector

Search by semantic similarity

Enforce user isolation

Ignore soft-deleted memories

Ignore memories without embeddings

Apply similarity threshold

Apply result limits

Embedding persistence uses Prisma raw SQL:

const vector = `[${embedding.join(",")}]`;

await this.db.$executeRaw(
  Prisma.sql`
    UPDATE "Memory"
    SET "embedding" = ${vector}::vector
    WHERE "id" = ${memoryId}
  `,
);

Semantic search uses cosine distance:

1 - ("embedding" <=> ${vector}::vector) AS "similarity"

Filtering includes:

matching userId

deletedAt IS NULL

embedding IS NOT NULL

similarity >= MIN_MEMORY_SIMILARITY

Results are ordered by vector distance so the most similar memories appear first.

Memory Service

File:

src/services/memory/memory.service.ts

Methods:

createMemory()

searchMemories()

Creation flow:

Generate embedding
      ↓
Validate dimensions
      ↓
Open Prisma transaction
      ↓
Create memory
      ↓
Store embedding
      ↓
Commit

The Ollama embedding call happens before the database transaction so the external/local model operation does not hold a database transaction open.

Search flow:

Validate query
      ↓
Validate limit
      ↓
Generate query embedding
      ↓
Validate dimensions
      ↓
Repository semantic search

Embedding Architecture

Files:

src/services/memory/embeddings.service.ts

src/services/memory/providers/embedding.provider.ts

src/services/memory/providers/ollama.provider.ts

Provider contract:

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingResult>;
}

The current provider is OllamaProvider.

The provider returns:

vector

dimensions

provider

model

This keeps the memory engine independent from a specific embedding vendor.

Domain Types

File:

src/services/memory/memory.types.ts

Includes:

CreateMemoryInput

SearchMemoryInput

MemorySearchResult

EmbeddingResult

These remain framework-independent and do not import Prisma, Express, OpenAI, or pgvector.

Development Endpoints

File:

src/routes/dev.routes.ts

Current endpoints:

GET  /api/v1/dev/test-embedding
POST /api/v1/dev/test-memory
POST /api/v1/dev/test-memory-search

These are development/test endpoints, not the final production memory API.

Development Controller

File:

src/controllers/dev.controller.ts

Contains:

testEmbedding()

testMemory()

testMemorySearch()

testMemory() validates userId, content, and optional importance.

testMemorySearch() validates userId, query, and optional limit.

For these temporary dev endpoints, services/providers are instantiated directly. Do not copy this construction pattern into production routes; proper dependency composition/injection can be introduced later.

Tests Completed

TypeScript

Command:

npm run typecheck

Result: PASS.

Prisma validation

Command:

npx prisma validate

Result: PASS.

Prisma migration status

Command:

npx prisma migrate status

Result:

4 migrations found

Database schema is up to date

No pending migrations

Prisma Client

npx prisma generate successfully generated Prisma Client 6.16.3.

Embedding test

Ollama successfully generated embeddings with 768 dimensions.

Memory persistence

A real memory was created successfully, and PostgreSQL verification confirmed its embedding was present with 768 dimensions.

Semantic search

Semantic queries successfully returned relevant memories with similarity scores.

User isolation

Searching with another user's ID returned zero memories, confirming user-level isolation.

Soft delete

A memory marked with deletedAt was excluded from semantic search.

Git checks

git diff --cached --check passed with no whitespace errors.

Important Architecture

Dev Controller
      ↓
MemoryService
   ↙          ↘
Embeddings   MemoryRepository
Service           ↓
   ↓            Prisma
OllamaProvider    ↓
   ↓          PostgreSQL
Ollama             ↓
                 pgvector

Design Decisions

Ollama is used for local embeddings.

PostgreSQL + pgvector is used instead of a separate vector database.

pgvector-specific SQL remains inside MemoryRepository.

Business orchestration remains in MemoryService.

Memory creation and embedding persistence are transactional.

Semantic search is always scoped to a user.

Soft-deleted memories are excluded.

Similarity threshold is centralized at 0.45.

Default search limit is 5.

Maximum search limit is 50.

Do Not Rebuild

When continuing BrainOS:

Do not reinstall PostgreSQL/pgvector.

Do not recreate the embedding migration.

Do not recreate the Memory.embedding column.

Do not recreate the repository search implementation.

Do not recreate the embedding provider architecture.

Start from commit 86c06df.

Phase 14 Starting Point

Before beginning Phase 14, verify:

cd D:\Project\BrainOS\apps\backend
git status
git log -1 --oneline

Expected latest commit:

86c06df feat(memory): add embedding persistence and semantic search

Expected state:

working tree clean

Phase 14 should build on the completed semantic memory foundation.

Phase 13 Completion

BrainOS Phase 13 is complete and pushed to GitHub.

The backend now has a functioning semantic long-term memory foundation backed by PostgreSQL, pgvector, Prisma, and local Ollama embeddings.

Latest commit:

86c06df

Commit message:

feat(memory): add embedding persistence and semantic search