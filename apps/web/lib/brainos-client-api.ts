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

export interface AssistantStateSnapshot {
  state: "IDLE" | "THINKING" | "EXECUTING" | "SPEAKING" | "ERROR";
  activeTaskId: string | null;
}

export interface AssistantTaskEvent {
  type: "TASK_STARTED" | "TASK_PROGRESS" | "TASK_COMPLETED" | "TASK_FAILED";
  taskId: string;
  message: string;
  timestamp: string;
}

export type AssistantStreamEvent =
  | { type: "state_changed"; data: AssistantStateSnapshot }
  | { type: "task_event"; data: AssistantTaskEvent }
  | { type: "text_delta"; data: { delta: string } }
  | { type: "response"; data: AssistantResponse }
  | { type: "error"; data: { message: string } }
  | { type: "done"; data: Record<string, unknown> };

export interface StreamAssistantOptions {
  conversationId?: string;
  enableMemoryRetrieval?: boolean;
  memoryLimit?: number;
  enableDocumentRetrieval?: boolean;
  documentLimit?: number;
  timezone?: string;
  signal?: AbortSignal;
  onEvent?: (event: AssistantStreamEvent) => void;
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

export async function streamAssistant(
  token: string,
  message: string,
  options?: StreamAssistantOptions,
): Promise<AssistantResponse> {
  const clientTimezone =
    options?.timezone ??
    (typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined);

  const { signal, onEvent, ...requestOptions } = options ?? {};

  const response = await fetch(
    `${API_URL}/api/v1/assistant/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: message.trim(),
        timezone: clientTimezone,
        ...requestOptions,
      }),
      signal,
    },
  );

  if (!response.ok) {
    let errorMessage = `BrainOS stream request failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // Fall back to default status text message
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error("Streaming response body is not readable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: AssistantResponse | null = null;
  let streamError: Error | null = null;

  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let eventType = "message";
    let dataStr = "";
    let hasData = false;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const value = line.slice(5).trim();
        dataStr = dataStr ? `${dataStr}\n${value}` : value;
        hasData = true;
      }
    }

    if (!hasData && eventType === "message") {
      return;
    }

    let parsedData: unknown = dataStr;
    if (dataStr) {
      try {
        parsedData = JSON.parse(dataStr);
      } catch {
        // Fall back to raw string
      }
    }

    if (eventType === "state_changed") {
      const typedEvent: AssistantStreamEvent = {
        type: "state_changed",
        data: parsedData as AssistantStateSnapshot,
      };
      onEvent?.(typedEvent);
    } else if (eventType === "task_event") {
      const typedEvent: AssistantStreamEvent = {
        type: "task_event",
        data: parsedData as AssistantTaskEvent,
      };
      onEvent?.(typedEvent);
    } else if (eventType === "text_delta") {
      const deltaData = (parsedData as { delta?: string }) ?? {};
      const delta = typeof deltaData.delta === "string" ? deltaData.delta : "";
      const typedEvent: AssistantStreamEvent = {
        type: "text_delta",
        data: { delta },
      };
      onEvent?.(typedEvent);
    } else if (eventType === "response") {
      finalResponse = parsedData as AssistantResponse;
      const typedEvent: AssistantStreamEvent = {
        type: "response",
        data: finalResponse,
      };
      onEvent?.(typedEvent);
    } else if (eventType === "error") {
      const errorData = (parsedData as { message?: string }) ?? {};
      streamError = new Error(errorData.message || "Assistant stream failed.");
      const typedEvent: AssistantStreamEvent = {
        type: "error",
        data: { message: streamError.message },
      };
      onEvent?.(typedEvent);
    } else if (eventType === "done") {
      const typedEvent: AssistantStreamEvent = {
        type: "done",
        data: (parsedData as Record<string, unknown>) ?? {},
      };
      onEvent?.(typedEvent);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split(/(?:\r?\n){2}/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (part.trim()) {
          processBlock(part);
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      processBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (streamError) {
    throw streamError;
  }

  if (!finalResponse) {
    throw new Error("Stream terminated without delivering a response.");
  }

  return finalResponse;
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

// ==========================
// Reminders API
// ==========================

export type ReminderStatus =
  | "PENDING"
  | "PROCESSING"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED";

export interface Reminder {
  id: string;
  userId: string;
  taskId: string | null;
  message: string;
  scheduledFor: string;
  status: ReminderStatus;
  attempts: number;
  deliveredAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  message: string;
  scheduledFor: string | Date;
  taskId?: string;
}

export interface ListRemindersOptions {
  status?: ReminderStatus;
  dueBefore?: string | Date;
  limit?: number;
}

export async function listReminders(
  token: string,
  options?: ListRemindersOptions,
): Promise<Reminder[]> {
  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  if (options?.dueBefore) {
    params.set(
      "dueBefore",
      options.dueBefore instanceof Date
        ? options.dueBefore.toISOString()
        : options.dueBefore,
    );
  }

  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/api/v1/reminders${
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

  return parseResponse<Reminder[]>(response);
}

export async function createReminder(
  token: string,
  input: CreateReminderInput,
): Promise<Reminder> {
  const payload = {
    message: input.message.trim(),
    scheduledFor:
      input.scheduledFor instanceof Date
        ? input.scheduledFor.toISOString()
        : input.scheduledFor,
    taskId: input.taskId ? input.taskId.trim() : undefined,
  };

  const response = await fetch(`${API_URL}/api/v1/reminders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<Reminder>(response);
}

export async function getReminder(
  token: string,
  reminderId: string,
): Promise<Reminder> {
  const response = await fetch(
    `${API_URL}/api/v1/reminders/${encodeURIComponent(reminderId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Reminder>(response);
}

export async function cancelReminder(
  token: string,
  reminderId: string,
): Promise<{ id: string; status: ReminderStatus }> {
  const response = await fetch(
    `${API_URL}/api/v1/reminders/${encodeURIComponent(reminderId)}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseResponse<{ id: string; status: ReminderStatus }>(response);
}

export async function deleteReminder(
  token: string,
  reminderId: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/reminders/${encodeURIComponent(reminderId)}`,
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

// ==========================
// Documents API
// ==========================

export type DocumentSourceType = "UPLOAD" | "TEXT" | "URL";

export type DocumentStatus = "PENDING" | "READY" | "FAILED" | "DELETED";

export interface Document {
  id: string;
  title: string;
  sourceType: DocumentSourceType;
  source: string | null;
  content: string | null;
  mimeType: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSearchResult {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceType: DocumentSourceType;
  source: string | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export interface ListDocumentsOptions {
  status?: DocumentStatus;
  limit?: number;
}

export interface CreateTextDocumentInput {
  title: string;
  content: string;
}

export interface UploadDocumentInput {
  title: string;
  file: File;
}

export async function listDocuments(
  token: string,
  options?: ListDocumentsOptions,
): Promise<Document[]> {
  const params = new URLSearchParams();
  if (options?.status) {
    params.set("status", options.status);
  }
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const endpoint = query
    ? `${API_URL}/api/v1/documents?${query}`
    : `${API_URL}/api/v1/documents`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return parseResponse<Document[]>(response);
}

export async function uploadDocument(
  token: string,
  input: UploadDocumentInput,
): Promise<Document> {
  const formData = new FormData();
  formData.append("title", input.title.trim());
  formData.append("sourceType", "UPLOAD");
  formData.append("file", input.file);

  const response = await fetch(`${API_URL}/api/v1/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return parseResponse<Document>(response);
}

export async function createTextDocument(
  token: string,
  input: CreateTextDocumentInput,
): Promise<Document> {
  const response = await fetch(`${API_URL}/api/v1/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: input.title.trim(),
      sourceType: "TEXT",
      content: input.content.trim(),
    }),
  });

  return parseResponse<Document>(response);
}

export async function getDocument(
  token: string,
  documentId: string,
): Promise<Document> {
  const response = await fetch(
    `${API_URL}/api/v1/documents/${encodeURIComponent(documentId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Document>(response);
}

export async function deleteDocument(
  token: string,
  documentId: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/documents/${encodeURIComponent(documentId)}`,
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

export async function searchDocuments(
  token: string,
  query: string,
  limit?: number,
): Promise<DocumentSearchResult[]> {
  const response = await fetch(`${API_URL}/api/v1/documents/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: query.trim(),
      ...(limit !== undefined ? { limit } : {}),
    }),
  });

  return parseResponse<DocumentSearchResult[]>(response);
}

// ==========================
// Memory API
// ==========================

export interface Memory {
  id: string;
  content: string;
  importance: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  similarity: number;
  importance: number;
}

export interface CreateMemoryInput {
  content: string;
  importance?: number;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
}

export interface ListMemoriesOptions {
  limit?: number;
}

export async function listMemories(
  token: string,
  options?: ListMemoriesOptions,
): Promise<Memory[]> {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const endpoint = query
    ? `${API_URL}/api/v1/memories?${query}`
    : `${API_URL}/api/v1/memories`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return parseResponse<Memory[]>(response);
}

export async function createMemory(
  token: string,
  input: CreateMemoryInput,
): Promise<Memory> {
  const response = await fetch(`${API_URL}/api/v1/memories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content: input.content.trim(),
      ...(input.importance !== undefined ? { importance: input.importance } : {}),
    }),
  });

  return parseResponse<Memory>(response);
}

export async function getMemory(
  token: string,
  memoryId: string,
): Promise<Memory> {
  const response = await fetch(
    `${API_URL}/api/v1/memories/${encodeURIComponent(memoryId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Memory>(response);
}

export async function updateMemory(
  token: string,
  memoryId: string,
  input: UpdateMemoryInput,
): Promise<Memory> {
  const payload: Record<string, unknown> = {};
  if (input.content !== undefined) {
    payload.content = input.content.trim();
  }
  if (input.importance !== undefined) {
    payload.importance = input.importance;
  }

  const response = await fetch(
    `${API_URL}/api/v1/memories/${encodeURIComponent(memoryId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return parseResponse<Memory>(response);
}

export async function deleteMemory(
  token: string,
  memoryId: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/memories/${encodeURIComponent(memoryId)}`,
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

export async function searchMemories(
  token: string,
  query: string,
  limit?: number,
): Promise<MemorySearchResult[]> {
  const response = await fetch(`${API_URL}/api/v1/memories/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: query.trim(),
      ...(limit !== undefined ? { limit } : {}),
    }),
  });

  return parseResponse<MemorySearchResult[]>(response);
}

// ==========================
// Automation API
// ==========================

export type AutomationStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "FAILED";
export type AutomationTriggerType = "SCHEDULE" | "TASK_DUE" | "REMINDER_DUE";
export type AutomationActionType = "CREATE_TASK" | "CREATE_REMINDER";

export interface Automation {
  id: string;
  userId: string;
  name: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  config: Record<string, unknown>;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationInput {
  name: string;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  config: Record<string, unknown>;
  nextRunAt?: string | Date;
}

export interface UpdateAutomationInput {
  name?: string;
  status?: AutomationStatus;
  config?: Record<string, unknown>;
  nextRunAt?: string | Date | null;
}

export interface ListAutomationsOptions {
  status?: AutomationStatus;
  limit?: number;
}

export async function listAutomations(
  token: string,
  options?: ListAutomationsOptions,
): Promise<Automation[]> {
  const params = new URLSearchParams();
  if (options?.status !== undefined) {
    params.set("status", options.status);
  }
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const endpoint = query
    ? `${API_URL}/api/v1/automations?${query}`
    : `${API_URL}/api/v1/automations`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return parseResponse<Automation[]>(response);
}

export async function createAutomation(
  token: string,
  input: CreateAutomationInput,
): Promise<Automation> {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    triggerType: input.triggerType,
    actionType: input.actionType,
    config: input.config,
  };

  if (input.nextRunAt !== undefined) {
    payload.nextRunAt =
      input.nextRunAt instanceof Date
        ? input.nextRunAt.toISOString()
        : input.nextRunAt;
  }

  const response = await fetch(`${API_URL}/api/v1/automations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<Automation>(response);
}

export async function getAutomation(
  token: string,
  automationId: string,
): Promise<Automation> {
  const response = await fetch(
    `${API_URL}/api/v1/automations/${encodeURIComponent(automationId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse<Automation>(response);
}

export async function updateAutomation(
  token: string,
  automationId: string,
  input: UpdateAutomationInput,
): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }
  if (input.config !== undefined) {
    payload.config = input.config;
  }
  if (input.nextRunAt !== undefined) {
    payload.nextRunAt =
      input.nextRunAt instanceof Date
        ? input.nextRunAt.toISOString()
        : input.nextRunAt;
  }

  const response = await fetch(
    `${API_URL}/api/v1/automations/${encodeURIComponent(automationId)}`,
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

export async function pauseAutomation(
  token: string,
  automationId: string,
): Promise<{ id: string; status: AutomationStatus }> {
  const response = await fetch(
    `${API_URL}/api/v1/automations/${encodeURIComponent(automationId)}/pause`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseResponse<{ id: string; status: AutomationStatus }>(response);
}

export async function resumeAutomation(
  token: string,
  automationId: string,
): Promise<{ id: string; status: AutomationStatus }> {
  const response = await fetch(
    `${API_URL}/api/v1/automations/${encodeURIComponent(automationId)}/resume`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseResponse<{ id: string; status: AutomationStatus }>(response);
}

export async function deleteAutomation(
  token: string,
  automationId: string,
): Promise<{ id: string }> {
  const response = await fetch(
    `${API_URL}/api/v1/automations/${encodeURIComponent(automationId)}`,
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
