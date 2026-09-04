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
    timezone?: string;
  },
): Promise<AssistantResponse> {
  const clientTimezone =
    options?.timezone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined);

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
        timezone: clientTimezone,
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

// ==========================
// Tasks API
// ==========================

export type TaskStatus = "TODO" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: string | Date;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | Date | null;
}

export interface ListTasksOptions {
  status?: TaskStatus;
  priority?: TaskPriority;
  dueBefore?: string | Date;
  dueAfter?: string | Date;
  limit?: number;
}

export async function listTasks(
  token: string,
  options?: ListTasksOptions,
): Promise<Task[]> {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  if (options?.priority) {
    params.set("priority", options.priority);
  }

  if (options?.dueBefore) {
    params.set(
      "dueBefore",
      options.dueBefore instanceof Date
        ? options.dueBefore.toISOString()
        : options.dueBefore,
    );
  }

  if (options?.dueAfter) {
    params.set(
      "dueAfter",
      options.dueAfter instanceof Date
        ? options.dueAfter.toISOString()
        : options.dueAfter,
    );
  }

  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/api/v1/tasks${
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

  return parseResponse<Task[]>(response);
}

export async function createTask(
  token: string,
  input: CreateTaskInput,
): Promise<Task> {
  const payload = {
    title: input.title.trim(),
    description: input.description?.trim(),
    priority: input.priority,
    dueAt:
      input.dueAt instanceof Date
        ? input.dueAt.toISOString()
        : input.dueAt,
  };

  const response = await fetch(`${API_URL}/api/v1/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<Task>(response);
}

export async function getTask(
  token: string,
  taskId: string,
): Promise<Task> {
  const response = await fetch(
    `${API_URL}/api/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Task>(response);
}

export async function updateTask(
  token: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<{ id: string }> {
  const payload = {
    title: input.title !== undefined ? input.title.trim() : undefined,
    description:
      input.description === null
        ? null
        : input.description?.trim(),
    priority: input.priority,
    dueAt:
      input.dueAt === null
        ? null
        : input.dueAt instanceof Date
          ? input.dueAt.toISOString()
          : input.dueAt,
  };

  const response = await fetch(
    `${API_URL}/api/v1/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<{ id: string }>(response);
}

export async function completeTask(
  token: string,
  taskId: string,
): Promise<{ id: string; status: TaskStatus }> {
  const response = await fetch(
    `${API_URL}/api/v1/tasks/${encodeURIComponent(taskId)}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseResponse<{ id: string; status: TaskStatus }>(response);
}

export async function deleteTask(
  token: string,
  taskId: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/tasks/${encodeURIComponent(taskId)}`,
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
