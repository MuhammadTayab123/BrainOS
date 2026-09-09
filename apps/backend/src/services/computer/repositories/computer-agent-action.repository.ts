import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import {
  ComputerAgentActionRecord,
  ComputerAgentActionStatus,
  EnqueueComputerActionInput,
  ListComputerActionsOptions,
} from "../queue/computer-action-queue.types";

const computerAgentActionSelect = {
  id: true,
  agentId: true,
  userId: true,
  correlationId: true,
  actionName: true,
  params: true,
  status: true,
  result: true,
  error: true,
  claimedAt: true,
  completedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ComputerAgentActionRepository {
  constructor(private readonly db: DatabaseClient = prisma) {}

  /**
   * Enqueues a new computer action record in the persistent queue.
   */
  async enqueue(
    data: EnqueueComputerActionInput & {
      correlationId: string;
      expiresAt: Date;
    },
  ): Promise<ComputerAgentActionRecord> {
    const paramsValue =
      data.params !== undefined && data.params !== null
        ? (data.params as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    return this.db.computerAgentAction.create({
      data: {
        agentId: data.agentId,
        userId: data.userId,
        correlationId: data.correlationId,
        actionName: data.actionName,
        params: paramsValue,
        status: "PENDING",
        expiresAt: data.expiresAt,
      },
      select: computerAgentActionSelect,
    });
  }

  /**
   * Retrieves an action record by primary key ID.
   */
  async getById(actionId: string): Promise<ComputerAgentActionRecord | null> {
    return this.db.computerAgentAction.findUnique({
      where: { id: actionId },
      select: computerAgentActionSelect,
    });
  }

  /**
   * Retrieves an action record by ID ensuring strict user ownership.
   */
  async getByIdForUser(
    actionId: string,
    userId: string,
  ): Promise<ComputerAgentActionRecord | null> {
    return this.db.computerAgentAction.findFirst({
      where: {
        id: actionId,
        userId,
      },
      select: computerAgentActionSelect,
    });
  }

  /**
   * Retrieves an action record by unique correlation ID.
   */
  async getByCorrelationId(
    correlationId: string,
  ): Promise<ComputerAgentActionRecord | null> {
    return this.db.computerAgentAction.findUnique({
      where: { correlationId },
      select: computerAgentActionSelect,
    });
  }

  /**
   * Retrieves an action record by correlation ID ensuring agent ownership.
   */
  async getByCorrelationIdForAgent(
    correlationId: string,
    agentId: string,
  ): Promise<ComputerAgentActionRecord | null> {
    return this.db.computerAgentAction.findFirst({
      where: {
        correlationId,
        agentId,
      },
      select: computerAgentActionSelect,
    });
  }

  /**
   * Atomically claims the next pending, unexpired action for a given agent.
   * Uses atomic updateMany matching to prevent race conditions across concurrent workers.
   */
  async claimNextForAgent(
    agentId: string,
    now: Date = new Date(),
  ): Promise<ComputerAgentActionRecord | null> {
    const candidates = await this.db.computerAgentAction.findMany({
      where: {
        agentId,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: computerAgentActionSelect,
    });

    for (const candidate of candidates) {
      const updateResult = await this.db.computerAgentAction.updateMany({
        where: {
          id: candidate.id,
          agentId,
          status: "PENDING",
          expiresAt: { gt: now },
        },
        data: {
          status: "CLAIMED",
          claimedAt: now,
        },
      });

      if (updateResult.count === 1) {
        return {
          ...candidate,
          status: "CLAIMED",
          claimedAt: now,
        };
      }
    }

    return null;
  }

  /**
   * Completes an action record with result payload.
   * Strictly verifies agent ownership and ensures only CLAIMED actions can be completed.
   */
  async complete(params: {
    actionId: string;
    agentId?: string;
    result?: unknown;
    completedAt?: Date;
  }): Promise<boolean> {
    const { actionId, agentId, result, completedAt = new Date() } = params;

    const resultValue =
      result !== undefined && result !== null
        ? (result as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    const updateResult = await this.db.computerAgentAction.updateMany({
      where: {
        id: actionId,
        ...(agentId ? { agentId } : {}),
        status: "CLAIMED",
      },
      data: {
        status: "COMPLETED",
        result: resultValue,
        completedAt,
        error: null,
      },
    });

    return updateResult.count === 1;
  }

  /**
   * Fails an action record with an error message.
   * Allows transitioning from PENDING or CLAIMED to FAILED.
   */
  async fail(params: {
    actionId: string;
    agentId?: string;
    error: string;
    completedAt?: Date;
  }): Promise<boolean> {
    const { actionId, agentId, error, completedAt = new Date() } = params;

    const updateResult = await this.db.computerAgentAction.updateMany({
      where: {
        id: actionId,
        ...(agentId ? { agentId } : {}),
        status: { in: ["PENDING", "CLAIMED"] },
      },
      data: {
        status: "FAILED",
        error,
        completedAt,
      },
    });

    return updateResult.count === 1;
  }

  /**
   * Cancels an action record. Strictly enforces user ownership.
   */
  async cancel(params: {
    actionId: string;
    userId: string;
    reason?: string;
    cancelledAt?: Date;
  }): Promise<boolean> {
    const {
      actionId,
      userId,
      reason = "Action cancelled by user.",
      cancelledAt = new Date(),
    } = params;

    const updateResult = await this.db.computerAgentAction.updateMany({
      where: {
        id: actionId,
        userId,
        status: { in: ["PENDING", "CLAIMED"] },
      },
      data: {
        status: "CANCELLED",
        error: reason,
        completedAt: cancelledAt,
      },
    });

    return updateResult.count === 1;
  }

  /**
   * Marks expired actions as TIMED_OUT.
   */
  async markExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db.computerAgentAction.updateMany({
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

    return result.count;
  }

  /**
   * Lists action records by agent.
   */
  async listByAgent(
    options: ListComputerActionsOptions & { agentId: string },
  ): Promise<ComputerAgentActionRecord[]> {
    const { agentId, status, limit = 50 } = options;

    return this.db.computerAgentAction.findMany({
      where: {
        agentId,
        status,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: computerAgentActionSelect,
    });
  }

  /**
   * Lists action records for an authenticated user.
   */
  async listByUser(
    options: ListComputerActionsOptions & { userId: string },
  ): Promise<ComputerAgentActionRecord[]> {
    const { userId, agentId, status, limit = 50 } = options;

    return this.db.computerAgentAction.findMany({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
        status,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: computerAgentActionSelect,
    });
  }
}
