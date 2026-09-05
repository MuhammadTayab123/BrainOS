import { describe, expect, it } from "vitest";
import { AppError } from "../../../../src/errors";
import {
  COMPUTER_AGENT_PROTOCOL_VERSION,
  ComputerAgentAuthContext,
  ComputerAgentAuthRequest,
  ComputerAgentIdentity,
  ComputerAgentProtocolException,
  createProtocolErrorResponse,
  createProtocolRequest,
  createProtocolSuccessResponse,
  generateEnvelopeId,
  isSupportedProtocolVersion,
  ProtocolErrorCode,
  SUPPORTED_PROTOCOL_VERSIONS,
  validateProtocolRequestEnvelope,
  validateProtocolResponseEnvelope,
} from "../../../../src/services/computer/protocol";

describe("Computer Agent Protocol Contract", () => {
  describe("Protocol Versioning", () => {
    it("exports default protocol version 1.0", () => {
      expect(COMPUTER_AGENT_PROTOCOL_VERSION).toBe("1.0");
      expect(SUPPORTED_PROTOCOL_VERSIONS).toContain("1.0");
    });

    it("identifies supported and unsupported protocol versions", () => {
      expect(isSupportedProtocolVersion("1.0")).toBe(true);
      expect(isSupportedProtocolVersion(" 1.0 ")).toBe(true);
      expect(isSupportedProtocolVersion("2.0")).toBe(false);
      expect(isSupportedProtocolVersion("")).toBe(false);
      expect(isSupportedProtocolVersion(null)).toBe(false);
      expect(isSupportedProtocolVersion(undefined)).toBe(false);
    });
  });

  describe("Agent Identity and Authentication Contracts", () => {
    it("conforms to agent identity contract without agent-supplied userId", () => {
      const identity: ComputerAgentIdentity = {
        agentId: "agent-workstation-1",
        name: "Home Office Studio",
        platform: "win32",
        architecture: "x64",
        version: "0.1.0",
      };

      expect(identity.agentId).toBe("agent-workstation-1");
      expect((identity as any).userId).toBeUndefined();
      expect(identity.platform).toBe("win32");
    });

    it("conforms to authentication request and context contracts", () => {
      const authReq: ComputerAgentAuthRequest = {
        agentId: "agent-workstation-1",
        credential: "secret-token-12345",
        timestamp: Date.now(),
      };

      const authCtx: ComputerAgentAuthContext = {
        authenticated: true,
        agentId: authReq.agentId,
        userId: "user-alpha",
        authenticatedAt: new Date(),
      };

      expect(authReq.agentId).toBe("agent-workstation-1");
      expect(authCtx.authenticated).toBe(true);
      expect(authCtx.userId).toBe("user-alpha");
    });

    it("generic protocol envelopes do not require or expose raw credentials", () => {
      const req = createProtocolRequest({
        type: "execute_action",
        agentId: "agent-workstation-1",
        payload: { action: "list_files" },
      });

      expect((req as any).credential).toBeUndefined();
      expect((req.payload as any).credential).toBeUndefined();
    });
  });

  describe("Structured Protocol Errors", () => {
    it("creates protocol exception extending AppError with details", () => {
      const err = new ComputerAgentProtocolException({
        message: "Agent is currently offline or unreachable.",
        code: ProtocolErrorCode.AGENT_INACTIVE,
        statusCode: 400,
        details: { agentId: "agent-123", retryAfterMs: 5000 },
      });

      expect(err).toBeInstanceOf(AppError);
      expect(err.name).toBe("ComputerAgentProtocolException");
      expect(err.code).toBe("AGENT_INACTIVE");
      expect(err.statusCode).toBe(400);
      expect(err.details).toEqual({
        agentId: "agent-123",
        retryAfterMs: 5000,
      });

      const protoError = err.toProtocolError();
      expect(protoError).toEqual({
        code: "AGENT_INACTIVE",
        message: "Agent is currently offline or unreachable.",
        details: { agentId: "agent-123", retryAfterMs: 5000 },
      });
    });

    it("supports protocol error codes enumeration", () => {
      expect(ProtocolErrorCode.INVALID_PROTOCOL_VERSION).toBe("INVALID_PROTOCOL_VERSION");
      expect(ProtocolErrorCode.INVALID_ENVELOPE).toBe("INVALID_ENVELOPE");
      expect(ProtocolErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
      expect(ProtocolErrorCode.AGENT_NOT_FOUND).toBe("AGENT_NOT_FOUND");
      expect(ProtocolErrorCode.AGENT_INACTIVE).toBe("AGENT_INACTIVE");
      expect(ProtocolErrorCode.ACTION_FAILED).toBe("ACTION_FAILED");
      expect(ProtocolErrorCode.TIMEOUT).toBe("TIMEOUT");
      expect(ProtocolErrorCode.PROTOCOL_ERROR).toBe("PROTOCOL_ERROR");
      expect(ProtocolErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    });
  });

  describe("Request Envelopes", () => {
    it("creates a well-formed request envelope", () => {
      const req = createProtocolRequest({
        type: "ping",
        agentId: "agent-1",
        payload: { message: "hello" },
      });

      expect(typeof req.id).toBe("string");
      expect(req.id.length).toBeGreaterThan(0);
      expect(req.version).toBe(COMPUTER_AGENT_PROTOCOL_VERSION);
      expect(req.type).toBe("ping");
      expect(req.agentId).toBe("agent-1");
      expect(req.payload).toEqual({ message: "hello" });
      expect(typeof req.timestamp).toBe("number");
    });

    it("rejects invalid inputs on request creation", () => {
      expect(() =>
        createProtocolRequest({
          type: "",
          agentId: "agent-1",
          payload: null,
        }),
      ).toThrow(ComputerAgentProtocolException);

      expect(() =>
        createProtocolRequest({
          type: "action",
          agentId: "   ",
          payload: null,
        }),
      ).toThrow(ComputerAgentProtocolException);
    });

    it("validates valid request envelope", () => {
      const valid = {
        id: "msg-123",
        version: "1.0",
        type: "execute_action",
        agentId: "agent-1",
        timestamp: Date.now(),
        payload: { command: "test" },
      };

      const parsed = validateProtocolRequestEnvelope(valid);
      expect(parsed).toEqual(valid);
    });

    it("rejects invalid request envelopes during validation", () => {
      expect(() => validateProtocolRequestEnvelope(null)).toThrow(
        "Request envelope must be a valid JSON object.",
      );
      expect(() => validateProtocolRequestEnvelope([])).toThrow(
        "Request envelope must be a valid JSON object.",
      );
      expect(() =>
        validateProtocolRequestEnvelope({
          id: "",
          version: "1.0",
          type: "action",
          agentId: "agent-1",
          timestamp: Date.now(),
          payload: {},
        }),
      ).toThrow("Request envelope id must be a non-empty string.");

      expect(() =>
        validateProtocolRequestEnvelope({
          id: "1",
          version: "99.0",
          type: "action",
          agentId: "agent-1",
          timestamp: Date.now(),
          payload: {},
        }),
      ).toThrow("Unsupported protocol version: 99.0");

      expect(() =>
        validateProtocolRequestEnvelope({
          id: "1",
          version: "1.0",
          type: "",
          agentId: "agent-1",
          timestamp: Date.now(),
          payload: {},
        }),
      ).toThrow("Request envelope type must be a non-empty string.");

      expect(() =>
        validateProtocolRequestEnvelope({
          id: "1",
          version: "1.0",
          type: "action",
          agentId: "  ",
          timestamp: Date.now(),
          payload: {},
        }),
      ).toThrow("Request envelope agentId must be a non-empty string.");

      expect(() =>
        validateProtocolRequestEnvelope({
          id: "1",
          version: "1.0",
          type: "action",
          agentId: "agent-1",
          timestamp: "invalid-timestamp",
          payload: {},
        }),
      ).toThrow("Request envelope timestamp must be a valid numeric timestamp.");

      expect(() =>
        validateProtocolRequestEnvelope({
          id: "1",
          version: "1.0",
          type: "action",
          agentId: "agent-1",
          timestamp: Date.now(),
        }),
      ).toThrow("Request envelope payload is required.");
    });
  });

  describe("Response Envelopes", () => {
    it("creates a well-formed success response envelope", () => {
      const res = createProtocolSuccessResponse({
        id: "req-456",
        data: { status: "OK", latencyMs: 12 },
      });

      expect(res).toEqual({
        id: "req-456",
        version: "1.0",
        success: true,
        timestamp: expect.any(Number),
        data: { status: "OK", latencyMs: 12 },
      });
    });

    it("creates a well-formed error response envelope from protocol exception", () => {
      const exception = new ComputerAgentProtocolException({
        message: "Invalid credentials supplied for agent.",
        code: ProtocolErrorCode.UNAUTHORIZED,
        details: { reason: "Bad secret" },
      });

      const res = createProtocolErrorResponse({
        id: "req-456",
        error: exception,
      });

      expect(res).toEqual({
        id: "req-456",
        version: "1.0",
        success: false,
        timestamp: expect.any(Number),
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid credentials supplied for agent.",
          details: { reason: "Bad secret" },
        },
      });
    });

    it("creates a well-formed error response envelope from plain object", () => {
      const res = createProtocolErrorResponse({
        id: "req-456",
        error: {
          code: ProtocolErrorCode.TIMEOUT,
          message: "Agent timed out responding to ping.",
        },
      });

      expect(res).toEqual({
        id: "req-456",
        version: "1.0",
        success: false,
        timestamp: expect.any(Number),
        error: {
          code: "TIMEOUT",
          message: "Agent timed out responding to ping.",
        },
      });
    });

    it("validates valid success and error response envelopes", () => {
      const successEnv = {
        id: "req-1",
        version: "1.0",
        success: true,
        timestamp: Date.now(),
        data: { value: 42 },
      };

      expect(validateProtocolResponseEnvelope(successEnv)).toEqual(successEnv);

      const errorEnv = {
        id: "req-2",
        version: "1.0",
        success: false,
        timestamp: Date.now(),
        error: {
          code: "INTERNAL_ERROR",
          message: "Something broke.",
        },
      };

      expect(validateProtocolResponseEnvelope(errorEnv)).toEqual(errorEnv);
    });

    it("rejects invalid response envelopes during validation", () => {
      expect(() => validateProtocolResponseEnvelope(null)).toThrow(
        "Response envelope must be a valid JSON object.",
      );

      expect(() =>
        validateProtocolResponseEnvelope({
          id: "",
          version: "1.0",
          success: true,
          timestamp: Date.now(),
        }),
      ).toThrow("Response envelope id must be a non-empty string.");

      expect(() =>
        validateProtocolResponseEnvelope({
          id: "req-1",
          version: "invalid",
          success: true,
          timestamp: Date.now(),
        }),
      ).toThrow("Unsupported protocol version: invalid");

      expect(() =>
        validateProtocolResponseEnvelope({
          id: "req-1",
          version: "1.0",
          success: "true",
          timestamp: Date.now(),
        }),
      ).toThrow("Response envelope success must be a boolean.");

      expect(() =>
        validateProtocolResponseEnvelope({
          id: "req-1",
          version: "1.0",
          success: false,
          timestamp: Date.now(),
        }),
      ).toThrow("Error response envelope must include a structured error object.");
    });
  });

  describe("Correlation ID Generator", () => {
    it("generates random valid UUIDs", () => {
      const id1 = generateEnvelopeId();
      const id2 = generateEnvelopeId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
      );
    });
  });
});
