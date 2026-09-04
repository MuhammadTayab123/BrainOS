import { env } from "../../../config/env";

export class OmniRouteClient {
  constructor(
    private readonly baseUrl = env.OMNIROUTE_HOST,
    private readonly apiKey = env.OMNIROUTE_API_KEY,
  ) {}

  async post<T>(
    endpoint: string,
    body: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const normalizedBaseUrl = this.baseUrl.replace(/\/+$/, "");
    const normalizedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;

    const response = await fetch(
      `${normalizedBaseUrl}${normalizedEndpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      let errorDetail = "";

      try {
        const text = await response.text();
        if (text) {
          try {
            const parsed = JSON.parse(text) as {
              error?: { message?: string } | string;
              message?: string;
            };

            if (typeof parsed?.error === "string") {
              errorDetail = parsed.error;
            } else if (
              typeof parsed?.error?.message === "string"
            ) {
              errorDetail = parsed.error.message;
            } else if (typeof parsed?.message === "string") {
              errorDetail = parsed.message;
            } else {
              errorDetail = text.slice(0, 300);
            }
          } catch {
            errorDetail = text.slice(0, 300);
          }
        }
      } catch {
        // Fall back to status code error message
      }

      if (this.apiKey && errorDetail.includes(this.apiKey)) {
        errorDetail = errorDetail.replaceAll(this.apiKey, "[REDACTED]");
      }

      const message = errorDetail
        ? `OmniRoute request failed (${response.status}): ${errorDetail}`
        : `OmniRoute request failed (${response.status})`;

      throw new Error(message);
    }

    return response.json() as Promise<T>;
  }
}