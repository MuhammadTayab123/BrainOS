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