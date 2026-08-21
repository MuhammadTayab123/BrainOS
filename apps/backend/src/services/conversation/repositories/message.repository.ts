import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";

import { MessageRole } from "@prisma/client";

export interface CreateMessageData {
  conversationId: string;
  role: MessageRole;
  content: string;
}

export interface MessageListResult {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MessageRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(
    data: CreateMessageData,
  ): Promise<MessageListResult> {
    return this.db.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
      },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listByConversation(
    conversationId: string,
  ): Promise<MessageListResult[]> {
    return this.db.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        conversationId: true,
        role: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
