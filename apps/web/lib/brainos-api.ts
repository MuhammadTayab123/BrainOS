import { auth } from "@clerk/nextjs/server";

const API_URL = process.env.BRAINOS_API_URL;

if (!API_URL) {
  throw new Error("BRAINOS_API_URL is not configured.");
}

export interface Automation {
  id: string;
  userId: string;
  name: string;
  status: string;
  triggerType: string;
  actionType: string;
  config: Record<string, unknown>;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationInput {
  name: string;
  triggerType: string;
  actionType: string;
  config: Record<string, unknown>;
  nextRunAt?: string;
}

async function getAuthHeaders() {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    throw new Error("Authentication required.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
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
// Memory API
// ==========================

export async function createMemory(
  content: string,
  importance?: number,
) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/v1/memories`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content,
      importance,
    }),
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function searchMemories(
  query: string,
  limit?: number,
) {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/memories/search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        limit,
      }),
      cache: "no-store",
    },
  );

  return parseResponse(response);
}

// ==========================
// Automation API
// ==========================

export async function createAutomation(
  input: AutomationInput,
): Promise<Automation> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/automations`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );

  return parseResponse<Automation>(response);
}

export async function listAutomations(
  options?: {
    limit?: number;
    status?: string;
  },
): Promise<Automation[]> {
  const headers = await getAuthHeaders();

  const params = new URLSearchParams();

  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options?.status) {
    params.set("status", options.status);
  }

  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/api/v1/automations${
      queryString ? `?${queryString}` : ""
    }`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
  );

  return parseResponse<Automation[]>(response);
}

export async function getAutomation(
  automationId: string,
): Promise<Automation> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/automations/${automationId}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
  );

  return parseResponse<Automation>(response);
}

export async function updateAutomation(
  automationId: string,
  input: {
    name?: string;
    status?: string;
    config?: Record<string, unknown>;
    nextRunAt?: string | null;
  },
): Promise<{ id: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/automations/${automationId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );

  return parseResponse<{ id: string }>(response);
}

export async function pauseAutomation(
  automationId: string,
): Promise<{
  id: string;
  status: string;
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/automations/${automationId}/pause`,
    {
      method: "POST",
      headers,
      cache: "no-store",
    },
  );

  return parseResponse(response);
}

export async function resumeAutomation(
  automationId: string,
): Promise<{
  id: string;
  status: string;
}> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/automations/${automationId}/resume`,
    {
      method: "POST",
      headers,
      cache: "no-store",
    },
  );

  return parseResponse(response);
}

export async function deleteAutomation(
  automationId: string,
): Promise<{ id: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/api/v1/automations/${automationId}`,
    {
      method: "DELETE",
      headers,
      cache: "no-store",
    },
  );

  return parseResponse<{ id: string }>(response);
}