import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  ConversationListResult,
  CreateConversationInput,
} from "../conversation.types";

export class ConversationRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(
    data: CreateConversationInput,
  ): Promise<ConversationListResult> {
    return this.db.conversation.create({
      data: {
        userId: data.userId,
        title: data.title,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listByUser(
    userId: string,
    limit: number,
  ): Promise<ConversationListResult[]> {
    return this.db.conversation.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<ConversationListResult | null> {
    return this.db.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async softDeleteByIdForUser(
    conversationId: string,
    userId: string,
  ): Promise<void> {
        const result =
      await this.db.conversation.updateMany({
        where: {
          id: conversationId,
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

    if (result.count === 0) {
      throw new NotFoundError(
        "Conversation not found for the authenticated user.",
      );
    }
  }

  async updateTitleForUser(
    conversationId: string,
    userId: string,
    title: string,
  ): Promise<void> {
    const result = await this.db.conversation.updateMany({
      where: {
        id: conversationId,
        userId,
        deletedAt: null,
      },
      data: {
        title,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Conversation not found for the authenticated user.",
      );
    }
  }
}