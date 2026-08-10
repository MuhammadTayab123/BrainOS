
import {
  DEFAULT_MEMORY_IMPORTANCE,
  MEMORY_EMBEDDING_DIMENSIONS,
  MIN_MEMORY_SIMILARITY,
  MAX_MEMORY_SEARCH_LIMIT,
} from "../constants/memory.constants";
import { Prisma } from "@prisma/client";

import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";

import {
  CreateMemoryInput,
  MemorySearchResult,
} from "../memory.types";
export class MemoryRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(data: CreateMemoryInput) {
    return this.db.memory.create({
      data: {
        userId: data.userId,
        content: data.content,
        importance:
          data.importance ?? DEFAULT_MEMORY_IMPORTANCE,
      },
    });
  }

  async updateEmbedding(
    memoryId: string,
    embedding: number[],
  ): Promise<void> {
    if (
      embedding.length !==
      MEMORY_EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Invalid embedding dimensions. Expected ${MEMORY_EMBEDDING_DIMENSIONS}, received ${embedding.length}.`,
      );
    }

    if (embedding.some((value) => !Number.isFinite(value))) {
      throw new Error(
        "Embedding contains invalid numeric values.",
      );
    }

    const vector = `[${embedding.join(",")}]`;

    await this.db.$executeRaw(
      Prisma.sql`
        UPDATE "Memory"
        SET "embedding" = ${vector}::vector
        WHERE "id" = ${memoryId}
      `,
    );
  }
 async search(
  userId: string,
  embedding: number[],
  limit: number,
): Promise<MemorySearchResult[]> {
  if (
    embedding.length !== MEMORY_EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Invalid embedding dimensions. Expected ${MEMORY_EMBEDDING_DIMENSIONS}, received ${embedding.length}.`,
    );
  }

  if (
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      "Embedding contains invalid numeric values.",
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_MEMORY_SEARCH_LIMIT
  ) {
    throw new Error(
      `Search limit must be an integer between 1 and ${MAX_MEMORY_SEARCH_LIMIT}.`,
    );
  }

  const vector = `[${embedding.join(",")}]`;

  return this.db.$queryRaw<MemorySearchResult[]>(
    Prisma.sql`
      SELECT
        "id",
        "content",
        "importance",
        1 - ("embedding" <=> ${vector}::vector) AS "similarity"
      FROM "Memory"
      WHERE "userId" = ${userId}
        AND "deletedAt" IS NULL
        AND "embedding" IS NOT NULL
        AND 1 - ("embedding" <=> ${vector}::vector)
            >= ${MIN_MEMORY_SIMILARITY}
      ORDER BY "embedding" <=> ${vector}::vector
      LIMIT ${limit}
    `,
  );
}

}