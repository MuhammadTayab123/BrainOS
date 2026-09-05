import { ComputerActionRisk } from "../../security/computer-action.policy";
import {
  ComputerAgentProtocolError,
  ProtocolErrorCode,
} from "../protocol/computer-agent-protocol.types";

/**
 * Strongly-typed computer action names supported by the BrainOS Computer Agent.
 * Corresponds directly to registered computer actions in the security policy.
 */
export const ComputerActionName = {
  GET_STATUS: "computer_get_status",
  LIST_APPLICATIONS: "computer_list_applications",
  LIST_FILES: "computer_list_files",
  READ_FILE: "computer_read_file",
  LAUNCH_APPLICATION: "computer_launch_application",
  WRITE_FILE: "computer_write_file",
} as const;

export type ComputerActionName =
  (typeof ComputerActionName)[keyof typeof ComputerActionName];

export const ALL_COMPUTER_ACTION_NAMES: readonly ComputerActionName[] = [
  ComputerActionName.GET_STATUS,
  ComputerActionName.LIST_APPLICATIONS,
  ComputerActionName.LIST_FILES,
  ComputerActionName.READ_FILE,
  ComputerActionName.LAUNCH_APPLICATION,
  ComputerActionName.WRITE_FILE,
];

/**
 * Checks whether a given string is a recognized ComputerActionName.
 */
export function isComputerActionName(
  candidate: unknown,
): candidate is ComputerActionName {
  return (
    typeof candidate === "string" &&
    ALL_COMPUTER_ACTION_NAMES.includes(candidate as ComputerActionName)
  );
}

/**
 * Action parameter shapes for supported Computer Actions.
 */
export interface LaunchApplicationActionParams {
  appId: string;
}

export interface ListFilesActionParams {
  path?: string;
}

export interface ReadFileActionParams {
  path: string;
}

export interface WriteFileActionParams {
  path: string;
  content: string;
}

/**
 * Security context for computer action authorization and dispatch.
 *
 * Security guarantees:
 * - agentId is verified by credentials.
 * - userId is strictly server-derived from the persisted agent record.
 * - Permissions are NEVER client-supplied and cannot be passed via this context.
 *   They are resolved exclusively via trusted server-side authorization sources.
 */
export interface ComputerAgentActionContext {
  agentId: string;
  userId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Trusted server-side authorization source for evaluating permissions on privileged actions.
 * Ensures permissions are never client-controlled or derived from request payloads.
 */
export interface ComputerActionPermissionProvider {
  /**
   * Evaluates whether the requested action is permitted for the given agent and server-derived user.
   */
  isActionPermitted(
    action: string,
    context: ComputerAgentActionContext,
  ): Promise<boolean> | boolean;
}

/**
 * Transport-independent request to execute a computer action.
 * Carries a required correlationId for end-to-end tracing.
 */
export interface ComputerActionRequest<TParams = unknown> {
  correlationId: string;
  action: ComputerActionName | string;
  params?: TParams;
  timestamp?: number;
}

/**
 * Transport-independent response for a dispatched computer action.
 * Mirrors the request correlationId.
 */
export interface ComputerActionResponse<TResult = unknown> {
  correlationId: string;
  action: string;
  success: boolean;
  timestamp: number;
  data?: TResult;
  error?: ComputerAgentProtocolError;
}

/**
 * Status outcomes of an action authorization check.
 */
export type ComputerActionAuthStatus = "AUTHORIZED" | "UNAUTHORIZED";

/**
 * Result of evaluating a computer action authorization request.
 */
export interface ComputerActionAuthorizationDecision {
  authorized: boolean;
  status: ComputerActionAuthStatus;
  action: string;
  risk?: ComputerActionRisk;
  authorizationRequired: boolean;
  reason?: string;
  error?: ComputerAgentProtocolError;
}

/**
 * Interface for computer action authorization evaluation.
 */
export interface ComputerActionAuthorizer {
  authorize(
    action: string,
    context: ComputerAgentActionContext,
  ):
    | Promise<ComputerActionAuthorizationDecision>
    | ComputerActionAuthorizationDecision;
}

/**
 * Pluggable handler delegate for executing authorized computer actions.
 * In this contract milestone, no OS execution is attached by default.
 */
export interface ComputerActionHandler<TParams = unknown, TResult = unknown> {
  execute(
    action: ComputerActionName | string,
    params: TParams,
    context: ComputerAgentActionContext,
  ): Promise<TResult>;
}

/**
 * Top-level action dispatch contract.
 */
export interface ComputerAgentActionDispatcher {
  authorize(
    request: ComputerActionRequest,
    context: ComputerAgentActionContext,
  ):
    | Promise<ComputerActionAuthorizationDecision>
    | ComputerActionAuthorizationDecision;

  dispatch<TParams = unknown, TResult = unknown>(
    request: ComputerActionRequest<TParams>,
    context: ComputerAgentActionContext,
  ): Promise<ComputerActionResponse<TResult>>;
}
