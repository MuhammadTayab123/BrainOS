import { NotFoundError } from "../../errors";

import {
  CreateConversationInput,
  DeleteConversationInput,
  GetConversationInput,
  ListConversationsInput,
} from "./conversation.types";

import { ConversationRepository } from "./repositories/conversation.repository";

const DEFAULT_CONVERSATION_LIST_LIMIT = 20;
const MAX_CONVERSATION_LIST_LIMIT = 100;

export class ConversationService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
  ) {}

  async createConversation(data: CreateConversationInput) {
    const userId = data.userId.trim();

    if (!userId) {
      throw new Error(
        "User ID is required to create a conversation.",
      );
    }

    const title =
      data.title === undefined
        ? undefined
        : data.title.trim();

    return this.conversationRepository.create({
      userId,
      title,
    });
  }

  async listConversations(
    data: ListConversationsInput,
  ) {
    const userId = data.userId.trim();

    if (!userId) {
      throw new Error(
        "User ID is required to list conversations.",
      );
    }

    const limit =
      data.limit ?? DEFAULT_CONVERSATION_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_CONVERSATION_LIST_LIMIT
    ) {
      throw new Error(
        `Conversation list limit must be an integer between 1 and ${MAX_CONVERSATION_LIST_LIMIT}.`,
      );
    }

    return this.conversationRepository.listByUser(
      userId,
      limit,
    );
  }

  async getConversation(
    data: GetConversationInput,
  ) {
    const conversationId = data.conversationId.trim();
    const userId = data.userId.trim();

    if (!conversationId) {
      throw new Error("Conversation ID is required.");
    }

    if (!userId) {
      throw new Error(
        "User ID is required to get a conversation.",
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

    return conversation;
  }

  async deleteConversation(
    data: DeleteConversationInput,
  ): Promise<void> {
    const conversationId = data.conversationId.trim();
    const userId = data.userId.trim();

    if (!conversationId) {
      throw new Error("Conversation ID is required.");
    }

    if (!userId) {
      throw new Error(
        "User ID is required to delete a conversation.",
      );
    }

    await this.conversationRepository.softDeleteByIdForUser(
      conversationId,
      userId,
    );
  }
}