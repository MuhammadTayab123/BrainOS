/**
 * Transport-independent protocol version for Computer Agent communication.
 */
export const COMPUTER_AGENT_PROTOCOL_VERSION = "1.0" as const;
export type ComputerAgentProtocolVersion =
  typeof COMPUTER_AGENT_PROTOCOL_VERSION;

/**
 * Supported protocol versions for forward/backward compatibility checking.
 */
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  COMPUTER_AGENT_PROTOCOL_VERSION,
];

/**
 * Standard protocol error codes adhering to BrainOS conventions.
 */
export const ProtocolErrorCode = {
  INVALID_PROTOCOL_VERSION: "INVALID_PROTOCOL_VERSION",
  INVALID_ENVELOPE: "INVALID_ENVELOPE",
  UNAUTHORIZED: "UNAUTHORIZED",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_INACTIVE: "AGENT_INACTIVE",
  ACTION_FAILED: "ACTION_FAILED",
  TIMEOUT: "TIMEOUT",
  PROTOCOL_ERROR: "PROTOCOL_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ProtocolErrorCode =
  (typeof ProtocolErrorCode)[keyof typeof ProtocolErrorCode];

/**
 * Structured protocol error payload for transport-independent serialization.
 */
export interface ComputerAgentProtocolError {
  code: ProtocolErrorCode | string;
  message: string;
  details?: Record<string, unknown> | unknown;
}

/**
 * Agent identity representation in the protocol.
 * Security note: userId is NOT an agent-supplied property; it is strictly
 * retained in server-side authenticated context derived from persisted records.
 */
export interface ComputerAgentIdentity {
  agentId: string;
  name?: string;
  platform?: string;
  architecture?: string;
  version?: string;
}

/**
 * Transport-independent authentication request payload.
 * Security note: Raw credentials are strictly restricted to the authentication operation;
 * they must never be exposed or logged through generic protocol envelopes.
 */
export interface ComputerAgentAuthRequest {
  agentId: string;
  credential: string;
  timestamp?: number | string;
}

/**
 * Authentication context produced upon successful protocol authentication.
 * Server-side context; userId is derived from the persisted ComputerAgent record after authentication.
 */
export interface ComputerAgentAuthContext {
  authenticated: boolean;
  agentId: string;
  userId: string;
  authenticatedAt: Date | string;
}

/**
 * Generic request envelope for transport-independent messaging.
 */
export interface ComputerAgentRequestEnvelope<TPayload = unknown> {
  id: string;
  version: ComputerAgentProtocolVersion | string;
  type: string;
  timestamp: number;
  agentId: string;
  payload: TPayload;
}

/**
 * Generic response envelope for transport-independent messaging.
 */
export interface ComputerAgentResponseEnvelope<TData = unknown> {
  id: string;
  version: ComputerAgentProtocolVersion | string;
  success: boolean;
  timestamp: number;
  data?: TData;
  error?: ComputerAgentProtocolError;
}
