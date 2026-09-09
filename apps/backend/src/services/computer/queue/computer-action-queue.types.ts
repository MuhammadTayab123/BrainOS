import { ComputerAgentActionStatus } from "@prisma/client";

export { ComputerAgentActionStatus };

/**
 * Persisted ComputerAgentAction record domain representation.
 */
export interface ComputerAgentActionRecord {
  id: string;
  agentId: string;
  userId: string;
  correlationId: string;
  actionName: string;
  params: unknown | null;
  status: ComputerAgentActionStatus;
  result: unknown | null;
  error: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for enqueuing a new computer action.
 */
export interface EnqueueComputerActionInput {
  agentId: string;
  userId: string;
  actionName: string;
  params?: unknown;
  correlationId?: string;
  expiresInMs?: number;
  expiresAt?: Date;
}

/**
 * Options for listing queued actions.
 */
export interface ListComputerActionsOptions {
  userId?: string;
  agentId?: string;
  status?: ComputerAgentActionStatus;
  limit?: number;
}

/**
 * Parameters for completing an action.
 */
export interface CompleteComputerActionParams {
  actionId?: string;
  correlationId?: string;
  agentId: string;
  result?: unknown;
  completedAt?: Date;
}

/**
 * Parameters for failing an action.
 */
export interface FailComputerActionParams {
  actionId?: string;
  correlationId?: string;
  agentId: string;
  error: string;
  completedAt?: Date;
}

/**
 * Parameters for cancelling an action.
 */
export interface CancelComputerActionParams {
  actionId: string;
  userId: string;
  reason?: string;
  cancelledAt?: Date;
}
