import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import util from "node:util";
import {
  ComputerAgentClient,
  ComputerAgentClientError,
  ComputerAgentRunner,
  ComputerAgentRunnerConfig,
  ComputerAgentRunnerStatus,
} from "../../../../src/services/computer/client";
import { ProtocolErrorCode } from "../../../../src/services/computer/protocol/computer-agent-protocol.types";

describe("ComputerAgentRunner", () => {
  const validClientConfig = {
    baseUrl: "https://brainos.test:3001",
    agentId: "agent-runner-test",
    credential: "ca_sec_test_secret_runner_token",
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

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Configuration & Environment Initialization", () => {
    it("initializes runner successfully with valid client and default interval", () => {
      const client = new ComputerAgentClient(validClientConfig);
      const runner = new ComputerAgentRunner({ client });

      expect(runner.client).toBe(client);
      expect(runner.heartbeatIntervalMs).toBe(30_000);
      expect(runner.status).toBe("STOPPED");
      expect(runner.isRunning).toBe(false);
    });

    it("accepts custom heartbeat interval within valid bounds", () => {
      const client = new ComputerAgentClient(validClientConfig);
      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
      });

      expect(runner.heartbeatIntervalMs).toBe(5000);
    });

    it("fails closed on invalid heartbeat interval (< 100ms)", () => {
      const client = new ComputerAgentClient(validClientConfig);
      expect(
        () =>
          new ComputerAgentRunner({
            client,
            heartbeatIntervalMs: 50,
          }),
      ).toThrowError(/Heartbeat interval must be at least 100ms/);
    });

    it("fails closed on missing or invalid client instance", () => {
      expect(
        () => new ComputerAgentRunner({ client: null as any }),
      ).toThrowError(ComputerAgentClientError);
    });

    it("initializes runner from environment variables using fromEnv()", () => {
      const env: NodeJS.ProcessEnv = {
        BRAINOS_BACKEND_URL: "https://api.brainos.test",
        BRAINOS_AGENT_ID: "env-runner-agent",
        BRAINOS_AGENT_CREDENTIAL: "ca_sec_env_runner_token",
        BRAINOS_AGENT_HEARTBEAT_INTERVAL_MS: "15000",
      };

      const runner = ComputerAgentRunner.fromEnv(env);
      expect(runner.client.baseUrl).toBe("https://api.brainos.test");
      expect(runner.client.agentId).toBe("env-runner-agent");
      expect(runner.heartbeatIntervalMs).toBe(15_000);
    });
  });

  describe("Lifecycle: start() and Immediate Ping", () => {
    it("performs immediate authenticated ping and transitions to RUNNING", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack-1",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged", receivedAt: Date.now() },
        }),
      );

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const onStatusChange = vi.fn();
      const onHeartbeatSuccess = vi.fn();

      const runner = new ComputerAgentRunner({
        client,
        onStatusChange,
        onHeartbeatSuccess,
      });

      await runner.start();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(runner.status).toBe("RUNNING");
      expect(runner.isRunning).toBe(true);

      const state = runner.getState();
      expect(state.status).toBe("RUNNING");
      expect(state.startedAt).toBeDefined();
      expect(state.lastHeartbeatAt).toBeDefined();
      expect(state.lastHeartbeatSuccess).toBe(true);
      expect(state.consecutiveSuccesses).toBe(1);
      expect(state.consecutiveFailures).toBe(0);

      expect(onStatusChange).toHaveBeenCalledWith("STARTING", "STOPPED");
      expect(onStatusChange).toHaveBeenCalledWith("RUNNING", "STARTING");
      expect(onHeartbeatSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "agent-runner-test",
          consecutiveSuccesses: 1,
        }),
      );
    });

    it("supports skipImmediatePing option", async () => {
      const mockFetch = vi.fn();
      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({ client });
      await runner.start({ skipImmediatePing: true });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(runner.status).toBe("RUNNING");
      expect(runner.getState().consecutiveSuccesses).toBe(0);
    });

    it("prevents duplicate start() when runner is already running", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged" },
        }),
      );

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({ client });
      await runner.start();

      await expect(runner.start()).rejects.toMatchObject({
        code: "ALREADY_RUNNING",
        statusCode: 409,
      });
    });

    it("fails closed on immediate ping failure and transitions to ERROR", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse(
          {
            id: "env-err",
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
        ...validClientConfig,
        fetch: mockFetch,
      });

      const onHeartbeatError = vi.fn();
      const runner = new ComputerAgentRunner({
        client,
        onHeartbeatError,
      });

      await expect(runner.start()).rejects.toMatchObject({
        code: ProtocolErrorCode.UNAUTHORIZED,
        statusCode: 401,
      });

      expect(runner.status).toBe("ERROR");
      expect(runner.isRunning).toBe(false);
      expect(runner.getState().lastHeartbeatSuccess).toBe(false);
      expect(runner.getState().consecutiveFailures).toBe(1);
      expect(onHeartbeatError).toHaveBeenCalled();
    });
  });

  describe("Periodic Heartbeat Loop", () => {
    it("executes periodic heartbeats at the configured interval", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged" },
        }),
      );

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
      });

      await runner.start();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance by 5s (first scheduled heartbeat)
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(runner.getState().consecutiveSuccesses).toBe(2);

      // Advance by another 5s (second scheduled heartbeat)
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(runner.getState().consecutiveSuccesses).toBe(3);

      await runner.stop();
    });

    it("recovers gracefully from temporary periodic heartbeat failure without stopping runner", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          // Second ping fails with network error
          throw new Error("Temporary network timeout");
        }
        return createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged" },
        });
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const onHeartbeatError = vi.fn();
      const onHeartbeatSuccess = vi.fn();

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
        onHeartbeatError,
        onHeartbeatSuccess,
      });

      await runner.start(); // Call 1: success
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(runner.getState().consecutiveSuccesses).toBe(1);

      // Advance 5s: Call 2 fails
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(runner.status).toBe("RUNNING"); // Stays running
      expect(runner.getState().consecutiveFailures).toBe(1);
      expect(runner.getState().consecutiveSuccesses).toBe(0);
      expect(onHeartbeatError).toHaveBeenCalledWith(
        expect.objectContaining({
          consecutiveFailures: 1,
        }),
      );

      // Advance 5s: Call 3 succeeds (recovery)
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(runner.getState().consecutiveSuccesses).toBe(1);
      expect(runner.getState().consecutiveFailures).toBe(0);

      await runner.stop();
    });
  });

  describe("Lifecycle: stop() and restart()", () => {
    it("cleans up active timers and transitions to STOPPED on stop()", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged" },
        }),
      );

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
      });

      await runner.start();
      expect(runner.status).toBe("RUNNING");

      await runner.stop();
      expect(runner.status).toBe("STOPPED");
      expect(runner.isRunning).toBe(false);

      // Advancing timer should NOT trigger any new pings
      await vi.advanceTimersByTimeAsync(20_000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("is idempotent when stop() is called multiple times", async () => {
      const client = new ComputerAgentClient(validClientConfig);
      const runner = new ComputerAgentRunner({ client });

      await runner.stop();
      expect(runner.status).toBe("STOPPED");

      await runner.stop();
      expect(runner.status).toBe("STOPPED");
    });

    it("can be restarted cleanly after being stopped", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged" },
        }),
      );

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
      });

      // 1. First run
      await runner.start();
      expect(runner.status).toBe("RUNNING");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await runner.stop();
      expect(runner.status).toBe("STOPPED");

      // 2. Second run (restart)
      await runner.start();
      expect(runner.status).toBe("RUNNING");
      expect(mockFetch).toHaveBeenCalledTimes(2);

      await runner.stop();
      expect(runner.status).toBe("STOPPED");
    });
  });

  describe("AbortSignal Cancellation & External Shutdown", () => {
    it("fails immediately if start() is passed an already aborted signal", async () => {
      const controller = new AbortController();
      controller.abort();

      const mockFetch = vi.fn();
      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({ client });

      await expect(
        runner.start({ signal: controller.signal }),
      ).rejects.toMatchObject({
        code: "ABORTED",
        statusCode: 499,
      });

      expect(runner.status).toBe("STOPPED");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("stops cleanly when external AbortSignal is aborted while running", async () => {
      const controller = new AbortController();

      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          id: "env-ack",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
          data: { status: "acknowledged" },
        }),
      );

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
      });

      await runner.start({ signal: controller.signal });
      expect(runner.status).toBe("RUNNING");

      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      expect(runner.status).toBe("STOPPED");
      expect(runner.isRunning).toBe(false);

      // Further time advancement triggers no new pings
      await vi.advanceTimersByTimeAsync(15_000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Credential Privacy & Zero Leakage", () => {
    it("never includes secret credential in runner state, toJSON(), or util.inspect", () => {
      const client = new ComputerAgentClient(validClientConfig);
      const runner = new ComputerAgentRunner({ client });

      const state = runner.getState();
      const stateStr = JSON.stringify(state);
      expect(stateStr).not.toContain("ca_sec_test_secret_runner_token");

      const json = runner.toJSON();
      const jsonStr = JSON.stringify(json);
      expect(jsonStr).not.toContain("ca_sec_test_secret_runner_token");

      const inspected = util.inspect(runner);
      expect(inspected).not.toContain("ca_sec_test_secret_runner_token");
    });
  });
});
