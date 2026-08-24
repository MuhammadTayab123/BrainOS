import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  CreateDocumentInput,
  DocumentListResult,
  DocumentStatus,
} from "../document.types";

export class DocumentRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(
    data: CreateDocumentInput,
  ): Promise<DocumentListResult> {
    return this.db.document.create({
      data: {
        userId: data.userId,
        title: data.title,
        sourceType: data.sourceType,
        source: data.source,
        content: data.content,
        mimeType: data.mimeType,
      },
      select: {
        id: true,
        title: true,
        sourceType: true,
        source: true,
        content: true,
        mimeType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listByUser(
    userId: string,
    status?: DocumentStatus,
    limit = 50,
  ): Promise<DocumentListResult[]> {
    return this.db.document.findMany({
      where: {
        userId,
        deletedAt: null,
        status,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        title: true,
        sourceType: true,
        source: true,
        content: true,
        mimeType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdForUser(
    documentId: string,
    userId: string,
  ): Promise<DocumentListResult | null> {
    return this.db.document.findFirst({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        sourceType: true,
        source: true,
        content: true,
        mimeType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(
    documentId: string,
    userId: string,
    status: DocumentStatus,
  ): Promise<void> {
    const result = await this.db.document.updateMany({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      data: {
        status,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Document not found for the authenticated user.",
      );
    }
  }

  async softDeleteByIdForUser(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.document.updateMany({
      where: {
        id: documentId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        status: DocumentStatus.DELETED,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Document not found for the authenticated user.",
      );
    }
  }
}
