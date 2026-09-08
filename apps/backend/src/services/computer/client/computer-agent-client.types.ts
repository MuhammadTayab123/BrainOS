import { AppError } from "../../../errors";
import {
  ComputerAgentProtocolError,
  ProtocolErrorCode,
} from "../protocol/computer-agent-protocol.types";

/**
 * Configuration options for creating a ComputerAgentClient.
 */
export interface ComputerAgentClientConfig {
  /**
   * The base URL of the BrainOS API server (e.g. "http://localhost:3001").
   */
  baseUrl: string;

  /**
   * The registered Agent ID for authentication.
   */
  agentId: string;

  /**
   * The secret credential token for the agent.
   */
  credential: string;

  /**
   * Default timeout in milliseconds for HTTP requests (defaults to 30,000ms).
   */
  timeoutMs?: number;

  /**
   * Optional custom fetch implementation for testing or custom transport.
   */
  fetch?: typeof fetch;
}

/**
 * Per-call request options.
 */
export interface ComputerAgentClientOptions {
  /**
   * Timeout in milliseconds for this specific request.
   */
  timeoutMs?: number;

  /**
   * Optional AbortSignal for user-driven cancellation.
   */
  signal?: AbortSignal;

  /**
   * Optional additional headers to send.
   */
  headers?: Record<string, string>;
}

export interface ComputerAgentClientErrorOptions {
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
  protocolError?: ComputerAgentProtocolError;
}

/**
 * Structured client error for Computer Agent protocol communication.
 * Security guarantee: Never serializes or exposes agent credentials.
 */
export class ComputerAgentClientError extends AppError {
  public readonly details?: unknown;
  public readonly protocolError?: ComputerAgentProtocolError;

  constructor(options: ComputerAgentClientErrorOptions) {
    super({
      message: sanitizeErrorMessage(options.message),
      statusCode: options.statusCode ?? 500,
      code: options.code ?? ProtocolErrorCode.INTERNAL_ERROR,
    });
    this.name = "ComputerAgentClientError";
    this.details = sanitizeDetails(options.details);
    this.protocolError = options.protocolError;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details !== undefined ? { details: this.details } : {}),
      ...(this.protocolError !== undefined
        ? { protocolError: this.protocolError }
        : {}),
    };
  }
}

/**
 * Strips any potential credential fragments from error strings.
 */
function sanitizeErrorMessage(msg: string): string {
  if (typeof msg !== "string") return "";
  return msg.replace(/ca_sec_[a-zA-Z0-9_-]+/g, "[REDACTED]");
}

/**
 * Sanitizes details payload so credentials are not accidentally stored.
 */
function sanitizeDetails(details: unknown): unknown {
  if (!details || typeof details !== "object") {
    return details;
  }

  if (Array.isArray(details)) {
    return details.map(sanitizeDetails);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (
      key.toLowerCase().includes("credential") ||
      key.toLowerCase().includes("secret") ||
      key.toLowerCase().includes("password") ||
      key.toLowerCase().includes("token")
    ) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeDetails(value);
    } else if (typeof value === "string") {
      result[key] = sanitizeErrorMessage(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
