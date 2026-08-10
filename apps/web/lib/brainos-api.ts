import { auth } from "@clerk/nextjs/server";

const API_URL = process.env.BRAINOS_API_URL;

if (!API_URL) {
  throw new Error("BRAINOS_API_URL is not configured.");
}

async function getAuthHeaders() {
  const { getToken } = await auth();

  const token = await getToken();

console.log("BrainOS frontend auth debug:", {
  hasToken: Boolean(token),
  tokenLength: token?.length ?? 0,
});

  if (!token) {
    throw new Error("Authentication required.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

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

  if (!response.ok) {
    throw new Error(
      `BrainOS API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export async function searchMemories(
  query: string,
  limit?: number,
) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/api/v1/memories/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      limit,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `BrainOS API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}