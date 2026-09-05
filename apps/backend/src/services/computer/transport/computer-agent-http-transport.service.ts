import {
  ComputerAgentAuthContext,
  ComputerAgentProtocolException,
  ComputerAgentRequestEnvelope,
  ComputerAgentResponseEnvelope,
  createProtocolErrorResponse,
  createProtocolSuccessResponse,
  generateEnvelopeId,
  ProtocolErrorCode,
  validateProtocolRequestEnvelope,
} from "../protocol";
import {
  ComputerActionRequest,
  ComputerAgentActionContext,
  ComputerAgentActionDispatcher,
} from "../dispatch";
import { EnvelopeReplayGuard } from "./envelope-replay-guard.interface";

export const DEFAULT_MAX_TIMESTAMP_DRIFT_MS = 60_000; // ±60 seconds

export interface ComputerAgentAuthenticator {
  authenticate(
    agentId: string,
    credential: string,
  ): Promise<ComputerAgentAuthContext | null>;
}

export interface ComputerAgentAckData {
  status: "acknowledged";
  receivedAt: number;
}

export interface TransportHeaders {
  agentId?: unknown;
  credential?: unknown;
}

export interface TransportExecutionResult {
  statusCode: number;
  envelope: ComputerAgentResponseEnvelope<unknown>;
}

export interface ComputerAgentHttpTransportOptions {
  authenticator: ComputerAgentAuthenticator;
  replayGuard: EnvelopeReplayGuard;
  dispatcher?: ComputerAgentActionDispatcher;
  clock?: () => number;
  maxDriftMs?: number;
}

/**
 * HTTP Transport Service for Computer Agent communication.
 * Ingress: authenticates credentials, validates protocol envelopes, asserts identity,
 * enforces timestamp bounds, prevents replay, and dispatches action_request envelopes
 * to the authorized action-dispatch pipeline while preserving safe acknowledgement
 * for non-action messages.
 *
 * Security guarantees:
 * - Does NOT execute computer actions directly (delegates exclusively via ComputerAgentActionDispatcher).
 * - Does NOT invoke Gateway, filesystem, shell, or OS operations directly.
 * - Keeps Clerk User Identity separate from Computer Agent Identity.
 * - Derives user ownership strictly from authenticated agent records.
 * - Records replay IDs strictly after authentication and timestamp validation succeed.
 * - Generic authentication failures avoid agent enumeration.
 */
export class ComputerAgentHttpTransportService {
  private readonly authenticator: ComputerAgentAuthenticator;
  private readonly replayGuard: EnvelopeReplayGuard;
  private readonly dispatcher?: ComputerAgentActionDispatcher;
  private readonly clock: () => number;
  private readonly maxDriftMs: number;

  constructor(options: ComputerAgentHttpTransportOptions) {
    this.authenticator = options.authenticator;
    this.replayGuard = options.replayGuard;
    this.dispatcher = options.dispatcher;
    this.clock = options.clock ?? (() => Date.now());
    this.maxDriftMs = options.maxDriftMs ?? DEFAULT_MAX_TIMESTAMP_DRIFT_MS;
  }

  async handleIncomingMessage(
    headers: TransportHeaders,
    body: unknown,
  ): Promise<TransportExecutionResult> {
    const rawAgentId =
      typeof headers.agentId === "string" ? headers.agentId.trim() : "";
    const rawCredential =
      typeof headers.credential === "string" ? headers.credential : "";

    // 1. Fail closed on missing, malformed, or empty authentication headers
    if (rawAgentId.length === 0 || rawCredential.length === 0) {
      return {
        statusCode: 401,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.UNAUTHORIZED,
            message: "Invalid agent credentials.",
          },
        }),
      };
    }

    // 2. Authenticate agent against persisted credentials
    let authContext: ComputerAgentAuthContext | null = null;
    try {
      authContext = await this.authenticator.authenticate(
        rawAgentId,
        rawCredential,
      );
    } catch {
      // Fail closed uniformly on any auth error
      return {
        statusCode: 401,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.UNAUTHORIZED,
            message: "Invalid agent credentials.",
          },
        }),
      };
    }

    if (!authContext || !authContext.authenticated) {
      return {
        statusCode: 401,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.UNAUTHORIZED,
            message: "Invalid agent credentials.",
          },
        }),
      };
    }

    // 3. Validate protocol request envelope structure & supported version
    let envelope: ComputerAgentRequestEnvelope;
    try {
      envelope = validateProtocolRequestEnvelope(body);
    } catch (err: unknown) {
      if (err instanceof ComputerAgentProtocolException) {
        return {
          statusCode: 400,
          envelope: createProtocolErrorResponse({
            id: generateEnvelopeId(),
            error: err,
          }),
        };
      }

      return {
        statusCode: 400,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.INVALID_ENVELOPE,
            message: "Invalid protocol envelope structure.",
          },
        }),
      };
    }

    // 4. Assert agent identity matching (authenticated credential ID must match envelope agentId)
    if (envelope.agentId !== authContext.agentId) {
      return {
        statusCode: 403,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.UNAUTHORIZED,
            message: "Agent identity mismatch.",
          },
        }),
      };
    }

    // 5. Enforce timestamp window (±60 seconds by default)
    const now = this.clock();
    if (Math.abs(now - envelope.timestamp) > this.maxDriftMs) {
      return {
        statusCode: 400,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.PROTOCOL_ERROR,
            message: "Message timestamp outside acceptable window.",
          },
        }),
      };
    }

    // 6. Atomically check and record envelope ID strictly AFTER auth and timestamp validation succeed
    const accepted = await this.replayGuard.checkAndRecord(
      envelope.id,
      envelope.timestamp,
    );
    if (!accepted) {
      return {
        statusCode: 409,
        envelope: createProtocolErrorResponse({
          id: generateEnvelopeId(),
          error: {
            code: ProtocolErrorCode.PROTOCOL_ERROR,
            message: "Duplicate envelope ID rejected.",
          },
        }),
      };
    }

    // 7. Dispatch action if envelope.type === "action_request"
    if (envelope.type === "action_request") {
      if (!this.dispatcher) {
        return {
          statusCode: 200,
          envelope: createProtocolErrorResponse({
            id: envelope.id,
            timestamp: now,
            error: {
              code: ProtocolErrorCode.ACTION_FAILED,
              message: "Action dispatcher is not configured.",
            },
          }),
        };
      }

      const payloadObj =
        typeof envelope.payload === "object" &&
        envelope.payload !== null &&
        !Array.isArray(envelope.payload)
          ? (envelope.payload as Record<string, unknown>)
          : null;

      const correlationId =
        payloadObj &&
        typeof payloadObj.correlationId === "string" &&
        payloadObj.correlationId.trim().length > 0
          ? payloadObj.correlationId.trim()
          : envelope.id;

      const action =
        payloadObj && typeof payloadObj.action === "string"
          ? payloadObj.action.trim()
          : "";

      const actionRequest: ComputerActionRequest = {
        correlationId,
        action,
        params: payloadObj ? payloadObj.params : undefined,
        timestamp: envelope.timestamp,
      };

      const context: ComputerAgentActionContext = {
        agentId: authContext.agentId,
        userId: authContext.userId,
      };

      try {
        const actionResponse = await this.dispatcher.dispatch(
          actionRequest,
          context,
        );

        if (!actionResponse.success) {
          return {
            statusCode: 200,
            envelope: createProtocolErrorResponse({
              id: envelope.id,
              timestamp: now,
              error: actionResponse.error ?? {
                code: ProtocolErrorCode.ACTION_FAILED,
                message: "Action execution failed.",
              },
            }),
          };
        }

        return {
          statusCode: 200,
          envelope: createProtocolSuccessResponse({
            id: envelope.id,
            timestamp: now,
            data: actionResponse.data,
          }),
        };
      } catch {
        return {
          statusCode: 200,
          envelope: createProtocolErrorResponse({
            id: envelope.id,
            timestamp: now,
            error: {
              code: ProtocolErrorCode.ACTION_FAILED,
              message: "Action execution failed.",
            },
          }),
        };
      }
    }

    // 8. Return safe protocol acknowledgement for non-action messages (e.g. ping)
    // Uses incoming envelope.id as response envelope id; preserves protocol contract without adding requestId.
    return {
      statusCode: 200,
      envelope: createProtocolSuccessResponse<ComputerAgentAckData>({
        id: envelope.id,
        timestamp: now,
        data: {
          status: "acknowledged",
          receivedAt: now,
        },
      }),
    };
  }
}
