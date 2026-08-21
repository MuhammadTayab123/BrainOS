export interface CreateConversationInput {
  userId: string;
  title?: string;
}

export interface ListConversationsInput {
  userId: string;
  limit?: number;
}

export interface GetConversationInput {
  conversationId: string;
  userId: string;
}

export interface DeleteConversationInput {
  conversationId: string;
  userId: string;
}

export interface ConversationListResult {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}