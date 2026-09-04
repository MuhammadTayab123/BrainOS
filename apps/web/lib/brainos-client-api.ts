const API_URL = process.env.NEXT_PUBLIC_BRAINOS_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_BRAINOS_API_URL is not configured.");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.error?.message ??
        `BrainOS API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return result.data as T;
}

// ==========================
// Assistant API
// ==========================

export interface AssistantResponse {
  text: string;
  model: string;
  provider: string;
  retrievedMemories: unknown[];
  retrievedDocuments?: unknown[];
}

export async function askAssistant(
  token: string,
  message: string,
  options?: {
    conversationId?: string;
    enableMemoryRetrieval?: boolean;
    memoryLimit?: number;
    enableDocumentRetrieval?: boolean;
    documentLimit?: number;
  },
): Promise<AssistantResponse> {
  const response = await fetch(
    `${API_URL}/api/v1/assistant/ask`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: message.trim(),
        ...options,
      }),
    },
  );

  return parseResponse<AssistantResponse>(response);
}

// ==========================
// Conversation API
// ==========================

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  updatedAt: string;
}

export async function createConversation(
  token: string,
  title?: string,
): Promise<Conversation> {
  const response = await fetch(
    `${API_URL}/api/v1/conversations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(
        title?.trim()
          ? { title: title.trim() }
          : {},
      ),
    },
  );

  return parseResponse<Conversation>(response);
}

export async function listConversations(
  token: string,
  limit?: number,
): Promise<Conversation[]> {
  const params = new URLSearchParams();

  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/api/v1/conversations${
      queryString ? `?${queryString}` : ""
    }`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Conversation[]>(response);
}

export async function getConversation(
  token: string,
  conversationId: string,
): Promise<Conversation> {
  const response = await fetch(
    `${API_URL}/api/v1/conversations/${conversationId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Conversation>(response);
}

export async function deleteConversation(
  token: string,
  conversationId: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseResponse<{ id: string }>(response);
}

export async function listMessages(
  token: string,
  conversationId: string,
): Promise<Message[]> {
  const response = await fetch(
    `${API_URL}/api/v1/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Message[]>(response);
}