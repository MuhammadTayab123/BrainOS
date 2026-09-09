import {
  createProtocolRequest,
  generateEnvelopeId,
  validateProtocolResponseEnvelope,
} from "../protocol/computer-agent-protocol";
import {
  ActionPollPayload,
  ActionPollResponseData,
  ActionResultPayload,
  ActionResultResponseData,
  ComputerAgentRequestEnvelope,
  ComputerAgentResponseEnvelope,
  ProtocolErrorCode,
} from "../protocol/computer-agent-protocol.types";
import {
  ComputerActionName,
  isComputerActionName,
} from "../dispatch/computer-agent-dispatch.types";
import {
  ComputerAgentClientConfig,
  ComputerAgentClientError,
  ComputerAgentClientOptions,
} from "./computer-agent-client.types";

const DEFAULT_TIMEOUT_MS = 30_000;
const PROTOCOL_MESSAGES_ENDPOINT = "/api/v1/computer-agents/protocol/messages";

/**
 * Lightweight, transport-level client for the BrainOS Computer Agent Protocol.
 *
 * Security & architectural guarantees:
 * - Credentials only accepted via constructor config or fromEnv().
 * - Never logs or serializes secret credentials.
 * - Enforces strict timeout and AbortController cancellation.
 * - Validates all incoming and outgoing protocol envelopes.
 * - Does not execute arbitrary OS commands or duplicate server authorization logic.
 * - Fails closed on malformed or unauthorized responses.
 */
export class ComputerAgentClient {
  public readonly baseUrl: string;
  public readonly agentId: string;
  private readonly credential: string;
  public readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: ComputerAgentClientConfig) {
    if (!config || typeof config !== "object") {
      throw new ComputerAgentClientError({
        message: "ComputerAgentClientConfig must be an object.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (
      typeof config.baseUrl !== "string" ||
      config.baseUrl.trim().length === 0
    ) {
      throw new ComputerAgentClientError({
        message: "Computer agent client baseUrl is required.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    const trimmedBaseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    try {
      new URL(trimmedBaseUrl);
    } catch {
      throw new ComputerAgentClientError({
        message: `Invalid baseUrl provided: "${trimmedBaseUrl}". Must be a valid URL.`,
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (
      typeof config.agentId !== "string" ||
      config.agentId.trim().length === 0
    ) {
      throw new ComputerAgentClientError({
        message: "Computer agent client agentId is required.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (
      typeof config.credential !== "string" ||
      config.credential.length === 0
    ) {
      throw new ComputerAgentClientError({
        message: "Computer agent client credential is required.",
        code: ProtocolErrorCode.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    this.baseUrl = trimmedBaseUrl;
    this.agentId = config.agentId.trim();
    this.credential = config.credential;
    this.timeoutMs =
      typeof config.timeoutMs === "number" && config.timeoutMs > 0
        ? config.timeoutMs
        : DEFAULT_TIMEOUT_MS;
    this.fetchFn = config.fetch ?? globalThis.fetch;

    if (typeof this.fetchFn !== "function") {
      throw new ComputerAgentClientError({
        message: "No fetch implementation available.",
        code: ProtocolErrorCode.INTERNAL_ERROR,
        statusCode: 500,
      });
    }
  }

  /**
   * Initializes a ComputerAgentClient instance using environment variables.
   * Recognizes:
   * - BRAINOS_BACKEND_URL / BRAINOS_API_URL / COMPUTER_AGENT_BACKEND_URL
   * - BRAINOS_AGENT_ID / COMPUTER_AGENT_ID
   * - BRAINOS_AGENT_CREDENTIAL / COMPUTER_AGENT_CREDENTIAL
   * - BRAINOS_AGENT_TIMEOUT_MS
   */
  static fromEnv(
    env: NodeJS.ProcessEnv = process.env,
    customFetch?: typeof fetch,
  ): ComputerAgentClient {
    const baseUrl =
      env.BRAINOS_BACKEND_URL ??
      env.BRAINOS_API_URL ??
      env.COMPUTER_AGENT_BACKEND_URL ??
      env.BRAINOS_URL;

    const agentId = env.BRAINOS_AGENT_ID ?? env.COMPUTER_AGENT_ID;
    const credential =
      env.BRAINOS_AGENT_CREDENTIAL ?? env.COMPUTER_AGENT_CREDENTIAL;

    const rawTimeout = env.BRAINOS_AGENT_TIMEOUT_MS;
    let timeoutMs: number | undefined;
    if (rawTimeout && /^\d+$/.test(rawTimeout.trim())) {
      timeoutMs = Number.parseInt(rawTimeout.trim(), 10);
    }

    if (!baseUrl) {
      throw new ComputerAgentClientError({
        message:
          "Missing BrainOS backend URL. Set BRAINOS_BACKEND_URL or BRAINOS_API_URL in environment.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (!agentId) {
      throw new ComputerAgentClientError({
        message:
          "Missing Agent ID. Set BRAINOS_AGENT_ID or COMPUTER_AGENT_ID in environment.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (!credential) {
      throw new ComputerAgentClientError({
        message:
          "Missing Agent Credential. Set BRAINOS_AGENT_CREDENTIAL or COMPUTER_AGENT_CREDENTIAL in environment.",
        code: ProtocolErrorCode.UNAUTHORIZED,
        statusCode: 401,
      });
    }

    return new ComputerAgentClient({
      baseUrl,
      agentId,
      credential,
      timeoutMs,
      fetch: customFetch,
    });
  }

  /**
   * Sends a heartbeat / ping message to verify connectivity and agent authentication.
   */
  async ping(
    options?: ComputerAgentClientOptions,
  ): Promise<ComputerAgentResponseEnvelope<{ status: string; receivedAt?: number }>> {
    return this.sendEnvelope<{ ping: boolean }, { status: string; receivedAt?: number }>(
      "ping",
      { ping: true },
      options,
    );
  }

  /**
   * Dispatches a structured action_request to the BrainOS backend.
   */
  async sendAction<TParams = unknown, TResult = unknown>(
    action: ComputerActionName | string,
    params?: TParams,
    options?: ComputerAgentClientOptions,
  ): Promise<ComputerAgentResponseEnvelope<TResult>> {
    if (typeof action !== "string" || action.trim().length === 0) {
      throw new ComputerAgentClientError({
        message: "Action name must be a non-empty string.",
        code: ProtocolErrorCode.ACTION_FAILED,
        statusCode: 400,
      });
    }

    const payload = {
      correlationId: generateEnvelopeId(),
      action: action.trim(),
      ...(params !== undefined ? { params } : {}),
    };

    return this.sendEnvelope<typeof payload, TResult>(
      "action_request",
      payload,
      options,
    );
  }

  /**
   * Polls the BrainOS queue for the next pending action assigned to this agent.
   */
  async pollAction(
    options?: ComputerAgentClientOptions,
  ): Promise<ComputerAgentResponseEnvelope<ActionPollResponseData>> {
    return this.sendEnvelope<ActionPollPayload, ActionPollResponseData>(
      "action_poll",
      {},
      options,
    );
  }

  /**
   * Reports the execution result of a claimed action to the BrainOS backend.
   */
  async reportActionResult(
    payload: ActionResultPayload,
    options?: ComputerAgentClientOptions,
  ): Promise<ComputerAgentResponseEnvelope<ActionResultResponseData>> {
    if (!payload || typeof payload !== "object") {
      throw new ComputerAgentClientError({
        message: "Action result payload is required.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (
      typeof payload.actionId !== "string" ||
      payload.actionId.trim().length === 0
    ) {
      throw new ComputerAgentClientError({
        message: "actionId is required.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (
      typeof payload.correlationId !== "string" ||
      payload.correlationId.trim().length === 0
    ) {
      throw new ComputerAgentClientError({
        message: "correlationId is required.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    if (typeof payload.success !== "boolean") {
      throw new ComputerAgentClientError({
        message: "success must be a boolean.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    return this.sendEnvelope<ActionResultPayload, ActionResultResponseData>(
      "action_result",
      payload,
      options,
    );
  }

  /**
   * Low-level protocol envelope dispatcher.
   * Generates envelope with UUID, version, timestamp, agentId, and transmits over authenticated HTTP.
   */
  async sendEnvelope<TPayload = unknown, TResult = unknown>(
    type: string,
    payload: TPayload,
    options?: ComputerAgentClientOptions,
  ): Promise<ComputerAgentResponseEnvelope<TResult>> {
    if (typeof type !== "string" || type.trim().length === 0) {
      throw new ComputerAgentClientError({
        message: "Envelope type must be a non-empty string.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 400,
      });
    }

    const requestEnvelope: ComputerAgentRequestEnvelope<TPayload> =
      createProtocolRequest<TPayload>({
        type: type.trim(),
        agentId: this.agentId,
        payload,
      });

    const url = `${this.baseUrl}${PROTOCOL_MESSAGES_ENDPOINT}`;
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    let didTimeout = false;

    if (timeoutMs > 0 && timeoutMs !== Number.POSITIVE_INFINITY) {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    const onUserAbort = () => {
      controller.abort(options?.signal?.reason ?? new Error("Operation cancelled by user"));
    };

    if (options?.signal) {
      if (options.signal.aborted) {
        if (timeoutId) clearTimeout(timeoutId);
        throw new ComputerAgentClientError({
          message: "Request aborted before execution.",
          code: "ABORTED",
          statusCode: 499,
        });
      }
      options.signal.addEventListener("abort", onUserAbort, { once: true });
    }

    const headers: Record<string, string> = {
      "x-agent-id": this.agentId,
      "x-agent-credential": this.credential,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.headers ?? {}),
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestEnvelope),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (didTimeout) {
        throw new ComputerAgentClientError({
          message: `Request timed out after ${timeoutMs}ms.`,
          code: ProtocolErrorCode.TIMEOUT,
          statusCode: 408,
          details: { timeoutMs },
        });
      }

      if (options?.signal?.aborted) {
        throw new ComputerAgentClientError({
          message: "Request aborted by user.",
          code: "ABORTED",
          statusCode: 499,
        });
      }

      const rawMsg = err instanceof Error ? err.message : "Network request failed.";
      throw new ComputerAgentClientError({
        message: `Network communication error: ${rawMsg}`,
        code: ProtocolErrorCode.INTERNAL_ERROR,
        statusCode: 500,
        details: { errorName: err instanceof Error ? err.name : "UnknownError" },
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (options?.signal) {
        options.signal.removeEventListener("abort", onUserAbort);
      }
    }

    let parsedBody: unknown;
    try {
      const rawText = await response.text();
      parsedBody = rawText.trim().length > 0 ? JSON.parse(rawText) : null;
    } catch {
      throw new ComputerAgentClientError({
        message: `Invalid JSON response from BrainOS server (HTTP ${response.status}).`,
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: response.status >= 400 ? response.status : 502,
      });
    }

    let validatedEnvelope: ComputerAgentResponseEnvelope<TResult>;
    try {
      validatedEnvelope = validateProtocolResponseEnvelope<TResult>(parsedBody);
    } catch (validationErr: unknown) {
      // If server returned non-2xx status and the body was not a valid envelope
      if (!response.ok) {
        throw new ComputerAgentClientError({
          message: `BrainOS server returned HTTP ${response.status} with non-protocol payload.`,
          code:
            response.status === 401 || response.status === 403
              ? ProtocolErrorCode.UNAUTHORIZED
              : ProtocolErrorCode.INTERNAL_ERROR,
          statusCode: response.status,
          details: parsedBody,
        });
      }

      throw new ComputerAgentClientError({
        message:
          validationErr instanceof Error
            ? validationErr.message
            : "Failed to validate response protocol envelope.",
        code: ProtocolErrorCode.INVALID_ENVELOPE,
        statusCode: 502,
        details: parsedBody,
      });
    }

    // If HTTP error code occurred with a valid error response envelope
    if (!response.ok && !validatedEnvelope.success) {
      throw new ComputerAgentClientError({
        message:
          validatedEnvelope.error?.message ??
          `BrainOS server returned HTTP ${response.status}.`,
        code: validatedEnvelope.error?.code ?? ProtocolErrorCode.INTERNAL_ERROR,
        statusCode: response.status,
        protocolError: validatedEnvelope.error,
      });
    }

    return validatedEnvelope;
  }

  /**
   * Sanitized JSON serialization to prevent secret credential exposure.
   */
  toJSON(): Record<string, unknown> {
    return {
      baseUrl: this.baseUrl,
      agentId: this.agentId,
      credential: "[REDACTED]",
      timeoutMs: this.timeoutMs,
    };
  }

  /**
   * Custom inspect for Node.js console.log / util.inspect.
   */
  [Symbol.for("nodejs.util.inspect.custom")](): Record<string, unknown> {
    return this.toJSON();
  }
}
