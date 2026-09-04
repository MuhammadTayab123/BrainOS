import { afterEach, describe, expect, it, vi } from "vitest";

import { OmniRouteClient } from "../../src/services/ai/clients/omniroute.client";

describe("OmniRouteClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes trailing slash in baseUrl and missing leading slash in endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as unknown as Response);

    const client = new OmniRouteClient("http://localhost:20128/", "secret-token");

    await client.post("v1/chat/completions", { hello: "world" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:20128/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token",
        },
        body: JSON.stringify({ hello: "world" }),
      }),
    );
  });

  it("includes safe error details in error message without leaking API keys", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            message: "Invalid token: test-secret-key-12345",
          },
        }),
    } as unknown as Response);

    const client = new OmniRouteClient(
      "http://localhost:20128",
      "test-secret-key-12345",
    );

    await expect(
      client.post("/v1/chat/completions", {}),
    ).rejects.toThrow(
      "OmniRoute request failed (400): Invalid token: [REDACTED]",
    );
  });
});
