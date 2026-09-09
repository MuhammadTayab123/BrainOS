import { describe, expect, it, vi } from "vitest";
import { ComputerAgentActionStatus, ComputerAgentStatus } from "@prisma/client";
import { AppError, NotFoundError } from "../../../../src/errors";
import {
  ComputerActionQueueService,
  DEFAULT_ACTION_TTL_MS,
  MAX_ACTION_TTL_MS,
  MIN_ACTION_TTL_MS,
} from "../../../../src/services/computer/queue/computer-action-queue.service";
import { ComputerAgentActionRecord } from "../../../../src/services/computer/queue/computer-action-queue.types";

describe("ComputerActionQueueService", () => {
  const fixedNow = new Date("2026-09-09T12:00:00.000Z");

  const validAgent = {
    id: "agent-1",
    userId: "user-1",
    name: "Workstation",
    status: ComputerAgentStatus.ACTIVE,
    lastAuthenticatedAt: new Date(),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleActionRecord: ComputerAgentActionRecord = {
    id: "action-123",
    agentId: "agent-1",
    userId: "user-1",
    correlationId: "corr-123",
    actionName: "computer_read_file",
    params: { path: "documents/report.pdf" },
    status: ComputerAgentActionStatus.PENDING,
    result: null,
    error: null,
    claimedAt: null,
    completedAt: null,
    expiresAt: new Date(fixedNow.getTime() + DEFAULT_ACTION_TTL_MS),
    createdAt: fixedNow,
    updatedAt: fixedNow,
  };

  const createMockDependencies = () => {
    const actionRepository = {
      enqueue: vi.fn(),
      getById: vi.fn(),
      getByIdForUser: vi.fn(),
      getByCorrelationId: vi.fn(),
      getByCorrelationIdForAgent: vi.fn(),
      claimNextForAgent: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      cancel: vi.fn(),
      markExpired: vi.fn(),
      listByAgent: vi.fn(),
      listByUser: vi.fn(),
    };

    const agentRepository = {
      findById: vi.fn(),
      findByIdForUser: vi.fn(),
    };

    const service = new ComputerActionQueueService({
      actionRepository: actionRepository as any,
      agentRepository: agentRepository as any,
      clock: () => fixedNow,
    });

    return { service, actionRepository, agentRepository };
  };

  describe("enqueueAction", () => {
    it("successfully enqueues a valid action for an active agent", async () => {
      const { service, agentRepository, actionRepository } =
        createMockDependencies();

      agentRepository.findByIdForUser.mockResolvedValue(validAgent);
      actionRepository.enqueue.mockResolvedValue(sampleActionRecord);

      const result = await service.enqueueAction({
        userId: "user-1",
        agentId: "agent-1",
        actionName: "computer_read_file",
        params: { path: "documents/report.pdf" },
      });

      expect(agentRepository.findByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-1",
      );

      expect(actionRepository.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          agentId: "agent-1",
          actionName: "computer_read_file",
          params: { path: "documents/report.pdf" },
          correlationId: expect.any(String),
          expiresAt: new Date(fixedNow.getTime() + DEFAULT_ACTION_TTL_MS),
        }),
      );

      expect(result.id).toBe("action-123");
    });

    it("rejects enqueue if userId or agentId is missing or empty", async () => {
      const { service } = createMockDependencies();

      await expect(
        service.enqueueAction({
          userId: "",
          agentId: "agent-1",
          actionName: "computer_read_file",
        }),
      ).rejects.toThrow("User ID is required.");

      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "",
          actionName: "computer_read_file",
        }),
      ).rejects.toThrow("Agent ID is required.");
    });

    it("rejects enqueue if actionName is missing or empty", async () => {
      const { service } = createMockDependencies();

      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "agent-1",
          actionName: "   ",
        }),
      ).rejects.toThrow("Action name is required.");
    });

    it("rejects enqueue if agent does not exist for the user (tenant isolation)", async () => {
      const { service, agentRepository } = createMockDependencies();

      agentRepository.findByIdForUser.mockResolvedValue(null);

      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "agent-unknown",
          actionName: "computer_read_file",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects enqueue if agent is inactive or revoked", async () => {
      const { service, agentRepository } = createMockDependencies();

      agentRepository.findByIdForUser.mockResolvedValue({
        ...validAgent,
        status: ComputerAgentStatus.REVOKED,
      });

      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "agent-1",
          actionName: "computer_read_file",
        }),
      ).rejects.toMatchObject({
        code: "AGENT_INACTIVE",
        statusCode: 409,
      });
    });

    it("supports custom expiresInMs within bounds and rejects invalid TTL", async () => {
      const { service, agentRepository, actionRepository } =
        createMockDependencies();

      agentRepository.findByIdForUser.mockResolvedValue(validAgent);
      actionRepository.enqueue.mockResolvedValue(sampleActionRecord);

      // Valid custom TTL
      await service.enqueueAction({
        userId: "user-1",
        agentId: "agent-1",
        actionName: "computer_read_file",
        expiresInMs: 15_000,
      });

      expect(actionRepository.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(fixedNow.getTime() + 15_000),
        }),
      );

      // Below MIN
      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "agent-1",
          actionName: "computer_read_file",
          expiresInMs: MIN_ACTION_TTL_MS - 1,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_TTL",
        statusCode: 400,
      });

      // Above MAX
      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "agent-1",
          actionName: "computer_read_file",
          expiresInMs: MAX_ACTION_TTL_MS + 1,
        }),
      ).rejects.toMatchObject({
        code: "INVALID_TTL",
        statusCode: 400,
      });
    });

    it("rejects past expiresAt timestamp", async () => {
      const { service, agentRepository } = createMockDependencies();

      agentRepository.findByIdForUser.mockResolvedValue(validAgent);

      await expect(
        service.enqueueAction({
          userId: "user-1",
          agentId: "agent-1",
          actionName: "computer_read_file",
          expiresAt: new Date(fixedNow.getTime() - 1000),
        }),
      ).rejects.toMatchObject({
        code: "INVALID_EXPIRATION",
        statusCode: 400,
      });
    });
  });

  describe("claimNextAction", () => {
    it("expires stale actions and claims next action for the agent atomically", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.markExpired.mockResolvedValue(2);
      actionRepository.claimNextForAgent.mockResolvedValue({
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.CLAIMED,
        claimedAt: fixedNow,
      });

      const claimed = await service.claimNextAction("agent-1");

      expect(actionRepository.markExpired).toHaveBeenCalledWith(fixedNow);
      expect(actionRepository.claimNextForAgent).toHaveBeenCalledWith(
        "agent-1",
        fixedNow,
      );
      expect(claimed?.status).toBe("CLAIMED");
      expect(claimed?.claimedAt).toBe(fixedNow);
    });

    it("returns null if no action is pending for the agent", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.markExpired.mockResolvedValue(0);
      actionRepository.claimNextForAgent.mockResolvedValue(null);

      const claimed = await service.claimNextAction("agent-1");
      expect(claimed).toBeNull();
    });
  });

  describe("completeAction", () => {
    it("successfully completes a claimed action", async () => {
      const { service, actionRepository } = createMockDependencies();

      const claimedRecord = {
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.CLAIMED,
        claimedAt: fixedNow,
      };

      actionRepository.getById.mockResolvedValue(claimedRecord);
      actionRepository.complete.mockResolvedValue(true);

      const result = await service.completeAction({
        actionId: "action-123",
        agentId: "agent-1",
        result: { text: "Contents of file" },
      });

      expect(actionRepository.complete).toHaveBeenCalledWith({
        actionId: "action-123",
        agentId: "agent-1",
        result: { text: "Contents of file" },
        completedAt: fixedNow,
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.result).toEqual({ text: "Contents of file" });
    });

    it("resolves action by correlationId if actionId is omitted", async () => {
      const { service, actionRepository } = createMockDependencies();

      const claimedRecord = {
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.CLAIMED,
      };

      actionRepository.getByCorrelationId.mockResolvedValue(claimedRecord);
      actionRepository.complete.mockResolvedValue(true);

      const result = await service.completeAction({
        correlationId: "corr-123",
        agentId: "agent-1",
        result: { status: "ok" },
      });

      expect(actionRepository.getByCorrelationId).toHaveBeenCalledWith("corr-123");
      expect(result.status).toBe("COMPLETED");
    });

    it("enforces strict agent isolation (agent A cannot complete agent B's action)", async () => {
      const { service, actionRepository } = createMockDependencies();

      const claimedRecord = {
        ...sampleActionRecord,
        agentId: "agent-1", // Owned by agent-1
        status: ComputerAgentActionStatus.CLAIMED,
      };

      actionRepository.getById.mockResolvedValue(claimedRecord);

      await expect(
        service.completeAction({
          actionId: "action-123",
          agentId: "agent-2-attacker",
          result: { malicious: true },
        }),
      ).rejects.toMatchObject({
        code: "AGENT_MISMATCH",
        statusCode: 403,
      });

      expect(actionRepository.complete).not.toHaveBeenCalled();
    });

    it("returns idempotently if action is already COMPLETED", async () => {
      const { service, actionRepository } = createMockDependencies();

      const completedRecord = {
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.COMPLETED,
        result: { text: "Contents" },
        completedAt: fixedNow,
      };

      actionRepository.getById.mockResolvedValue(completedRecord);

      const result = await service.completeAction({
        actionId: "action-123",
        agentId: "agent-1",
        result: { text: "Contents" },
      });

      expect(actionRepository.complete).not.toHaveBeenCalled();
      expect(result.status).toBe("COMPLETED");
    });

    it("rejects completion if action is not in CLAIMED status (e.g. PENDING, FAILED, TIMED_OUT)", async () => {
      const { service, actionRepository } = createMockDependencies();

      const pendingRecord = {
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.PENDING,
      };

      actionRepository.getById.mockResolvedValue(pendingRecord);

      await expect(
        service.completeAction({
          actionId: "action-123",
          agentId: "agent-1",
          result: { text: "Contents" },
        }),
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 409,
      });
    });
  });

  describe("failAction", () => {
    it("successfully marks a pending or claimed action as FAILED", async () => {
      const { service, actionRepository } = createMockDependencies();

      const claimedRecord = {
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.CLAIMED,
      };

      actionRepository.getById.mockResolvedValue(claimedRecord);
      actionRepository.fail.mockResolvedValue(true);

      const result = await service.failAction({
        actionId: "action-123",
        agentId: "agent-1",
        error: "Permission denied on local host filesystem.",
      });

      expect(actionRepository.fail).toHaveBeenCalledWith({
        actionId: "action-123",
        agentId: "agent-1",
        error: "Permission denied on local host filesystem.",
        completedAt: fixedNow,
      });

      expect(result.status).toBe("FAILED");
      expect(result.error).toBe("Permission denied on local host filesystem.");
    });

    it("rejects failing an already COMPLETED action", async () => {
      const { service, actionRepository } = createMockDependencies();

      const completedRecord = {
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.COMPLETED,
      };

      actionRepository.getById.mockResolvedValue(completedRecord);

      await expect(
        service.failAction({
          actionId: "action-123",
          agentId: "agent-1",
          error: "Late failure",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        statusCode: 409,
      });
    });
  });

  describe("cancelAction", () => {
    it("successfully cancels a pending or claimed action for an authorized user", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.getByIdForUser.mockResolvedValue(sampleActionRecord);
      actionRepository.cancel.mockResolvedValue(true);

      const result = await service.cancelAction({
        actionId: "action-123",
        userId: "user-1",
        reason: "User aborted turn",
      });

      expect(actionRepository.cancel).toHaveBeenCalledWith({
        actionId: "action-123",
        userId: "user-1",
        reason: "User aborted turn",
        cancelledAt: fixedNow,
      });

      expect(result.status).toBe("CANCELLED");
      expect(result.error).toBe("User aborted turn");
    });

    it("rejects cancellation if action belongs to a different user (tenant isolation)", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.getByIdForUser.mockResolvedValue(null);

      await expect(
        service.cancelAction({
          actionId: "action-123",
          userId: "user-2-intruder",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects cancellation if action is already COMPLETED or FAILED", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.getByIdForUser.mockResolvedValue({
        ...sampleActionRecord,
        status: ComputerAgentActionStatus.COMPLETED,
      });

      await expect(
        service.cancelAction({
          actionId: "action-123",
          userId: "user-1",
        }),
      ).rejects.toMatchObject({
        code: "CANNOT_CANCEL_FINISHED_ACTION",
        statusCode: 409,
      });
    });
  });

  describe("expireStaleActions", () => {
    it("delegates to repository with current clock time", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.markExpired.mockResolvedValue(5);

      const count = await service.expireStaleActions();
      expect(actionRepository.markExpired).toHaveBeenCalledWith(fixedNow);
      expect(count).toBe(5);
    });
  });

  describe("getAction & listActions", () => {
    it("retrieves action with tenant isolation", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.getByIdForUser.mockResolvedValue(sampleActionRecord);

      const action = await service.getAction("action-123", "user-1");
      expect(action.id).toBe("action-123");
    });

    it("throws NotFoundError when retrieving action with wrong user", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.getByIdForUser.mockResolvedValue(null);

      await expect(
        service.getAction("action-123", "user-wrong"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("lists actions for user with tenant isolation", async () => {
      const { service, actionRepository } = createMockDependencies();

      actionRepository.listByUser.mockResolvedValue([sampleActionRecord]);

      const actions = await service.listActions({
        userId: "user-1",
        status: ComputerAgentActionStatus.PENDING,
      });

      expect(actionRepository.listByUser).toHaveBeenCalledWith({
        userId: "user-1",
        status: ComputerAgentActionStatus.PENDING,
      });
      expect(actions).toHaveLength(1);
    });
  });
});
