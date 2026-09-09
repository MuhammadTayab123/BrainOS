import crypto from "node:crypto";
import { AppError, NotFoundError } from "../../../errors";
import { ComputerAgentRepository } from "../repositories/computer-agent.repository";
import { ComputerAgentActionRepository } from "../repositories/computer-agent-action.repository";
import {
  CancelComputerActionParams,
  CompleteComputerActionParams,
  ComputerAgentActionRecord,
  ComputerAgentActionStatus,
  EnqueueComputerActionInput,
  FailComputerActionParams,
  ListComputerActionsOptions,
} from "./computer-action-queue.types";

export const DEFAULT_ACTION_TTL_MS = 30_000; // 30 seconds
export const MIN_ACTION_TTL_MS = 1_000; // 1 second
export const MAX_ACTION_TTL_MS = 300_000; // 5 minutes

export interface ComputerActionQueueServiceOptions {
  actionRepository?: ComputerAgentActionRepository;
  agentRepository?: ComputerAgentRepository;
  clock?: () => Date;
}

/**
 * Service managing durable queuing, atomic claims, completions, failures,
 * and lifecycle timeouts for remote Computer Agent actions.
 */
export class ComputerActionQueueService {
  private readonly actionRepository: ComputerAgentActionRepository;
  private readonly agentRepository: ComputerAgentRepository;
  private readonly clock: () => Date;

  constructor(options: ComputerActionQueueServiceOptions = {}) {
    this.actionRepository =
      options.actionRepository ?? new ComputerAgentActionRepository();
    this.agentRepository =
      options.agentRepository ?? new ComputerAgentRepository();
    this.clock = options.clock ?? (() => new Date());
  }

  /**
   * Enqueues a new computer action for a validated user and active agent.
   */
  async enqueueAction(
    input: EnqueueComputerActionInput,
  ): Promise<ComputerAgentActionRecord> {
    const cleanUserId = this.validateUserId(input.userId);
    const cleanAgentId = this.validateId(input.agentId, "Agent ID");
    const cleanActionName = this.validateActionName(input.actionName);

    // Verify agent exists, is owned by userId, and is ACTIVE
    const agent = await this.agentRepository.findByIdForUser(
      cleanAgentId,
      cleanUserId,
    );

    if (!agent) {
      throw new NotFoundError(
        "Computer agent not found for the authenticated user.",
      );
    }

    if (agent.status !== "ACTIVE") {
      throw new AppError({
        message: "Cannot enqueue action for an inactive or revoked agent.",
        statusCode: 409,
        code: "AGENT_INACTIVE",
      });
    }

    const now = this.clock();
    let expiresAt: Date;

    if (input.expiresAt) {
      if (input.expiresAt.getTime() <= now.getTime()) {
        throw new AppError({
          message: "Action expiration timestamp must be in the future.",
          statusCode: 400,
          code: "INVALID_EXPIRATION",
        });
      }
      expiresAt = input.expiresAt;
    } else {
      const ttlMs = input.expiresInMs ?? DEFAULT_ACTION_TTL_MS;
      if (
        !Number.isFinite(ttlMs) ||
        ttlMs < MIN_ACTION_TTL_MS ||
        ttlMs > MAX_ACTION_TTL_MS
      ) {
        throw new AppError({
          message: `Action TTL must be between ${MIN_ACTION_TTL_MS}ms and ${MAX_ACTION_TTL_MS}ms.`,
          statusCode: 400,
          code: "INVALID_TTL",
        });
      }
      expiresAt = new Date(now.getTime() + ttlMs);
    }

    const correlationId =
      input.correlationId && input.correlationId.trim().length > 0
        ? input.correlationId.trim()
        : crypto.randomUUID();

    return this.actionRepository.enqueue({
      userId: cleanUserId,
      agentId: cleanAgentId,
      actionName: cleanActionName,
      params: input.params,
      correlationId,
      expiresAt,
    });
  }

  /**
   * Atomically claims the next pending, unexpired action for an authenticated agent.
   */
  async claimNextAction(
    agentId: string,
  ): Promise<ComputerAgentActionRecord | null> {
    const cleanAgentId = this.validateId(agentId, "Agent ID");
    const now = this.clock();

    // Expire any stale actions prior to or during claim resolution
    await this.actionRepository.markExpired(now);

    return this.actionRepository.claimNextForAgent(cleanAgentId, now);
  }

  /**
   * Completes an in-flight action with its result payload.
   * Strictly enforces agent ownership and state transitions.
   */
  async completeAction(
    params: CompleteComputerActionParams,
  ): Promise<ComputerAgentActionRecord> {
    const cleanAgentId = this.validateId(params.agentId, "Agent ID");
    const now = params.completedAt ?? this.clock();

    const record = await this.resolveActionRecord(params);

    if (record.agentId !== cleanAgentId) {
      throw new AppError({
        message: "Action does not belong to the authenticated agent.",
        statusCode: 403,
        code: "AGENT_MISMATCH",
      });
    }

    if (
      params.correlationId &&
      record.correlationId !== params.correlationId.trim()
    ) {
      throw new AppError({
        message: "Action correlation ID mismatch.",
        statusCode: 400,
        code: "CORRELATION_MISMATCH",
      });
    }

    if (record.status === "COMPLETED") {
      // Idempotent completion check
      return record;
    }

    if (record.status !== "CLAIMED") {
      throw new AppError({
        message: `Cannot complete action in status "${record.status}". Action must be CLAIMED.`,
        statusCode: 409,
        code: "INVALID_STATUS_TRANSITION",
      });
    }

    const success = await this.actionRepository.complete({
      actionId: record.id,
      agentId: cleanAgentId,
      result: params.result,
      completedAt: now,
    });

    if (!success) {
      // Re-fetch to check if another process updated it
      const updated = await this.actionRepository.getById(record.id);
      if (updated && updated.status === "COMPLETED") {
        return updated;
      }

      throw new AppError({
        message: "Failed to complete action.",
        statusCode: 409,
        code: "ACTION_UPDATE_FAILED",
      });
    }

    return {
      ...record,
      status: "COMPLETED",
      result: params.result ?? null,
      completedAt: now,
      error: null,
    };
  }

  /**
   * Fails an action with an error message.
   * Strictly enforces agent ownership.
   */
  async failAction(
    params: FailComputerActionParams,
  ): Promise<ComputerAgentActionRecord> {
    const cleanAgentId = this.validateId(params.agentId, "Agent ID");
    const cleanError =
      typeof params.error === "string" && params.error.trim().length > 0
        ? params.error.trim()
        : "Action execution failed.";
    const now = params.completedAt ?? this.clock();

    const record = await this.resolveActionRecord(params);

    if (record.agentId !== cleanAgentId) {
      throw new AppError({
        message: "Action does not belong to the authenticated agent.",
        statusCode: 403,
        code: "AGENT_MISMATCH",
      });
    }

    if (
      params.correlationId &&
      record.correlationId !== params.correlationId.trim()
    ) {
      throw new AppError({
        message: "Action correlation ID mismatch.",
        statusCode: 400,
        code: "CORRELATION_MISMATCH",
      });
    }

    if (record.status === "FAILED") {
      return record;
    }

    if (record.status === "COMPLETED") {
      throw new AppError({
        message: "Cannot fail an already completed action.",
        statusCode: 409,
        code: "INVALID_STATUS_TRANSITION",
      });
    }

    const success = await this.actionRepository.fail({
      actionId: record.id,
      agentId: cleanAgentId,
      error: cleanError,
      completedAt: now,
    });

    if (!success) {
      throw new AppError({
        message: "Failed to update action to FAILED status.",
        statusCode: 409,
        code: "ACTION_UPDATE_FAILED",
      });
    }

    return {
      ...record,
      status: "FAILED",
      error: cleanError,
      completedAt: now,
    };
  }

  /**
   * Cancels a pending or claimed action on behalf of the owning user.
   */
  async cancelAction(
    params: CancelComputerActionParams,
  ): Promise<ComputerAgentActionRecord> {
    const cleanUserId = this.validateUserId(params.userId);
    const cleanActionId = this.validateId(params.actionId, "Action ID");
    const now = params.cancelledAt ?? this.clock();

    const record = await this.actionRepository.getByIdForUser(
      cleanActionId,
      cleanUserId,
    );

    if (!record) {
      throw new NotFoundError(
        "Computer agent action not found for the authenticated user.",
      );
    }

    if (record.status === "CANCELLED") {
      return record;
    }

    if (record.status === "COMPLETED" || record.status === "FAILED") {
      throw new AppError({
        message: `Cannot cancel an action that is already "${record.status}".`,
        statusCode: 409,
        code: "CANNOT_CANCEL_FINISHED_ACTION",
      });
    }

    const success = await this.actionRepository.cancel({
      actionId: cleanActionId,
      userId: cleanUserId,
      reason: params.reason,
      cancelledAt: now,
    });

    if (!success) {
      throw new AppError({
        message: "Failed to cancel action.",
        statusCode: 409,
        code: "ACTION_UPDATE_FAILED",
      });
    }

    return {
      ...record,
      status: "CANCELLED",
      error: params.reason ?? "Action cancelled by user.",
      completedAt: now,
    };
  }

  /**
   * Marks stale pending/claimed actions past expiresAt as TIMED_OUT.
   */
  async expireStaleActions(): Promise<number> {
    const now = this.clock();
    return this.actionRepository.markExpired(now);
  }

  /**
   * Retrieves an action record for a user.
   */
  async getAction(
    actionId: string,
    userId: string,
  ): Promise<ComputerAgentActionRecord> {
    const cleanUserId = this.validateUserId(userId);
    const cleanActionId = this.validateId(actionId, "Action ID");

    const record = await this.actionRepository.getByIdForUser(
      cleanActionId,
      cleanUserId,
    );

    if (!record) {
      throw new NotFoundError(
        "Computer agent action not found for the authenticated user.",
      );
    }

    return record;
  }

  /**
   * Lists actions for an authenticated user.
   */
  async listActions(
    options: ListComputerActionsOptions & { userId: string },
  ): Promise<ComputerAgentActionRecord[]> {
    const cleanUserId = this.validateUserId(options.userId);
    return this.actionRepository.listByUser({
      ...options,
      userId: cleanUserId,
    });
  }

  private async resolveActionRecord(params: {
    actionId?: string;
    correlationId?: string;
  }): Promise<ComputerAgentActionRecord> {
    if (params.actionId && params.actionId.trim().length > 0) {
      const record = await this.actionRepository.getById(
        params.actionId.trim(),
      );
      if (!record) {
        throw new NotFoundError("Computer agent action not found.");
      }
      return record;
    }

    if (params.correlationId && params.correlationId.trim().length > 0) {
      const record = await this.actionRepository.getByCorrelationId(
        params.correlationId.trim(),
      );
      if (!record) {
        throw new NotFoundError("Computer agent action not found.");
      }
      return record;
    }

    throw new AppError({
      message: "Either actionId or correlationId must be provided.",
      statusCode: 400,
      code: "INVALID_IDENTIFIER",
    });
  }

  private validateUserId(userId: unknown): string {
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("User ID is required.");
    }
    return userId.trim();
  }

  private validateId(id: unknown, label: string): string {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error(`${label} is required.`);
    }
    return id.trim();
  }

  private validateActionName(actionName: unknown): string {
    if (typeof actionName !== "string" || actionName.trim().length === 0) {
      throw new Error("Action name is required.");
    }
    return actionName.trim();
  }
}
