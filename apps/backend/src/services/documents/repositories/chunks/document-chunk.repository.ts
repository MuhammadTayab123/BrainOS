import { prisma } from "../../../../lib/prisma";
import { DatabaseClient } from "../../../../lib/prisma.types";

export interface CreateDocumentChunkInput {
  documentId: string;
  chunkIndex: number;
  content: string;
}

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

  async listByDocument(
    documentId: string,
  ) {
    return this.db.documentChunk.findMany({
      where: {
        documentId,
      },
      orderBy: {
        chunkIndex: "asc",
      },
    });
  }
}