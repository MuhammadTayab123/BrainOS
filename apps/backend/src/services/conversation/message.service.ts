import { NotFoundError } from "../../errors";

import {
  CreateMessageInput,
  ListMessagesInput,
} from "./message.types";

import { ConversationRepository } from "./repositories/conversation.repository";
import { MessageRepository } from "./repositories/message.repository";

export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async createMessage(
    data: CreateMessageInput,
  ) {
    const conversationId = data.conversationId.trim();
    const userId = data.userId.trim();
    const content = data.content.trim();

    if (!conversationId) {
      throw new Error("Conversation ID is required.");
    }

    if (!userId) {
      throw new Error(
        "User ID is required to create a message.",
      );
    }

    if (!content) {
      throw new Error("Message content is required.");
    }

    const conversation =
      await this.conversationRepository.findByIdForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundError(
        "Conversation not found for the authenticated user.",
      );
    }

    return this.messageRepository.create({
      conversationId,
      role: data.role,
      content,
    });
  }

  async listMessages(
    data: ListMessagesInput,
  ) {
    const conversationId = data.conversationId.trim();
    const userId = data.userId.trim();

    if (!conversationId) {
      throw new Error("Conversation ID is required.");
    }

    if (!userId) {
      throw new Error(
        "User ID is required to list messages.",
      );
    }

    const conversation =
      await this.conversationRepository.findByIdForUser(
        conversationId,
        userId,
      );

    if (!conversation) {
      throw new NotFoundError(
        "Conversation not found for the authenticated user.",
      );
    }

    return this.messageRepository.listByConversation(
      conversationId,
    );
  }
}
