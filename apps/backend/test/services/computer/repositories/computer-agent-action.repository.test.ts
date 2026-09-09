import { describe, expect, it, vi } from "vitest";
import { ComputerAgentActionStatus } from "@prisma/client";
import { ComputerAgentActionRepository } from "../../../../src/services/computer/repositories/computer-agent-action.repository";

describe("ComputerAgentActionRepository", () => {
  const baseRecord = {
    id: "action-1",
    agentId: "agent-1",
    userId: "user-1",
    correlationId: "corr-123",
    actionName: "computer_read_file",
    params: { path: "notes.txt" },
    status: ComputerAgentActionStatus.PENDING,
    result: null,
    error: null,
    claimedAt: null,
    completedAt: null,
    expiresAt: new Date(Date.now() + 30_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("enqueues a new computer action record in the persistent queue", async () => {
    const create = vi.fn().mockResolvedValue(baseRecord);
    const db = { computerAgentAction: { create } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const expiresAt = new Date(Date.now() + 30_000);
    const result = await repository.enqueue({
      agentId: "agent-1",
      userId: "user-1",
      actionName: "computer_read_file",
      params: { path: "notes.txt" },
      correlationId: "corr-123",
      expiresAt,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        userId: "user-1",
        correlationId: "corr-123",
        actionName: "computer_read_file",
        params: { path: "notes.txt" },
        status: "PENDING",
        expiresAt,
      },
      select: expect.objectContaining({
        id: true,
        agentId: true,
        userId: true,
        correlationId: true,
        actionName: true,
        status: true,
      }),
    });

    expect(result.id).toBe("action-1");
    expect(result.status).toBe("PENDING");
  });

  it("retrieves an action record by ID", async () => {
    const findUnique = vi.fn().mockResolvedValue(baseRecord);
    const db = { computerAgentAction: { findUnique } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const result = await repository.getById("action-1");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "action-1" },
      select: expect.any(Object),
    });
    expect(result?.id).toBe("action-1");
  });

  it("retrieves an action record by ID enforcing user tenant isolation", async () => {
    const findFirst = vi.fn().mockResolvedValue(baseRecord);
    const db = { computerAgentAction: { findFirst } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const result = await repository.getByIdForUser("action-1", "user-1");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "action-1", userId: "user-1" },
      select: expect.any(Object),
    });
    expect(result?.userId).toBe("user-1");
  });

  it("retrieves an action record by correlation ID", async () => {
    const findUnique = vi.fn().mockResolvedValue(baseRecord);
    const db = { computerAgentAction: { findUnique } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const result = await repository.getByCorrelationId("corr-123");
    expect(findUnique).toHaveBeenCalledWith({
      where: { correlationId: "corr-123" },
      select: expect.any(Object),
    });
    expect(result?.correlationId).toBe("corr-123");
  });

  it("retrieves an action record by correlation ID enforcing agent isolation", async () => {
    const findFirst = vi.fn().mockResolvedValue(baseRecord);
    const db = { computerAgentAction: { findFirst } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const result = await repository.getByCorrelationIdForAgent("corr-123", "agent-1");
    expect(findFirst).toHaveBeenCalledWith({
      where: { correlationId: "corr-123", agentId: "agent-1" },
      select: expect.any(Object),
    });
    expect(result?.agentId).toBe("agent-1");
  });

  it("atomically claims the next pending unexpired action for an agent", async () => {
    const now = new Date();
    const candidate = { ...baseRecord, id: "action-1" };

    const findMany = vi.fn().mockResolvedValue([candidate]);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });

    const db = {
      computerAgentAction: {
        findMany,
        updateMany,
      },
    } as any;

    const repository = new ComputerAgentActionRepository(db);

    const claimed = await repository.claimNextForAgent("agent-1", now);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        status: "PENDING",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: expect.any(Object),
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "action-1",
        agentId: "agent-1",
        status: "PENDING",
        expiresAt: { gt: now },
      },
      data: {
        status: "CLAIMED",
        claimedAt: now,
      },
    });

    expect(claimed?.id).toBe("action-1");
    expect(claimed?.status).toBe("CLAIMED");
    expect(claimed?.claimedAt).toBe(now);
  });

  it("handles concurrent claim collision gracefully and advances to next candidate", async () => {
    const now = new Date();
    const candidate1 = { ...baseRecord, id: "action-1" };
    const candidate2 = { ...baseRecord, id: "action-2" };

    const findMany = vi.fn().mockResolvedValue([candidate1, candidate2]);
    // First candidate was claimed concurrently (count: 0), second candidate succeeds (count: 1)
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const db = {
      computerAgentAction: {
        findMany,
        updateMany,
      },
    } as any;

    const repository = new ComputerAgentActionRepository(db);

    const claimed = await repository.claimNextForAgent("agent-1", now);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(claimed?.id).toBe("action-2");
    expect(claimed?.status).toBe("CLAIMED");
  });

  it("returns null when no pending unexpired action is available for the agent", async () => {
    const now = new Date();
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { computerAgentAction: { findMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const claimed = await repository.claimNextForAgent("agent-1", now);
    expect(claimed).toBeNull();
  });

  it("completes a claimed action with result payload", async () => {
    const completedAt = new Date();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { computerAgentAction: { updateMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const success = await repository.complete({
      actionId: "action-1",
      agentId: "agent-1",
      result: { content: "File content" },
      completedAt,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "action-1",
        agentId: "agent-1",
        status: "CLAIMED",
      },
      data: {
        status: "COMPLETED",
        result: { content: "File content" },
        completedAt,
        error: null,
      },
    });

    expect(success).toBe(true);
  });

  it("fails an action with an error message", async () => {
    const completedAt = new Date();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { computerAgentAction: { updateMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const success = await repository.fail({
      actionId: "action-1",
      agentId: "agent-1",
      error: "File not found.",
      completedAt,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "action-1",
        agentId: "agent-1",
        status: { in: ["PENDING", "CLAIMED"] },
      },
      data: {
        status: "FAILED",
        error: "File not found.",
        completedAt,
      },
    });

    expect(success).toBe(true);
  });

  it("cancels an action with user authorization", async () => {
    const cancelledAt = new Date();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { computerAgentAction: { updateMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const success = await repository.cancel({
      actionId: "action-1",
      userId: "user-1",
      reason: "User cancelled request.",
      cancelledAt,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "action-1",
        userId: "user-1",
        status: { in: ["PENDING", "CLAIMED"] },
      },
      data: {
        status: "CANCELLED",
        error: "User cancelled request.",
        completedAt: cancelledAt,
      },
    });

    expect(success).toBe(true);
  });

  it("marks expired actions as TIMED_OUT", async () => {
    const now = new Date();
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const db = { computerAgentAction: { updateMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const count = await repository.markExpired(now);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["PENDING", "CLAIMED"] },
        expiresAt: { lte: now },
      },
      data: {
        status: "TIMED_OUT",
        error: "Action timed out before completion.",
        completedAt: now,
      },
    });

    expect(count).toBe(3);
  });

  it("lists action records by agent", async () => {
    const findMany = vi.fn().mockResolvedValue([baseRecord]);
    const db = { computerAgentAction: { findMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const result = await repository.listByAgent({
      agentId: "agent-1",
      status: "PENDING",
      limit: 10,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: expect.any(Object),
    });

    expect(result).toHaveLength(1);
  });

  it("lists action records by user", async () => {
    const findMany = vi.fn().mockResolvedValue([baseRecord]);
    const db = { computerAgentAction: { findMany } } as any;
    const repository = new ComputerAgentActionRepository(db);

    const result = await repository.listByUser({
      userId: "user-1",
      agentId: "agent-1",
      status: "COMPLETED",
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        agentId: "agent-1",
        status: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: expect.any(Object),
    });

    expect(result).toHaveLength(1);
  });
});
