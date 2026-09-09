import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import util from "node:util";
import {
  ComputerAgentClient,
  ComputerAgentClientError,
  ComputerAgentRunner,
  ComputerAgentRunnerConfig,
  ComputerAgentRunnerStatus,
  DefaultHostActionExecutor,
  HostActionExecutor,
} from "../../../../src/services/computer/client";
import { ComputerAgent } from "../../../../src/services/computer/agent/computer-agent.types";
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
    it("initializes runner successfully with valid client and default intervals", () => {
      const client = new ComputerAgentClient(validClientConfig);
      const runner = new ComputerAgentRunner({ client });

      expect(runner.client).toBe(client);
      expect(runner.heartbeatIntervalMs).toBe(30_000);
      expect(runner.actionPollingIntervalMs).toBe(3_000);
      expect(runner.actionPollingEnabled).toBe(true);
      expect(runner.status).toBe("STOPPED");
      expect(runner.isRunning).toBe(false);
    });

    it("accepts custom heartbeat and action polling intervals within valid bounds", () => {
      const client = new ComputerAgentClient(validClientConfig);
      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5000,
        actionPollingIntervalMs: 1500,
        actionPollingEnabled: false,
      });

      expect(runner.heartbeatIntervalMs).toBe(5000);
      expect(runner.actionPollingIntervalMs).toBe(1500);
      expect(runner.actionPollingEnabled).toBe(false);
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

    it("fails closed on invalid action polling interval (< 100ms)", () => {
      const client = new ComputerAgentClient(validClientConfig);
      expect(
        () =>
          new ComputerAgentRunner({
            client,
            actionPollingIntervalMs: 50,
          }),
      ).toThrowError(/Action polling interval must be at least 100ms/);
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
        BRAINOS_AGENT_ACTION_POLL_INTERVAL_MS: "2000",
        BRAINOS_AGENT_ACTION_POLLING_ENABLED: "false",
      };

      const runner = ComputerAgentRunner.fromEnv(env);
      expect(runner.client.baseUrl).toBe("https://api.brainos.test");
      expect(runner.client.agentId).toBe("env-runner-agent");
      expect(runner.heartbeatIntervalMs).toBe(15_000);
      expect(runner.actionPollingIntervalMs).toBe(2_000);
      expect(runner.actionPollingEnabled).toBe(false);
    });
  });

  describe("DefaultHostActionExecutor", () => {
    it("routes the 5 allowed actions to underlying ComputerAgent", async () => {
      const mockAgent: ComputerAgent = {
        getInfo: vi.fn(),
        listApplications: vi.fn().mockResolvedValue([{ name: "Notepad", appId: "notepad.exe" }]),
        launchApplication: vi.fn().mockResolvedValue({ success: true, appId: "calc.exe" }),
        listFiles: vi.fn().mockResolvedValue([{ name: "test.txt", path: "C:\\test.txt", type: "file" }]),
        readFile: vi.fn().mockResolvedValue({ path: "C:\\test.txt", content: "hello" }),
        writeFile: vi.fn().mockResolvedValue({ path: "C:\\test.txt", success: true }),
      };

      const executor = new DefaultHostActionExecutor(mockAgent);

      // 1. listApplications
      const apps = await executor.executeAction("computer_list_applications");
      expect(apps).toEqual([{ name: "Notepad", appId: "notepad.exe" }]);
      expect(mockAgent.listApplications).toHaveBeenCalled();

      // 2. launchApplication
      const launch = await executor.executeAction("computer_launch_application", { appId: "calc.exe" });
      expect(launch).toEqual({ success: true, appId: "calc.exe" });
      expect(mockAgent.launchApplication).toHaveBeenCalledWith("calc.exe");

      // 3. listFiles
      const files = await executor.executeAction("computer_list_files", { path: "C:\\folder" });
      expect(files).toEqual([{ name: "test.txt", path: "C:\\test.txt", type: "file" }]);
      expect(mockAgent.listFiles).toHaveBeenCalledWith("C:\\folder");

      // 4. readFile
      const read = await executor.executeAction("computer_read_file", { path: "C:\\test.txt" });
      expect(read).toEqual({ path: "C:\\test.txt", content: "hello" });
      expect(mockAgent.readFile).toHaveBeenCalledWith("C:\\test.txt");

      // 5. writeFile
      const write = await executor.executeAction("computer_write_file", { path: "C:\\test.txt", content: "new-data" });
      expect(write).toEqual({ path: "C:\\test.txt", success: true });
      expect(mockAgent.writeFile).toHaveBeenCalledWith("C:\\test.txt", "new-data");
    });

    it("fails closed on unsupported action name", async () => {
      const executor = new DefaultHostActionExecutor();
      await expect(
        executor.executeAction("arbitrary_exec_shell", { cmd: "rm -rf /" }),
      ).rejects.toThrowError(/Unsupported computer action: "arbitrary_exec_shell"/);
    });

    it("validates parameters for launch, read, and write", async () => {
      const executor = new DefaultHostActionExecutor();

      await expect(
        executor.executeAction("computer_launch_application", {}),
      ).rejects.toThrowError(/appId must be a non-empty string/);

      await expect(
        executor.executeAction("computer_read_file", {}),
      ).rejects.toThrowError(/path must be a non-empty string/);

      await expect(
        executor.executeAction("computer_write_file", { path: "test.txt" }),
      ).rejects.toThrowError(/content must be a string/);
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
        actionPollingEnabled: false,
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

      await runner.stop();
    });

    it("supports skipImmediatePing option", async () => {
      const mockFetch = vi.fn();
      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({ client, actionPollingEnabled: false });
      await runner.start({ skipImmediatePing: true });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(runner.status).toBe("RUNNING");
      expect(runner.getState().consecutiveSuccesses).toBe(0);

      await runner.stop();
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

      const runner = new ComputerAgentRunner({ client, actionPollingEnabled: false });
      await runner.start();

      await expect(runner.start()).rejects.toMatchObject({
        code: "ALREADY_RUNNING",
        statusCode: 409,
      });

      await runner.stop();
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
        actionPollingEnabled: false,
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

  describe("Host Action Execution Loop", () => {
    it("Scenario 1: Poll -> claim -> execute -> report successful action_result", async () => {
      const requestsReceived: any[] = [];
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        requestsReceived.push(body);

        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }

        if (body.type === "action_poll") {
          return createMockResponse({
            id: "env-poll-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              hasAction: true,
              action: {
                id: "act_1001",
                correlationId: "corr_1001",
                actionName: "computer_list_applications",
                params: {},
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          });
        }

        if (body.type === "action_result") {
          return createMockResponse({
            id: "env-result-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              status: "received",
              actionId: body.payload.actionId,
              correlationId: body.payload.correlationId,
              completedAt: new Date().toISOString(),
            },
          });
        }

        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const mockExecutor: HostActionExecutor = {
        executeAction: vi.fn().mockResolvedValue([
          { name: "Terminal", appId: "wt.exe" },
        ]),
      };

      const onActionPollSuccess = vi.fn();
      const onActionExecutionComplete = vi.fn();

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 3_000,
        actionExecutor: mockExecutor,
        onActionPollSuccess,
        onActionExecutionComplete,
      });

      await runner.start();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Immediate ping

      // Advance by 3s to trigger first action poll
      await vi.advanceTimersByTimeAsync(3_000);

      expect(mockExecutor.executeAction).toHaveBeenCalledWith(
        "computer_list_applications",
        {},
      );

      // Verify action_poll and action_result requests were sent
      const pollReq = requestsReceived.find((r) => r.type === "action_poll");
      expect(pollReq).toBeDefined();

      const resultReq = requestsReceived.find((r) => r.type === "action_result");
      expect(resultReq).toBeDefined();
      expect(resultReq.payload).toEqual({
        actionId: "act_1001",
        correlationId: "corr_1001",
        success: true,
        result: [{ name: "Terminal", appId: "wt.exe" }],
      });

      // Verify event callbacks
      expect(onActionPollSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          hasAction: true,
          actionId: "act_1001",
          actionName: "computer_list_applications",
        }),
      );

      expect(onActionExecutionComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: "act_1001",
          correlationId: "corr_1001",
          actionName: "computer_list_applications",
          success: true,
          result: [{ name: "Terminal", appId: "wt.exe" }],
        }),
      );

      const state = runner.getState();
      expect(state.totalActionsExecuted).toBe(1);
      expect(state.totalActionsSucceeded).toBe(1);
      expect(state.totalActionsFailed).toBe(0);
      expect(state.isActionExecuting).toBe(false);

      await runner.stop();
    });

    it("Scenario 2: Poll -> executor failure -> report failed action_result with sanitized error", async () => {
      const requestsReceived: any[] = [];
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        requestsReceived.push(body);

        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }

        if (body.type === "action_poll") {
          return createMockResponse({
            id: "env-poll-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              hasAction: true,
              action: {
                id: "act_1002",
                correlationId: "corr_1002",
                actionName: "computer_launch_application",
                params: { appId: "invalid_app" },
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          });
        }

        if (body.type === "action_result") {
          return createMockResponse({
            id: "env-result-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              status: "received",
              actionId: body.payload.actionId,
              correlationId: body.payload.correlationId,
              completedAt: new Date().toISOString(),
            },
          });
        }

        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const mockExecutor: HostActionExecutor = {
        executeAction: vi.fn().mockRejectedValue(new Error("Application executable not found")),
      };

      const onActionExecutionComplete = vi.fn();

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 3_000,
        actionExecutor: mockExecutor,
        onActionExecutionComplete,
      });

      await runner.start();
      await vi.advanceTimersByTimeAsync(3_000);

      const resultReq = requestsReceived.find((r) => r.type === "action_result");
      expect(resultReq).toBeDefined();
      expect(resultReq.payload).toEqual({
        actionId: "act_1002",
        correlationId: "corr_1002",
        success: false,
        error: "Application executable not found",
      });

      expect(onActionExecutionComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: "act_1002",
          correlationId: "corr_1002",
          success: false,
          error: "Application executable not found",
        }),
      );

      const state = runner.getState();
      expect(state.totalActionsExecuted).toBe(1);
      expect(state.totalActionsSucceeded).toBe(0);
      expect(state.totalActionsFailed).toBe(1);

      await runner.stop();
    });

    it("Scenario 3: Empty queue schedules another poll without executing", async () => {
      let pollCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }

        if (body.type === "action_poll") {
          pollCount++;
          return createMockResponse({
            id: "env-poll-empty",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { hasAction: false },
          });
        }

        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const mockExecutor: HostActionExecutor = {
        executeAction: vi.fn(),
      };

      const onActionPollSuccess = vi.fn();

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 2_000,
        actionExecutor: mockExecutor,
        onActionPollSuccess,
      });

      await runner.start();

      // Advance 2s: 1st poll (empty)
      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(1);
      expect(mockExecutor.executeAction).not.toHaveBeenCalled();
      expect(onActionPollSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ hasAction: false }),
      );

      // Advance 2s: 2nd poll (empty)
      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(2);
      expect(mockExecutor.executeAction).not.toHaveBeenCalled();

      await runner.stop();
    });

    it("Scenario 4: Prevents overlapping action execution", async () => {
      let pollCount = 0;
      let resolveActionExec: (val: any) => void;
      const slowExecutionPromise = new Promise((resolve) => {
        resolveActionExec = resolve;
      });

      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }

        if (body.type === "action_poll") {
          pollCount++;
          return createMockResponse({
            id: `env-poll-${pollCount}`,
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              hasAction: true,
              action: {
                id: `act_${pollCount}`,
                correlationId: `corr_${pollCount}`,
                actionName: "computer_list_files",
                params: { path: "C:\\docs" },
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          });
        }

        if (body.type === "action_result") {
          return createMockResponse({
            id: "env-result-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "received", actionId: body.payload.actionId, correlationId: body.payload.correlationId, completedAt: new Date().toISOString() },
          });
        }

        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const mockExecutor: HostActionExecutor = {
        executeAction: vi.fn().mockImplementation(() => slowExecutionPromise),
      };

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 2_000,
        actionExecutor: mockExecutor,
      });

      await runner.start();

      // Trigger first poll
      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(1);
      expect(runner.getState().isActionExecuting).toBe(true);

      // Advance by another 2s: timer fires while 1st execution is still in flight
      await vi.advanceTimersByTimeAsync(2_000);
      // Polling was deferred, so no 2nd poll was made
      expect(pollCount).toBe(1);

      // Now complete the 1st execution
      resolveActionExec!({ files: [] });
      await vi.advanceTimersByTimeAsync(0);

      expect(runner.getState().isActionExecuting).toBe(false);

      // Advance another 2s: now 2nd poll can proceed
      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(2);

      await runner.stop();
    });

    it("Scenario 5: Stop prevents future polling and execution", async () => {
      let pollCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }
        if (body.type === "action_poll") {
          pollCount++;
          return createMockResponse({
            id: "env-poll",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { hasAction: false },
          });
        }
        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 2_000,
      });

      await runner.start();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(1);

      await runner.stop();
      expect(runner.status).toBe("STOPPED");

      // Advance 10s
      await vi.advanceTimersByTimeAsync(10_000);
      expect(pollCount).toBe(1); // No more polls
    });

    it("Scenario 6: AbortSignal prevents unsafe / stale result submissions", async () => {
      const controller = new AbortController();
      let pollCount = 0;
      let reportedResult = false;

      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }
        if (body.type === "action_poll") {
          pollCount++;
          return createMockResponse({
            id: "env-poll",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              hasAction: true,
              action: {
                id: "act_abort",
                correlationId: "corr_abort",
                actionName: "computer_list_files",
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          });
        }
        if (body.type === "action_result") {
          reportedResult = true;
          return createMockResponse({ id: "env-res", success: true, timestamp: Date.now() });
        }
        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const mockExecutor: HostActionExecutor = {
        executeAction: vi.fn().mockImplementation(async () => {
          // Abort signal during action execution
          controller.abort();
          return { done: true };
        }),
      };

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 2_000,
        actionExecutor: mockExecutor,
      });

      await runner.start({ signal: controller.signal });
      await vi.advanceTimersByTimeAsync(2_000);

      expect(runner.status).toBe("STOPPED");
      expect(reportedResult).toBe(false); // Result submission was aborted safely
    });

    it("Scenario 7: Unsupported action fails closed and reports sanitized failure", async () => {
      const requestsReceived: any[] = [];
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        requestsReceived.push(body);

        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }

        if (body.type === "action_poll") {
          return createMockResponse({
            id: "env-poll-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              hasAction: true,
              action: {
                id: "act_bad",
                correlationId: "corr_bad",
                actionName: "unauthorized_remote_shell",
                params: { cmd: "whoami" },
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          });
        }

        if (body.type === "action_result") {
          return createMockResponse({
            id: "env-result-resp",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "received", actionId: body.payload.actionId, correlationId: body.payload.correlationId, completedAt: new Date().toISOString() },
          });
        }

        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      // Use default executor with allowlist
      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 2_000,
      });

      await runner.start();
      await vi.advanceTimersByTimeAsync(2_000);

      const resultReq = requestsReceived.find((r) => r.type === "action_result");
      expect(resultReq).toBeDefined();
      expect(resultReq.payload.success).toBe(false);
      expect(resultReq.payload.error).toContain("Unsupported computer action");

      await runner.stop();
    });

    it("Scenario 8: Credentials never appear in action callbacks or runner state", async () => {
      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }
        if (body.type === "action_poll") {
          return createMockResponse({
            id: "env-poll",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: {
              hasAction: true,
              action: {
                id: "act_sec",
                correlationId: "corr_sec",
                actionName: "computer_list_applications",
                expiresAt: new Date(Date.now() + 60000).toISOString(),
              },
            },
          });
        }
        if (body.type === "action_result") {
          return createMockResponse({ id: "env-res", success: true, timestamp: Date.now() });
        }
        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });
      const onActionPollSuccess = vi.fn();
      const onActionExecutionComplete = vi.fn();

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 60_000,
        actionPollingIntervalMs: 2_000,
        actionExecutor: {
          executeAction: vi.fn().mockResolvedValue([]),
        },
        onActionPollSuccess,
        onActionExecutionComplete,
      });

      await runner.start();
      await vi.advanceTimersByTimeAsync(2_000);

      const pollSuccessEvent = onActionPollSuccess.mock.calls[0][0];
      expect(JSON.stringify(pollSuccessEvent)).not.toContain("ca_sec_test_secret_runner_token");

      const execCompleteEvent = onActionExecutionComplete.mock.calls[0][0];
      expect(JSON.stringify(execCompleteEvent)).not.toContain("ca_sec_test_secret_runner_token");

      expect(JSON.stringify(runner.getState())).not.toContain("ca_sec_test_secret_runner_token");
      expect(JSON.stringify(runner.toJSON())).not.toContain("ca_sec_test_secret_runner_token");

      await runner.stop();
    });

    it("Scenario 9: Existing heartbeat behavior still works concurrently with action polling", async () => {
      let pingCount = 0;
      let pollCount = 0;

      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          pingCount++;
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }
        if (body.type === "action_poll") {
          pollCount++;
          return createMockResponse({
            id: "env-poll",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { hasAction: false },
          });
        }
        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 10_000,
        actionPollingIntervalMs: 3_000,
      });

      await runner.start();
      expect(pingCount).toBe(1); // Immediate ping
      expect(pollCount).toBe(0);

      // Advance 3s -> 1st action poll
      await vi.advanceTimersByTimeAsync(3_000);
      expect(pingCount).toBe(1);
      expect(pollCount).toBe(1);

      // Advance 3s -> 2nd action poll
      await vi.advanceTimersByTimeAsync(3_000);
      expect(pingCount).toBe(1);
      expect(pollCount).toBe(2);

      // Advance 4s (total 10s) -> 2nd heartbeat ping + 3rd action poll (at 9s)
      await vi.advanceTimersByTimeAsync(4_000);
      expect(pingCount).toBe(2);
      expect(pollCount).toBe(3);

      await runner.stop();
    });

    it("Scenario 10: Runner restart works correctly and resumes loops", async () => {
      let pingCount = 0;
      let pollCount = 0;

      const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.type === "ping") {
          pingCount++;
          return createMockResponse({
            id: "env-ping",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { status: "acknowledged" },
          });
        }
        if (body.type === "action_poll") {
          pollCount++;
          return createMockResponse({
            id: "env-poll",
            version: "1.0",
            success: true,
            timestamp: Date.now(),
            data: { hasAction: false },
          });
        }
        return createMockResponse({ success: false }, 400);
      });

      const client = new ComputerAgentClient({
        ...validClientConfig,
        fetch: mockFetch,
      });

      const runner = new ComputerAgentRunner({
        client,
        heartbeatIntervalMs: 5_000,
        actionPollingIntervalMs: 2_000,
      });

      // 1. First run
      await runner.start();
      expect(runner.status).toBe("RUNNING");
      expect(pingCount).toBe(1);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(1);

      await runner.stop();
      expect(runner.status).toBe("STOPPED");

      // Advance time while stopped - no new calls
      await vi.advanceTimersByTimeAsync(10_000);
      expect(pingCount).toBe(1);
      expect(pollCount).toBe(1);

      // 2. Restart
      await runner.start();
      expect(runner.status).toBe("RUNNING");
      expect(pingCount).toBe(2); // Immediate ping on restart

      await vi.advanceTimersByTimeAsync(2_000);
      expect(pollCount).toBe(2); // Action polling resumed

      await runner.stop();
      expect(runner.status).toBe("STOPPED");
    });
  });
});
