import crypto from "node:crypto";
import { AppError } from "../../../errors";
import {
  ActionPollPayload,
  ActionResultPayload,
  COMPUTER_AGENT_PROTOCOL_VERSION,
  ComputerAgentProtocolError,
  ComputerAgentRequestEnvelope,
  ComputerAgentResponseEnvelope,
  ProtocolErrorCode,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "./computer-agent-protocol.types";

/**
 * Structured protocol exception adhering to BrainOS AppError conventions.
 */
export class ComputerAgentProtocolException extends AppError {
  public readonly details?: unknown;

  constructor({
    message,
    code = ProtocolErrorCode.PROTOCOL_ERROR,
    statusCode = 400,
    details,
  }: {
    message: string;
    code?: string;
    statusCode?: number;
    details?: unknown;
  }) {
    super({ message, statusCode, code });
    this.name = "ComputerAgentProtocolException";
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
 * Checks whether a given protocol version string is currently supported.
 */
export function isSupportedProtocolVersion(version: unknown): boolean {
  return (
    typeof version === "string" &&
    SUPPORTED_PROTOCOL_VERSIONS.includes(version.trim())
  );
}

/**
 * Generates a unique correlation ID for protocol envelopes.
 */
export function generateEnvelopeId(): string {
  return crypto.randomUUID();
}

/**
 * Creates a transport-independent protocol request envelope.
 */
export function createProtocolRequest<T>(params: {
  type: string;
  agentId: string;
  payload: T;
  id?: string;
  version?: string;
  timestamp?: number;
}): ComputerAgentRequestEnvelope<T> {
  const {
    type,
    agentId,
    payload,
    id = generateEnvelopeId(),
    version = COMPUTER_AGENT_PROTOCOL_VERSION,
    timestamp = Date.now(),
  } = params;

  if (typeof type !== "string" || type.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope type is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof agentId !== "string" || agentId.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope agentId is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  return {
    id: id.trim(),
    version: version.trim(),
    type: type.trim(),
    timestamp,
    agentId: agentId.trim(),
    payload,
  };
}

/**
 * Creates a successful transport-independent protocol response envelope.
 */
export function createProtocolSuccessResponse<T>(params: {
  id: string;
  data: T;
  version?: string;
  timestamp?: number;
}): ComputerAgentResponseEnvelope<T> {
  const {
    id,
    data,
    version = COMPUTER_AGENT_PROTOCOL_VERSION,
    timestamp = Date.now(),
  } = params;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Response envelope id is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  return {
    id: id.trim(),
    version: version.trim(),
    success: true,
    timestamp,
    data,
  };
}

/**
 * Creates a structured error protocol response envelope.
 */
export function createProtocolErrorResponse(params: {
  id: string;
  error:
    | ComputerAgentProtocolError
    | ComputerAgentProtocolException
    | { code: string; message: string; details?: unknown };
  version?: string;
  timestamp?: number;
}): ComputerAgentResponseEnvelope<never> {
  const {
    id,
    error,
    version = COMPUTER_AGENT_PROTOCOL_VERSION,
    timestamp = Date.now(),
  } = params;

  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Response envelope id is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  let protocolError: ComputerAgentProtocolError;

  if (error instanceof ComputerAgentProtocolException) {
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
      code: ProtocolErrorCode.PROTOCOL_ERROR,
      message: "An unknown protocol error occurred.",
    };
  }

  return {
    id: id.trim(),
    version: version.trim(),
    success: false,
    timestamp,
    error: protocolError,
  };
}

/**
 * Validates a candidate request envelope.
 * Throws ComputerAgentProtocolException if invalid or unsupported.
 */
export function validateProtocolRequestEnvelope<TPayload = unknown>(
  candidate: unknown,
): ComputerAgentRequestEnvelope<TPayload> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope must be a valid JSON object.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  const obj = candidate as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope id must be a non-empty string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof obj.version !== "string" || obj.version.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope version is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (!isSupportedProtocolVersion(obj.version)) {
    throw new ComputerAgentProtocolException({
      message: `Unsupported protocol version: ${obj.version}. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
      code: ProtocolErrorCode.INVALID_PROTOCOL_VERSION,
      details: {
        providedVersion: obj.version,
        supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
      },
    });
  }

  if (typeof obj.type !== "string" || obj.type.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope type must be a non-empty string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof obj.agentId !== "string" || obj.agentId.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope agentId must be a non-empty string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof obj.timestamp !== "number" || !Number.isFinite(obj.timestamp)) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope timestamp must be a valid numeric timestamp.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (!("payload" in obj)) {
    throw new ComputerAgentProtocolException({
      message: "Request envelope payload is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  return {
    id: obj.id.trim(),
    version: obj.version.trim(),
    type: obj.type.trim(),
    agentId: obj.agentId.trim(),
    timestamp: obj.timestamp,
    payload: obj.payload as TPayload,
  };
}

/**
 * Validates a candidate response envelope.
 * Throws ComputerAgentProtocolException if invalid or unsupported.
 */
export function validateProtocolResponseEnvelope<TData = unknown>(
  candidate: unknown,
): ComputerAgentResponseEnvelope<TData> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new ComputerAgentProtocolException({
      message: "Response envelope must be a valid JSON object.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  const obj = candidate as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Response envelope id must be a non-empty string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof obj.version !== "string" || obj.version.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "Response envelope version is required.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (!isSupportedProtocolVersion(obj.version)) {
    throw new ComputerAgentProtocolException({
      message: `Unsupported protocol version: ${obj.version}. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
      code: ProtocolErrorCode.INVALID_PROTOCOL_VERSION,
      details: {
        providedVersion: obj.version,
        supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
      },
    });
  }

  if (typeof obj.success !== "boolean") {
    throw new ComputerAgentProtocolException({
      message: "Response envelope success must be a boolean.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof obj.timestamp !== "number" || !Number.isFinite(obj.timestamp)) {
    throw new ComputerAgentProtocolException({
      message: "Response envelope timestamp must be a valid numeric timestamp.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (!obj.success) {
    if (typeof obj.error !== "object" || obj.error === null) {
      throw new ComputerAgentProtocolException({
        message: "Error response envelope must include a structured error object.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
      });
    }

    const err = obj.error as Record<string, unknown>;
    if (typeof err.code !== "string" || typeof err.message !== "string") {
      throw new ComputerAgentProtocolException({
        message: "Response error must contain string code and message.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
      });
    }
  }

  return {
    id: obj.id.trim(),
    version: obj.version.trim(),
    success: obj.success,
    timestamp: obj.timestamp,
    ...(obj.data !== undefined ? { data: obj.data as TData } : {}),
    ...(obj.error !== undefined
      ? { error: obj.error as ComputerAgentProtocolError }
      : {}),
  };
}

/**
 * Validates payload for "action_poll" envelopes.
 */
export function validateActionPollPayload(
  candidate: unknown,
): ActionPollPayload {
  if (candidate === undefined || candidate === null) {
    return {};
  }

  if (typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new ComputerAgentProtocolException({
      message: "Action poll payload must be a valid JSON object.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  const obj = candidate as Record<string, unknown>;
  if (obj.capabilities !== undefined) {
    if (
      !Array.isArray(obj.capabilities) ||
      !obj.capabilities.every((c) => typeof c === "string")
    ) {
      throw new ComputerAgentProtocolException({
        message: "capabilities must be an array of strings.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
      });
    }
  }

  return candidate as ActionPollPayload;
}

/**
 * Validates payload for "action_result" envelopes.
 */
export function validateActionResultPayload(
  candidate: unknown,
): ActionResultPayload {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new ComputerAgentProtocolException({
      message: "Action result payload must be a valid JSON object.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  const obj = candidate as Record<string, unknown>;

  if (typeof obj.actionId !== "string" || obj.actionId.trim().length === 0) {
    throw new ComputerAgentProtocolException({
      message: "actionId must be a non-empty string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (
    typeof obj.correlationId !== "string" ||
    obj.correlationId.trim().length === 0
  ) {
    throw new ComputerAgentProtocolException({
      message: "correlationId must be a non-empty string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (typeof obj.success !== "boolean") {
    throw new ComputerAgentProtocolException({
      message: "success must be a boolean.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  if (obj.error !== undefined && typeof obj.error !== "string") {
    throw new ComputerAgentProtocolException({
      message: "error must be a string.",
      code: ProtocolErrorCode.INVALID_ENVELOPE,
    });
  }

  return {
    actionId: obj.actionId.trim(),
    correlationId: obj.correlationId.trim(),
    success: obj.success,
    ...(obj.result !== undefined ? { result: obj.result } : {}),
    ...(obj.error !== undefined ? { error: obj.error } : {}),
  };
}
