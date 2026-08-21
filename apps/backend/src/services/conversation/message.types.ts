import { MessageRole } from "@prisma/client";

export interface CreateMessageInput {
  conversationId: string;
  userId: string;
  role: MessageRole;
  content: string;
}

export interface ListMessagesInput {
  conversationId: string;
  userId: string;
}

export interface MessageResult {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
