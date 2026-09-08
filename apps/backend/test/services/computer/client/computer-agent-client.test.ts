import { describe, expect, it, vi } from "vitest";
import util from "node:util";
import {
  ComputerAgentClient,
  ComputerAgentClientConfig,
  ComputerAgentClientError,
} from "../../../../src/services/computer/client";
import {
  COMPUTER_AGENT_PROTOCOL_VERSION,
  ProtocolErrorCode,
} from "../../../../src/services/computer/protocol/computer-agent-protocol.types";
import { ComputerActionName } from "../../../../src/services/computer/dispatch/computer-agent-dispatch.types";

describe("ComputerAgentClient", () => {
  const validConfig: ComputerAgentClientConfig = {
    baseUrl: "https://brainos.test:3001",
    agentId: "agent-test-123",
    credential: "ca_sec_test_secret_credential_token_999",
    timeoutMs: 5000,
  };

  const createMockResponse = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = { "content-type": "application/json" },
  ): Response => {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      headers: new Headers(headers),
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    } as unknown as Response;
  };

  describe("Configuration & Environment Initialization", () => {
    it("initializes successfully with valid configuration", () => {
      const client = new ComputerAgentClient(validConfig);
      expect(client.baseUrl).toBe("https://brainos.test:3001");
      expect(client.agentId).toBe("agent-test-123");
      expect(client.timeoutMs).toBe(5000);
    });

    it("strips trailing slashes from baseUrl", () => {
      const client = new ComputerAgentClient({
        ...validConfig,
        baseUrl: "https://brainos.test:3001///",
      });
      expect(client.baseUrl).toBe("https://brainos.test:3001");
    });

    it("fails closed on invalid or missing baseUrl", () => {
      expect(
        () => new ComputerAgentClient({ ...validConfig, baseUrl: "" }),
      ).toThrowError(ComputerAgentClientError);

      expect(
        () => new ComputerAgentClient({ ...validConfig, baseUrl: "not-a-valid-url" }),
      ).toThrowError(ComputerAgentClientError);
    });

    it("fails closed on missing agentId", () => {
      expect(
        () => new ComputerAgentClient({ ...validConfig, agentId: "" }),
      ).toThrowError(/agentId is required/);
    });

    it("fails closed on missing credential", () => {
      expect(
        () => new ComputerAgentClient({ ...validConfig, credential: "" }),
      ).toThrowError(/credential is required/);
    });

    it("initializes from environment variables using fromEnv()", () => {
      const env: NodeJS.ProcessEnv = {
        BRAINOS_BACKEND_URL: "https://api.brainos.test",
        BRAINOS_AGENT_ID: "env-agent-456",
        BRAINOS_AGENT_CREDENTIAL: "ca_sec_env_secret_token",
        BRAINOS_AGENT_TIMEOUT_MS: "8000",
      };

      const client = ComputerAgentClient.fromEnv(env);
      expect(client.baseUrl).toBe("https://api.brainos.test");
      expect(client.agentId).toBe("env-agent-456");
      expect(client.timeoutMs).toBe(8000);
    });

    it("supports fallback environment variable names", () => {
      const env: NodeJS.ProcessEnv = {
        COMPUTER_AGENT_BACKEND_URL: "https://agent.brainos.test",
        COMPUTER_AGENT_ID: "agent-fallback",
        COMPUTER_AGENT_CREDENTIAL: "ca_sec_fallback_cred",
      };

      const client = ComputerAgentClient.fromEnv(env);
      expect(client.baseUrl).toBe("https://agent.brainos.test");
      expect(client.agentId).toBe("agent-fallback");
      expect(client.timeoutMs).toBe(30000); // default
    });

    it("fails closed when fromEnv is missing required variables", () => {
      expect(() => ComputerAgentClient.fromEnv({})).toThrowError(
        /Missing BrainOS backend URL/,
      );

      expect(
        () =>
          ComputerAgentClient.fromEnv({
            BRAINOS_BACKEND_URL: "https://test.local",
          }),
      ).toThrowError(/Missing Agent ID/);

      expect(
        () =>
          ComputerAgentClient.fromEnv({
            BRAINOS_BACKEND_URL: "https://test.local",
            BRAINOS_AGENT_ID: "agent-1",
          }),
      ).toThrowError(/Missing Agent Credential/);
    });
  });

  describe("Authentication Headers & Envelope Creation", () => {
    it("sends correct authentication headers and envelope structure", async () => {
      let interceptedUrl = "";
      let interceptedHeaders: HeadersInit | undefined;
      let interceptedBody: string | undefined;

      const mockFetch = vi.fn().mockImplementation(async (url, init) => {
        interceptedUrl = url;
        interceptedHeaders = init?.headers;
        interceptedBody = init?.body;

        return createMockResponse({
          id: "resp-env-1",
          version: COMPUTER_AGENT_PROTOCOL_VERSION,
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged", receivedAt: Date.now() },
        });
      });

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      const beforeTime = Date.now();
      const response = await client.ping();
      const afterTime = Date.now();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(interceptedUrl).toBe(
        "https://brainos.test:3001/api/v1/computer-agents/protocol/messages",
      );

      // Verify headers
      const headers = interceptedHeaders as Record<string, string>;
      expect(headers["x-agent-id"]).toBe("agent-test-123");
      expect(headers["x-agent-credential"]).toBe(
        "ca_sec_test_secret_credential_token_999",
      );
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Accept"]).toBe("application/json");

      // Verify envelope shape
      expect(interceptedBody).toBeDefined();
      const parsedEnvelope = JSON.parse(interceptedBody!);
      expect(parsedEnvelope.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(parsedEnvelope.version).toBe("1.0");
      expect(parsedEnvelope.type).toBe("ping");
      expect(parsedEnvelope.agentId).toBe("agent-test-123");
      expect(parsedEnvelope.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(parsedEnvelope.timestamp).toBeLessThanOrEqual(afterTime);
      expect(parsedEnvelope.payload).toEqual({ ping: true });

      // Verify returned response
      expect(response.success).toBe(true);
      expect(response.id).toBe("resp-env-1");
      expect(response.data).toEqual(
        expect.objectContaining({ status: "acknowledged" }),
      );
    });
  });

  describe("Ping & Action Execution", () => {
    it("executes ping() correctly", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: 1725850000000,
          data: { status: "acknowledged", receivedAt: 1725850000000 },
        }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      const res = await client.ping();
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("acknowledged");
    });

    it("executes sendAction() with action name, correlationId and parameters", async () => {
      let sentEnvelope: any;

      const mockFetch = vi.fn().mockImplementation(async (_url, init) => {
        sentEnvelope = JSON.parse(init.body);
        return createMockResponse({
          id: sentEnvelope.id,
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { success: true, appId: "calc" },
        });
      });

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      const res = await client.sendAction(
        ComputerActionName.LAUNCH_APPLICATION,
        { appId: "calc" },
      );

      expect(res.success).toBe(true);
      expect(res.data).toEqual({ success: true, appId: "calc" });

      expect(sentEnvelope.type).toBe("action_request");
      expect(sentEnvelope.payload.action).toBe("computer_launch_application");
      expect(sentEnvelope.payload.params).toEqual({ appId: "calc" });
      expect(sentEnvelope.payload.correlationId).toBeDefined();
    });

    it("rejects empty action name before network call", async () => {
      const mockFetch = vi.fn();
      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      await expect(client.sendAction("")).rejects.toThrowError(
        /Action name must be a non-empty string/,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Response Validation & Error Handling", () => {
    it("handles structured error response from server with HTTP 200", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "err-1",
          version: "1.0",
          success: false,
          timestamp: Date.now(),
          error: {
            code: ProtocolErrorCode.ACTION_FAILED,
            message: "Action not permitted for this agent.",
          },
        }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      const res = await client.sendAction(ComputerActionName.WRITE_FILE, {
        path: "test.txt",
        content: "hello",
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
      expect(res.error?.message).toBe("Action not permitted for this agent.");
    });

    it("handles HTTP 401 unauthorized error envelope from server", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          {
            id: "err-401",
            version: "1.0",
            success: false,
            timestamp: Date.now(),
            error: {
              code: ProtocolErrorCode.UNAUTHORIZED,
              message: "Invalid agent credentials.",
            },
          },
          401,
        ),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      await expect(client.ping()).rejects.toThrowError(ComputerAgentClientError);
      await expect(client.ping()).rejects.toMatchObject({
        code: ProtocolErrorCode.UNAUTHORIZED,
        statusCode: 401,
        message: "Invalid agent credentials.",
      });
    });

    it("fails closed on non-JSON response from server", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse("<html>502 Bad Gateway</html>", 502, {
          "content-type": "text/html",
        }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      await expect(client.ping()).rejects.toThrowError(
        /Invalid JSON response from BrainOS server/,
      );
    });

    it("fails closed on malformed response envelope structure", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          randomField: "missing id and version",
        }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      await expect(client.ping()).rejects.toThrowError(
        /Response envelope id must be a non-empty string/,
      );
    });

    it("fails closed on unsupported protocol version in response", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-1",
          version: "99.0",
          success: true,
          timestamp: Date.now(),
        }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      await expect(client.ping()).rejects.toThrowError(
        /Unsupported protocol version/,
      );
    });
  });

  describe("Timeout & Cancellation", () => {
    it("throws TIMEOUT error when request duration exceeds timeoutMs", async () => {
      const mockFetch = vi.fn().mockImplementation(
        (_url, init) =>
          new Promise((resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        timeoutMs: 50,
        fetch: mockFetch,
      });

      await expect(client.ping()).rejects.toMatchObject({
        code: ProtocolErrorCode.TIMEOUT,
        statusCode: 408,
      });
    });

    it("throws ABORTED error when user aborts via AbortSignal", async () => {
      const controller = new AbortController();

      const mockFetch = vi.fn().mockImplementation(
        (_url, init) =>
          new Promise((resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      );

      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      const pingPromise = client.ping({ signal: controller.signal });
      controller.abort();

      await expect(pingPromise).rejects.toMatchObject({
        code: "ABORTED",
      });
    });

    it("rejects immediately if signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const mockFetch = vi.fn();
      const client = new ComputerAgentClient({
        ...validConfig,
        fetch: mockFetch,
      });

      await expect(client.ping({ signal: controller.signal })).rejects.toMatchObject({
        code: "ABORTED",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Credential Security & Zero Leakage", () => {
    it("never includes credential in toJSON()", () => {
      const client = new ComputerAgentClient(validConfig);
      const serialized = JSON.stringify(client);
      expect(serialized).not.toContain("ca_sec_test_secret_credential_token_999");
      expect(client.toJSON().credential).toBe("[REDACTED]");
    });

    it("never includes credential in util.inspect / console representation", () => {
      const client = new ComputerAgentClient(validConfig);
      const inspected = util.inspect(client);
      expect(inspected).not.toContain("ca_sec_test_secret_credential_token_999");
      expect(inspected).toContain("[REDACTED]");
    });

    it("ComputerAgentClientError sanitizes credentials from message and details", () => {
      const secret = "ca_sec_my_super_secret_key_12345";
      const error = new ComputerAgentClientError({
        message: `Failed connecting with token ${secret}`,
        code: ProtocolErrorCode.UNAUTHORIZED,
        details: {
          token: secret,
          credential: secret,
          nested: { password: secret, info: `key ${secret}` },
        },
      });

      expect(error.message).not.toContain(secret);
      expect(error.message).toContain("[REDACTED]");

      const json = error.toJSON();
      const jsonStr = JSON.stringify(json);
      expect(jsonStr).not.toContain(secret);
      expect((json.details as any).token).toBe("[REDACTED]");
      expect((json.details as any).credential).toBe("[REDACTED]");
      expect((json.details as any).nested.password).toBe("[REDACTED]");
      expect((json.details as any).nested.info).toBe("key [REDACTED]");
    });
  });
});
