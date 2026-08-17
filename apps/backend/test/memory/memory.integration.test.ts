import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { prisma } from "../../src/lib/prisma";
import { EmbeddingsService } from "../../src/services/memory/embeddings.service";
import { MemoryService } from "../../src/services/memory/memory.service";
import { MemoryRepository } from "../../src/services/memory/repositories/memory.repository";
import { assertSafeTestEnvironment } from "../safety";

const userA = {
  id: "integration-test-user-a",
  clerkId: "integration-test-clerk-a",
  email: "integration-test-user-a@example.test",
};
const userB = {
  id: "integration-test-user-b",
  clerkId: "integration-test-clerk-b",
  email: "integration-test-user-b@example.test",
};
const testUserIds = [userA.id, userB.id];

const vectorA = Array.from({ length: 768 }, (_, index) =>
  index === 0 ? 1 : 0,
);
const vectorB = Array.from({ length: 768 }, (_, index) =>
  index === 1 ? 1 : 0,
);
const vectorC = Array.from({ length: 768 }, (_, index) =>
  index === 2 ? 1 : 0,
);

let nextEmbedding = vectorA;

const embeddingsService = new EmbeddingsService({
  embed: async () => ({
    vector: nextEmbedding,
    dimensions: nextEmbedding.length,
    provider: "integration-test",
    model: "deterministic-vector",
  }),
});
const memoryService = new MemoryService(embeddingsService);
const memoryRepository = new MemoryRepository();

function assertTestDatabaseSafety(): void {
  assertSafeTestEnvironment();
}

async function cleanupIntegrationRows(): Promise<void> {
  assertTestDatabaseSafety();
  await prisma.memory.deleteMany({
    where: { userId: { in: testUserIds } },
  });
}

async function createMemory(
  userId: string,
  content: string,
  embedding: number[] = vectorA,
  importance = 0.5,
) {
  nextEmbedding = embedding;
  return memoryService.createMemory({ userId, content, importance });
}

async function getStoredMemory(memoryId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      content: string;
      importance: number;
      deletedAt: Date | null;
      dimensions: number | null;
      embedding: string | null;
    }>
  >(Prisma.sql`
    SELECT
      "id",
      "userId",
      "content",
      "importance",
      "deletedAt",
      vector_dims("embedding") AS "dimensions",
      "embedding"::text AS "embedding"
    FROM "Memory"
    WHERE "id" = ${memoryId}
  `);

  return rows[0] ?? null;
}

describe("Memory PostgreSQL and pgvector integration", () => {
  beforeAll(async () => {
    assertTestDatabaseSafety();

    const database = await prisma.$queryRaw<Array<{ database: string }>>(
      Prisma.sql`SELECT current_database() AS "database"`,
    );
    expect(database).toEqual([{ database: "brainos_test" }]);

    const precheck = await prisma.$queryRaw<
      Array<{
        memoryTable: string | null;
        userTable: string | null;
        vectorExtension: string | null;
        embeddingType: string | null;
      }>
    >(Prisma.sql`
      SELECT
        to_regclass('public."Memory"')::text AS "memoryTable",
        to_regclass('public."User"')::text AS "userTable",
        (SELECT extname FROM pg_extension WHERE extname = 'vector') AS "vectorExtension",
        (
          SELECT format_type(a.atttypid, a.atttypmod)
          FROM pg_attribute a
          JOIN pg_class c ON c.oid = a.attrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'Memory'
            AND a.attname = 'embedding'
            AND NOT a.attisdropped
        ) AS "embeddingType"
    `);
    expect(precheck).toEqual([
      {
        memoryTable: '"Memory"',
        userTable: '"User"',
        vectorExtension: "vector",
        embeddingType: "vector(768)",
      },
    ]);

    await cleanupIntegrationRows();
    assertTestDatabaseSafety();
    await prisma.user.upsert({
      where: { id: userA.id },
      update: {
        clerkId: userA.clerkId,
        email: userA.email,
        firstName: "Integration",
        lastName: "User A",
        imageUrl: null,
      },
      create: {
        ...userA,
        firstName: "Integration",
        lastName: "User A",
        imageUrl: null,
      },
    });
    await prisma.user.upsert({
      where: { id: userB.id },
      update: {
        clerkId: userB.clerkId,
        email: userB.email,
        firstName: "Integration",
        lastName: "User B",
        imageUrl: null,
      },
      create: {
        ...userB,
        firstName: "Integration",
        lastName: "User B",
        imageUrl: null,
      },
    });
  });

  beforeEach(async () => {
    await cleanupIntegrationRows();
  });

  afterAll(async () => {
    try {
      await cleanupIntegrationRows();
      assertTestDatabaseSafety();
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    } finally {
      await prisma.$disconnect();
      delete (globalThis as { prisma?: unknown }).prisma;
    }
  });

  it("persists a real 768-dimension embedding with owner, content, importance, and active state", async () => {
    const memory = await createMemory(
      userA.id,
      "integration create memory",
      vectorA,
      0.7,
    );

    const stored = await getStoredMemory(memory.id);

    expect(stored).toMatchObject({
      id: memory.id,
      userId: userA.id,
      content: "integration create memory",
      importance: 0.7,
      deletedAt: null,
      dimensions: 768,
      embedding: `[${vectorA.join(",")}]`,
    });
  });

  it("lists only the real active memories belonging to each owner", async () => {
    const memoryA = await createMemory(userA.id, "owner A list", vectorA);
    const memoryB = await createMemory(userB.id, "owner B list", vectorB);

    const userAMemories = await memoryService.listMemories({ userId: userA.id });
    const userBMemories = await memoryService.listMemories({ userId: userB.id });

    expect(userAMemories.map((memory) => memory.id)).toEqual([memoryA.id]);
    expect(userBMemories.map((memory) => memory.id)).toEqual([memoryB.id]);
  });

  it("retrieves an owner memory and denies different-owner and nonexistent reads", async () => {
    const memory = await createMemory(userA.id, "owner get", vectorA);

    await expect(
      memoryService.getMemoryById({ memoryId: memory.id, userId: userA.id }),
    ).resolves.toMatchObject({ id: memory.id, content: "owner get" });
    await expect(
      memoryService.getMemoryById({ memoryId: memory.id, userId: userB.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      memoryService.getMemoryById({ memoryId: "integration-missing", userId: userA.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates content and embedding atomically in PostgreSQL while preserving importance", async () => {
    const memory = await createMemory(userA.id, "before update", vectorA, 0.8);

    nextEmbedding = vectorB;
    await memoryService.updateMemory({
      memoryId: memory.id,
      userId: userA.id,
      content: "after update",
    });

    const stored = await getStoredMemory(memory.id);
    expect(stored).toMatchObject({
      content: "after update",
      importance: 0.8,
      deletedAt: null,
      dimensions: 768,
      embedding: `[${vectorB.join(",")}]`,
    });
  });

  it("updates importance without changing the persisted content or embedding", async () => {
    const memory = await createMemory(userA.id, "importance only", vectorA, 0.2);
    const before = await getStoredMemory(memory.id);

    await memoryService.updateMemory({
      memoryId: memory.id,
      userId: userA.id,
      importance: 0.9,
    });

    const after = await getStoredMemory(memory.id);
    expect(after).toMatchObject({
      content: "importance only",
      importance: 0.9,
      dimensions: 768,
      embedding: before?.embedding,
    });
  });

  it("denies a cross-owner update without changing the real row", async () => {
    const memory = await createMemory(userA.id, "owner protected", vectorA);
    const before = await getStoredMemory(memory.id);
    nextEmbedding = vectorB;

    await expect(
      memoryService.updateMemory({
        memoryId: memory.id,
        userId: userB.id,
        content: "unauthorized update",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const after = await getStoredMemory(memory.id);
    expect(after).toMatchObject({
      content: "owner protected",
      embedding: before?.embedding,
      deletedAt: null,
    });
  });

  it("soft-deletes a real row instead of physically removing it", async () => {
    const memory = await createMemory(userA.id, "soft delete", vectorA);

    await memoryService.deleteMemory({ memoryId: memory.id, userId: userA.id });

    const stored = await getStoredMemory(memory.id);
    expect(stored).toMatchObject({ id: memory.id });
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  it("hides a soft-deleted memory from list, get, search, update, and repeated delete", async () => {
    const memory = await createMemory(userA.id, "soft delete visibility", vectorA);
    await memoryService.deleteMemory({ memoryId: memory.id, userId: userA.id });
    nextEmbedding = vectorA;

    await expect(
      memoryService.listMemories({ userId: userA.id }),
    ).resolves.toEqual([]);
    await expect(
      memoryService.getMemoryById({ memoryId: memory.id, userId: userA.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      memoryService.searchMemories({ userId: userA.id, query: "same vector" }),
    ).resolves.toEqual([]);
    await expect(
      memoryService.updateMemory({
        memoryId: memory.id,
        userId: userA.id,
        importance: 0.9,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      memoryService.deleteMemory({ memoryId: memory.id, userId: userA.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("uses real pgvector search SQL with database owner isolation", async () => {
    const memoryA = await createMemory(userA.id, "semantic owner A", vectorA);
    await createMemory(userB.id, "semantic owner B", vectorA);
    nextEmbedding = vectorA;

    const results = await memoryService.searchMemories({
      userId: userA.id,
      query: "semantic query",
      limit: 10,
    });

    expect(results.map((memory) => memory.id)).toEqual([memoryA.id]);
    expect(results[0]?.similarity).toBeCloseTo(1, 10);
  });

  it("removes a soft-deleted embedding from real pgvector search results", async () => {
    const memory = await createMemory(userA.id, "semantic soft delete", vectorC);
    nextEmbedding = vectorC;

    await expect(
      memoryRepository.search(userA.id, vectorC, 10),
    ).resolves.toEqual([
      expect.objectContaining({ id: memory.id, similarity: expect.closeTo(1, 10) }),
    ]);

    await memoryService.deleteMemory({ memoryId: memory.id, userId: userA.id });

    await expect(memoryRepository.search(userA.id, vectorC, 10)).resolves.toEqual([]);
  });

  it("stores an embedding accepted by the real semantic search query at vector(768)", async () => {
    const memory = await createMemory(userA.id, "vector dimensions", vectorB);
    const stored = await getStoredMemory(memory.id);

    expect(stored).toMatchObject({ dimensions: 768, embedding: `[${vectorB.join(",")}]` });
    await expect(memoryRepository.search(userA.id, vectorB, 10)).resolves.toEqual([
      expect.objectContaining({ id: memory.id, similarity: expect.closeTo(1, 10) }),
    ]);
  });

  it("excludes deleted rows while retaining active owner isolation across list, get, and search", async () => {
    const activeA = await createMemory(userA.id, "active A", vectorA);
    const deletedA = await createMemory(userA.id, "deleted A", vectorA);
    await createMemory(userB.id, "active B", vectorA);
    const deletedB = await createMemory(userB.id, "deleted B", vectorA);
    await memoryService.deleteMemory({ memoryId: deletedA.id, userId: userA.id });
    await memoryService.deleteMemory({ memoryId: deletedB.id, userId: userB.id });
    nextEmbedding = vectorA;

    await expect(memoryService.listMemories({ userId: userA.id })).resolves.toEqual([
      expect.objectContaining({ id: activeA.id }),
    ]);
    await expect(
      memoryService.getMemoryById({ memoryId: deletedA.id, userId: userA.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      memoryService.searchMemories({ userId: userA.id, query: "active A query" }),
    ).resolves.toEqual([
      expect.objectContaining({ id: activeA.id }),
    ]);
  });
});
