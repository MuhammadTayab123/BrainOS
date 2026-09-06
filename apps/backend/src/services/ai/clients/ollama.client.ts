import { env } from "../../../config/env";

export class OllamaClient {
  constructor(
    private readonly baseUrl = env.OLLAMA_HOST
  ) {}

  async post<T>(
    endpoint: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(
      `${this.baseUrl}${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ollama request failed (${response.status})`
      );
    }

    return response.json() as Promise<T>;
  }

  async postStream(
    endpoint: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<Response> {
    const response = await fetch(
      `${this.baseUrl}${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ollama request failed (${response.status})`
      );
    }

    if (!response.body) {
      throw new Error("Ollama streaming response body is empty.");
    }

    return response;
  }
}