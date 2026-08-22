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
    const createMessage = async (
      db: DatabaseClient,
    ): Promise<MessageListResult> => {
      const message = await db.message.create({
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

      await db.conversation.update({
        where: {
          id: data.conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return message;
    };

    /*
     * When using the normal Prisma client, keep message creation
     * and conversation timestamp update inside one transaction.
     *
     * When a transaction-scoped Prisma client is supplied,
     * the caller already owns the transaction.
     */
    if ("$transaction" in this.db) {
      return this.db.$transaction(async (tx) => {
        return createMessage(tx);
      });
    }

    return createMessage(this.db);
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
