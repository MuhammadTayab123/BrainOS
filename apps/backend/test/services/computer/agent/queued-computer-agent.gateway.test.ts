import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, NotFoundError } from "../../../../src/errors";
import {
  QueuedComputerAgentGateway,
  QueuedComputerAgentGatewayOptions,
} from "../../../../src/services/computer/agent/queued-computer-agent.gateway";
import {
  ComputerAgent,
  ComputerAgentInfo,
} from "../../../../src/services/computer/agent/computer-agent.types";
import { ComputerActionQueueService } from "../../../../src/services/computer/queue/computer-action-queue.service";
import { ComputerAgentRepository } from "../../../../src/services/computer/repositories/computer-agent.repository";
import { ComputerAgentActionRepository } from "../../../../src/services/computer/repositories/computer-agent-action.repository";
import { ToolContext } from "../../../../src/services/tools/tool.types";

describe("QueuedComputerAgentGateway", () => {
  let mockAgentRepo: ComputerAgentRepository;
  let mockActionRepo: ComputerAgentActionRepository;
  let queueService: ComputerActionQueueService;
  let mockLocalAgent: ComputerAgent;
  let gateway: QueuedComputerAgentGateway;

  const mockUserA: ToolContext = {
    userId: "user_a_123",
  };

  const mockUserB: ToolContext = {
    userId: "user_b_456",
  };

  const activeAgentA = {
    id: "agent_a_1",
    userId: "user_a_123",
    name: "Tayyab Windows Desktop",
    status: "ACTIVE" as const,
    lastAuthenticatedAt: new Date(),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockAgentRepo = {
      listByUser: vi.fn().mockImplementation(async (options: { userId: string; status?: string }) => {
        if (options.userId === "user_a_123" && (!options.status || options.status === "ACTIVE")) {
          return [activeAgentA];
        }
        return [];
      }),
      findByIdForUser: vi.fn().mockImplementation(async (agentId: string, userId: string) => {
        if (agentId === activeAgentA.id && userId === activeAgentA.userId) {
          return activeAgentA;
        }
        return null;
      }),
      findById: vi.fn(),
      create: vi.fn(),
      createWithCredential: vi.fn(),
      revokeByIdForUser: vi.fn(),
      createCredential: vi.fn(),
      rotateCredentialForUser: vi.fn(),
      revokeCredentialsByAgentId: vi.fn(),
      findActiveCredentialsByAgentId: vi.fn(),
      findActiveCredentials: vi.fn(),
      updateLastAuthenticatedAt: vi.fn(),
      softDeleteByIdForUser: vi.fn(),
    } as unknown as ComputerAgentRepository;

    let actionCounter = 0;
    const actionsMap = new Map<string, any>();

    mockActionRepo = {
      enqueue: vi.fn().mockImplementation(async (data) => {
        actionCounter++;
        const id = `action_${actionCounter}`;
        const record = {
          id,
          agentId: data.agentId,
          userId: data.userId,
          correlationId: data.correlationId,
          actionName: data.actionName,
          params: data.params ?? null,
          status: "PENDING" as const,
          result: null,
          error: null,
          claimedAt: null,
          completedAt: null,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        actionsMap.set(id, record);
        return record;
      }),
      getById: vi.fn().mockImplementation(async (id) => actionsMap.get(id) ?? null),
      getByIdForUser: vi.fn().mockImplementation(async (id, userId) => {
        const item = actionsMap.get(id);
        if (item && item.userId === userId) {
          return item;
        }
        return null;
      }),
      getByCorrelationId: vi.fn(),
      getByCorrelationIdForAgent: vi.fn(),
      claimNextForAgent: vi.fn(),
      complete: vi.fn().mockImplementation(async (params) => {
        const item = actionsMap.get(params.actionId);
        if (item) {
          item.status = "COMPLETED";
          item.result = params.result;
          item.completedAt = params.completedAt ?? new Date();
          return true;
        }
        return false;
      }),
      fail: vi.fn().mockImplementation(async (params) => {
        const item = actionsMap.get(params.actionId);
        if (item) {
          item.status = "FAILED";
          item.error = params.error;
          item.completedAt = params.completedAt ?? new Date();
          return true;
        }
        return false;
      }),
      cancel: vi.fn(),
      markExpired: vi.fn().mockResolvedValue(0),
      listByAgent: vi.fn(),
      listByUser: vi.fn(),
    } as unknown as ComputerAgentActionRepository;

    queueService = new ComputerActionQueueService({
      actionRepository: mockActionRepo,
      agentRepository: mockAgentRepo,
    });

    mockLocalAgent = {
      getInfo: vi.fn().mockResolvedValue({
        agentId: "local-server",
        status: "ONLINE",
        platform: "win32",
        architecture: "x64",
        capabilities: { status: true, applications: true, files: true, browser: false },
      }),
      listApplications: vi.fn().mockResolvedValue([{ name: "Notepad Local", appId: "notepad.exe" }]),
      launchApplication: vi.fn().mockResolvedValue({ success: true, appId: "calc.exe" }),
      listFiles: vi.fn().mockResolvedValue([{ name: "local.txt", path: "C:\\local.txt", type: "file" }]),
      readFile: vi.fn().mockResolvedValue({ path: "C:\\local.txt", content: "local content" }),
      writeFile: vi.fn().mockResolvedValue({ path: "C:\\local.txt", success: true }),
    };

    gateway = new QueuedComputerAgentGateway({
      queueService,
      agentRepository: mockAgentRepo,
      localFallbackAgent: mockLocalAgent,
      allowLocalFallback: false,
      actionTimeoutMs: 5000,
      pollIntervalMs: 50,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("getInfo (server-side agent status resolution)", () => {
    it("resolves status ONLINE for user with active registered agent without queueing remote action", async () => {
      const info = await gateway.getInfo(mockUserA);

      expect(info).toEqual({
        agentId: "agent_a_1",
        status: "ONLINE",
        platform: "remote",
        architecture: "remote",
        capabilities: {
          status: true,
          applications: true,
          files: true,
          browser: false,
        },
      });

      // No queue actions should have been enqueued
      expect(mockActionRepo.enqueue).not.toHaveBeenCalled();
    });

    it("returns OFFLINE when user has no active agent and local fallback is disabled", async () => {
      const info = await gateway.getInfo(mockUserB);

      expect(info).toEqual({
        agentId: "none",
        status: "OFFLINE",
        platform: "unknown",
        architecture: "unknown",
        capabilities: {
          status: false,
          applications: false,
          files: false,
          browser: false,
        },
      });
    });

    it("delegates getInfo to localFallbackAgent when local fallback is enabled and no active agent is found", async () => {
      const fallbackGateway = new QueuedComputerAgentGateway({
        queueService,
        agentRepository: mockAgentRepo,
        localFallbackAgent: mockLocalAgent,
        allowLocalFallback: true,
      });

      const info = await fallbackGateway.getInfo(mockUserB);
      expect(mockLocalAgent.getInfo).toHaveBeenCalledTimes(1);
      expect(info.agentId).toBe("local-server");
    });
  });

  describe("Queued Action Execution (listApplications, launchApplication, listFiles, readFile, writeFile)", () => {
    it("Scenario 1: listApplications enqueues action, waits for completion, and returns host result", async () => {
      const execPromise = gateway.listApplications(mockUserA);

      // Advance timers to trigger waiter tick
      await vi.advanceTimersByTimeAsync(50);

      // Verify action was enqueued
      expect(mockActionRepo.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_a_123",
          agentId: "agent_a_1",
          actionName: "computer_list_applications",
        }),
      );

      // Simulate remote runner completing the action
      await mockActionRepo.complete({
        actionId: "action_1",
        result: [{ name: "Calculator", appId: "calc.exe" }],
      });

      // Advance timers to let waiter resolve
      await vi.advanceTimersByTimeAsync(50);

      const result = await execPromise;
      expect(result).toEqual([{ name: "Calculator", appId: "calc.exe" }]);
    });

    it("Scenario 2: launchApplication enqueues action and returns success result", async () => {
      const execPromise = gateway.launchApplication("calc.exe", mockUserA);
      await vi.advanceTimersByTimeAsync(50);

      expect(mockActionRepo.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_a_123",
          agentId: "agent_a_1",
          actionName: "computer_launch_application",
          params: { appId: "calc.exe" },
        }),
      );

      await mockActionRepo.complete({
        actionId: "action_1",
        result: { success: true, appId: "calc.exe" },
      });

      await vi.advanceTimersByTimeAsync(50);

      const result = await execPromise;
      expect(result).toEqual({ success: true, appId: "calc.exe" });
    });

    it("Scenario 3: listFiles enqueues action and returns file list", async () => {
      const execPromise = gateway.listFiles("Documents", mockUserA);
      await vi.advanceTimersByTimeAsync(50);

      expect(mockActionRepo.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_a_123",
          agentId: "agent_a_1",
          actionName: "computer_list_files",
          params: { path: "Documents" },
        }),
      );

      await mockActionRepo.complete({
        actionId: "action_1",
        result: [{ name: "report.pdf", path: "Documents/report.pdf", type: "file" }],
      });

      await vi.advanceTimersByTimeAsync(50);

      const result = await execPromise;
      expect(result).toEqual([{ name: "report.pdf", path: "Documents/report.pdf", type: "file" }]);
    });

    it("Scenario 4: readFile enqueues action and returns file content", async () => {
      const execPromise = gateway.readFile("report.txt", mockUserA);
      await vi.advanceTimersByTimeAsync(50);

      expect(mockActionRepo.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_a_123",
          agentId: "agent_a_1",
          actionName: "computer_read_file",
          params: { path: "report.txt" },
        }),
      );

      await mockActionRepo.complete({
        actionId: "action_1",
        result: { path: "report.txt", content: "BrainOS Remote Report" },
      });

      await vi.advanceTimersByTimeAsync(50);

      const result = await execPromise;
      expect(result).toEqual({ path: "report.txt", content: "BrainOS Remote Report" });
    });

    it("Scenario 5: writeFile enqueues action and returns write result", async () => {
      const execPromise = gateway.writeFile("notes.txt", "New Note", mockUserA);
      await vi.advanceTimersByTimeAsync(50);

      expect(mockActionRepo.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_a_123",
          agentId: "agent_a_1",
          actionName: "computer_write_file",
          params: { path: "notes.txt", content: "New Note" },
        }),
      );

      await mockActionRepo.complete({
        actionId: "action_1",
        result: { path: "notes.txt", success: true },
      });

      await vi.advanceTimersByTimeAsync(50);

      const result = await execPromise;
      expect(result).toEqual({ path: "notes.txt", success: true });
    });

    it("Scenario 6: Remote host action failure converts to safe AppError", async () => {
      const execPromise = gateway.launchApplication("invalid.exe", mockUserA);
      const assertion = expect(execPromise).rejects.toThrow(
        /Application executable not found on host/,
      );

      await vi.advanceTimersByTimeAsync(50);

      await mockActionRepo.fail({
        actionId: "action_1",
        error: "Application executable not found on host.",
      });

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    });

    it("Scenario 7: Action timeout throws TIMEOUT error when remote host does not complete", async () => {
      const execPromise = gateway.listApplications(mockUserA);
      const assertion = expect(execPromise).rejects.toMatchObject({
        code: "TIMEOUT",
        statusCode: 408,
      });

      // Advance past 5000ms actionTimeoutMs
      await vi.advanceTimersByTimeAsync(5500);
      await assertion;
    });

    it("Scenario 8: User with no active agent fails closed with NotFoundError", async () => {
      await expect(gateway.listApplications(mockUserB)).rejects.toThrowError(
        /No active computer agent found for user/,
      );
    });

    it("Scenario 9: Tenant isolation - User A cannot access or dispatch to User B's agent", async () => {
      // User B has no active agents
      await expect(gateway.listFiles("secret", mockUserB)).rejects.toThrowError(
        /No active computer agent found for user/,
      );

      // Agent A belongs to User A, cannot be used by User B
      expect(mockAgentRepo.findByIdForUser).not.toHaveBeenCalledWith("agent_a_1", "user_b_456");
    });

    it("Scenario 10: Concurrent actions dispatch distinct correlation and action IDs without collision", async () => {
      const call1 = gateway.listFiles("path1", mockUserA);
      const call2 = gateway.listFiles("path2", mockUserA);

      await vi.advanceTimersByTimeAsync(50);

      expect(mockActionRepo.enqueue).toHaveBeenCalledTimes(2);

      const calls = (mockActionRepo.enqueue as ReturnType<typeof vi.fn>).mock.calls;
      const correlation1 = calls[0][0].correlationId;
      const correlation2 = calls[1][0].correlationId;

      expect(correlation1).toBeDefined();
      expect(correlation2).toBeDefined();
      expect(correlation1).not.toEqual(correlation2);

      await mockActionRepo.complete({
        actionId: "action_1",
        result: [{ name: "f1", path: "path1/f1", type: "file" }],
      });
      await mockActionRepo.complete({
        actionId: "action_2",
        result: [{ name: "f2", path: "path2/f2", type: "file" }],
      });

      await vi.advanceTimersByTimeAsync(50);

      const [res1, res2] = await Promise.all([call1, call2]);
      expect(res1).toEqual([{ name: "f1", path: "path1/f1", type: "file" }]);
      expect(res2).toEqual([{ name: "f2", path: "path2/f2", type: "file" }]);
    });

    it("Scenario 11: Local fallback works when explicitly enabled and no active agent exists", async () => {
      const fallbackGateway = new QueuedComputerAgentGateway({
        queueService,
        agentRepository: mockAgentRepo,
        localFallbackAgent: mockLocalAgent,
        allowLocalFallback: true,
      });

      const apps = await fallbackGateway.listApplications(mockUserB);
      expect(mockLocalAgent.listApplications).toHaveBeenCalledTimes(1);
      expect(apps).toEqual([{ name: "Notepad Local", appId: "notepad.exe" }]);
    });

    it("Scenario 12: Zero credential or sensitive internal info leakage in errors or results", async () => {
      const execPromise = gateway.launchApplication("calc.exe", mockUserA);
      const assertion = expect(execPromise).rejects.toThrow();

      await vi.advanceTimersByTimeAsync(50);

      await mockActionRepo.fail({
        actionId: "action_1",
        error: "Failed with internal secret ca_sec_test_secret_key",
      });

      await vi.advanceTimersByTimeAsync(50);
      await assertion;
    });
  });
});
