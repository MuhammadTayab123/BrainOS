import { Prisma } from "@prisma/client";

import { NotFoundError } from "../../../../errors";
import { prisma } from "../../../../lib/prisma";
import { DatabaseClient } from "../../../../lib/prisma.types";

export interface CreateDocumentChunkInput {
  documentId: string;
  chunkIndex: number;
  content: string;
}

const DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS = 768;

export class DocumentChunkRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async replaceChunks(
    documentId: string,
    chunks: CreateDocumentChunkInput[],
  ): Promise<void> {
    await this.db.documentChunk.deleteMany({
      where: {
        documentId,
      },
    });

    if (chunks.length === 0) {
      return;
    }

    await this.db.documentChunk.createMany({
      data: chunks,
    });
  }

  async listByDocument(documentId: string) {
    return this.db.documentChunk.findMany({
      where: {
        documentId,
      },
      orderBy: {
        chunkIndex: "asc",
      },
    });
  }
  async searchSimilar(
  userId: string,
  embedding: number[],
  limit: number,
) {
  const DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS = 768;
  const MAX_DOCUMENT_CHUNK_SEARCH_LIMIT = 20;
  const MIN_DOCUMENT_CHUNK_SIMILARITY = 0.2;

  if (
    embedding.length !==
    DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `Invalid embedding dimensions. Expected ${DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS}, received ${embedding.length}.`,
    );
  }

  if (
    embedding.some(
      (value) => !Number.isFinite(value),
    )
  ) {
    throw new Error(
      "Embedding contains invalid numeric values.",
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_DOCUMENT_CHUNK_SEARCH_LIMIT
  ) {
    throw new Error(
      `Search limit must be an integer between 1 and ${MAX_DOCUMENT_CHUNK_SEARCH_LIMIT}.`,
    );
  }

  const vector = `[${embedding.join(",")}]`;

  return this.db.$queryRaw<
    Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      content: string;
      similarity: number;
    }>
  >(
    Prisma.sql`
      SELECT
        dc."id",
        dc."documentId",
        dc."chunkIndex",
        dc."content",
        1 - (dc."embedding" <=> ${vector}::vector) AS "similarity"
      FROM "DocumentChunk" dc
      INNER JOIN "Document" d
        ON d."id" = dc."documentId"
      WHERE d."userId" = ${userId}
        AND d."deletedAt" IS NULL
        AND d."status" <> 'DELETED'
        AND dc."embedding" IS NOT NULL
        AND 1 - (dc."embedding" <=> ${vector}::vector)
            >= ${MIN_DOCUMENT_CHUNK_SIMILARITY}
      ORDER BY dc."embedding" <=> ${vector}::vector
      LIMIT ${limit}
    `,
  );
}

  async updateEmbedding(
    documentId: string,
    chunkIndex: number,
    embedding: number[],
  ): Promise<void> {
    if (
      embedding.length !==
      DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Invalid embedding dimensions. Expected ${DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS}, received ${embedding.length}.`,
      );
    }

    if (
      embedding.some(
        (value) => !Number.isFinite(value),
      )
    ) {
      throw new Error(
        "Embedding contains invalid numeric values.",
      );
    }

    const vector = `[${embedding.join(",")}]`;

    const updatedRows =
      await this.db.$executeRaw(
        Prisma.sql`
          UPDATE "DocumentChunk"
          SET "embedding" = ${vector}::vector
          WHERE "documentId" = ${documentId}
            AND "chunkIndex" = ${chunkIndex}
        `,
      );

    if (updatedRows === 0) {
      throw new NotFoundError(
        "Document chunk not found.",
      );
    }
  }
}