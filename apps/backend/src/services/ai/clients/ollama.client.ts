import { env } from "../../../config/env";

export class OllamaClient {
  constructor(
    private readonly baseUrl = env.OLLAMA_HOST
  ) {}

  async post<T>(
    endpoint: string,
    body: unknown
  ): Promise<T> {
    const response = await fetch(
      `${this.baseUrl}${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ollama request failed (${response.status})`
      );
    }

    return response.json() as Promise<T>;
  }
}