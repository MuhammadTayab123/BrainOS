import crypto from "node:crypto";
import { AppError } from "../../../errors";
import {
  ComputerAgentProtocolError,
  ProtocolErrorCode,
} from "../protocol/computer-agent-protocol.types";
import { ComputerAgentActionAuthorizer } from "./computer-agent-action-authorizer";
import {
  ComputerActionAuthorizationDecision,
  ComputerActionAuthorizer,
  ComputerActionHandler,
  ComputerActionName,
  ComputerActionRequest,
  ComputerActionResponse,
  ComputerAgentActionContext,
  ComputerAgentActionDispatcher,
} from "./computer-agent-dispatch.types";

/**
 * Structured exception for computer agent action errors adhering to BrainOS AppError conventions.
 */
export class ComputerAgentActionException extends AppError {
  public readonly correlationId?: string;
  public readonly action?: string;
  public readonly details?: unknown;

  constructor({
    message,
    code = ProtocolErrorCode.ACTION_FAILED,
    statusCode = 400,
    correlationId,
    action,
    details,
  }: {
    message: string;
    code?: ProtocolErrorCode | string;
    statusCode?: number;
    correlationId?: string;
    action?: string;
    details?: unknown;
  }) {
    super({ message, statusCode, code });
    this.name = "ComputerAgentActionException";
    this.correlationId = correlationId;
    this.action = action;
    this.details = details;
  }

  toProtocolError(): ComputerAgentProtocolError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

/**
 * Generates a unique correlation ID for tracking action requests across boundaries.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Helper to construct a typed ComputerActionRequest.
 */
export function createActionRequest<T = unknown>(params: {
  action: ComputerActionName | string;
  params?: T;
  correlationId?: string;
  timestamp?: number;
}): ComputerActionRequest<T> {
  const {
    action,
    params: actionParams,
    correlationId = generateCorrelationId(),
    timestamp = Date.now(),
  } = params;

  if (typeof action !== "string" || action.trim().length === 0) {
    throw new ComputerAgentActionException({
      message: "Action name is required.",
      code: ProtocolErrorCode.ACTION_FAILED,
      correlationId,
    });
  }

  return {
    correlationId: correlationId.trim(),
    action: action.trim(),
    params: actionParams,
    timestamp,
  };
}

/**
 * Helper to construct a successful ComputerActionResponse.
 */
export function createActionSuccessResponse<T = unknown>(params: {
  correlationId: string;
  action: string;
  data: T;
  timestamp?: number;
}): ComputerActionResponse<T> {
  const {
    correlationId,
    action,
    data,
    timestamp = Date.now(),
  } = params;

  return {
    correlationId: correlationId.trim(),
    action: action.trim(),
    success: true,
    timestamp,
    data,
  };
}

/**
 * Helper to construct an error ComputerActionResponse.
 */
export function createActionErrorResponse(params: {
  correlationId: string;
  action: string;
  error:
    | ComputerAgentProtocolError
    | ComputerAgentActionException
    | { code: string; message: string; details?: unknown };
  timestamp?: number;
}): ComputerActionResponse<never> {
  const {
    correlationId,
    action,
    error,
    timestamp = Date.now(),
  } = params;

  let protocolError: ComputerAgentProtocolError;

  if (error instanceof ComputerAgentActionException) {
    protocolError = error.toProtocolError();
  } else if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  ) {
    protocolError = {
      code: String(error.code),
      message: String(error.message),
      ...(error.details !== undefined ? { details: error.details } : {}),
    };
  } else {
    protocolError = {
      code: ProtocolErrorCode.ACTION_FAILED,
      message: "Action execution failed.",
    };
  }

  return {
    correlationId: correlationId.trim(),
    action: action.trim(),
    success: false,
    timestamp,
    error: protocolError,
  };
}

export interface ComputerAgentActionDispatcherOptions {
  authorizer?: ComputerActionAuthorizer;
  handler?: ComputerActionHandler;
  clock?: () => number;
}

/**
 * Transport-independent Computer Agent Action Dispatcher.
 * Coordinates request validation, authorization checks, and execution boundaries.
 *
 * Rules:
 * - Contract only; does NOT invoke LocalComputerAgent, shell, filesystem, or OS actions.
 * - Does NOT connect HTTP transport directly to Gateway.
 * - Injects optional ComputerActionHandler for testability and future delegation.
 */
export class DefaultComputerAgentActionDispatcher
  implements ComputerAgentActionDispatcher
{
  private readonly authorizer: ComputerActionAuthorizer;
  private readonly handler?: ComputerActionHandler;
  private readonly clock: () => number;

  constructor(options: ComputerAgentActionDispatcherOptions = {}) {
    this.authorizer =
      options.authorizer ?? new ComputerAgentActionAuthorizer();
    this.handler = options.handler;
    this.clock = options.clock ?? (() => Date.now());
  }

  async authorize(
    request: ComputerActionRequest,
    context: ComputerAgentActionContext,
  ): Promise<ComputerActionAuthorizationDecision> {
    return this.authorizer.authorize(request.action, context);
  }

  async dispatch<TParams = unknown, TResult = unknown>(
    request: ComputerActionRequest<TParams>,
    context: ComputerAgentActionContext,
  ): Promise<ComputerActionResponse<TResult>> {
    const timestamp = this.clock();

    // 1. Validate request structure
    if (!request || typeof request !== "object" || Array.isArray(request)) {
      return createActionErrorResponse({
        correlationId: "",
        action: "",
        timestamp,
        error: {
          code: ProtocolErrorCode.INVALID_ENVELOPE,
          message: "Action request must be a valid JSON object.",
        },
      });
    }

    const correlationId =
      typeof request.correlationId === "string"
        ? request.correlationId.trim()
        : "";

    if (correlationId.length === 0) {
      return createActionErrorResponse({
        correlationId: "",
        action: typeof request.action === "string" ? request.action : "",
        timestamp,
        error: {
          code: ProtocolErrorCode.INVALID_ENVELOPE,
          message: "Action request correlationId is required.",
        },
      });
    }

    const action =
      typeof request.action === "string" ? request.action.trim() : "";

    if (action.length === 0) {
      return createActionErrorResponse({
        correlationId,
        action: "",
        timestamp,
        error: {
          code: ProtocolErrorCode.ACTION_FAILED,
          message: "Action name must be a non-empty string.",
        },
      });
    }

    // 2. Authorize action against policy and context (always runs before handler execution)
    const decision = await this.authorizer.authorize(action, context);

    if (!decision.authorized) {
      return createActionErrorResponse({
        correlationId,
        action,
        timestamp,
        error: decision.error ?? {
          code: ProtocolErrorCode.UNAUTHORIZED,
          message: decision.reason ?? "Action authorization failed.",
        },
      });
    }

    // 3. Delegate to registered action handler if bound
    if (this.handler) {
      try {
        const result = (await this.handler.execute(
          action,
          request.params,
          context,
        )) as TResult;

        return createActionSuccessResponse({
          correlationId,
          action,
          data: result,
          timestamp,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Action execution failed.";

        return createActionErrorResponse({
          correlationId,
          action,
          timestamp,
          error: {
            code: ProtocolErrorCode.ACTION_FAILED,
            message,
          },
        });
      }
    }

    // 4. Contract milestone default: fail closed when no handler is bound without executing OS actions
    return createActionErrorResponse({
      correlationId,
      action,
      timestamp,
      error: {
        code: ProtocolErrorCode.ACTION_FAILED,
        message: `Action "${action}" authorized, but no action execution handler is bound to dispatcher.`,
      },
    });
  }
}
