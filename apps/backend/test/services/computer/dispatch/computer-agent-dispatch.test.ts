import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolAuditService } from "../../../../src/services/security/tool-audit.service";
import { ProtocolErrorCode } from "../../../../src/services/computer/protocol";
import {
  ALL_COMPUTER_ACTION_NAMES,
  ComputerActionName,
  isComputerActionName,
  ComputerAgentActionAuthorizer,
  ComputerAgentActionContext,
  ComputerAgentActionDispatcher,
  ComputerAgentActionException,
  createActionErrorResponse,
  createActionRequest,
  createActionSuccessResponse,
  DefaultComputerAgentActionDispatcher,
  generateCorrelationId,
  InMemoryComputerActionPermissionProvider,
} from "../../../../src/services/computer/dispatch";

describe("Computer Agent Action Authorization / Dispatch Contract", () => {
  describe("Typed Computer Action Names", () => {
    it("defines the standard set of computer action names", () => {
      expect(ComputerActionName.GET_STATUS).toBe("computer_get_status");
      expect(ComputerActionName.LIST_APPLICATIONS).toBe(
        "computer_list_applications",
      );
      expect(ComputerActionName.LIST_FILES).toBe("computer_list_files");
      expect(ComputerActionName.READ_FILE).toBe("computer_read_file");
      expect(ComputerActionName.LAUNCH_APPLICATION).toBe(
        "computer_launch_application",
      );
      expect(ComputerActionName.WRITE_FILE).toBe("computer_write_file");
    });

    it("verifies isComputerActionName predicate accurately", () => {
      for (const name of ALL_COMPUTER_ACTION_NAMES) {
        expect(isComputerActionName(name)).toBe(true);
      }
      expect(isComputerActionName("invalid_action")).toBe(false);
      expect(isComputerActionName("")).toBe(false);
      expect(isComputerActionName(null)).toBe(false);
      expect(isComputerActionName(undefined)).toBe(false);
    });
  });

  describe("ComputerAgentActionAuthorizer", () => {
    let mockAuditService: ToolAuditService;
    let authorizer: ComputerAgentActionAuthorizer;
    let mockTime: number;

    const VALID_CONTEXT: ComputerAgentActionContext = {
      agentId: "agent-007",
      userId: "user-456",
    };

    beforeEach(() => {
      mockTime = 1_700_000_000_000;
      mockAuditService = {
        record: vi.fn(),
      } as unknown as ToolAuditService;

      authorizer = new ComputerAgentActionAuthorizer({
        auditService: mockAuditService,
        clock: () => mockTime,
      });
    });

    it("fails closed when context or userId is missing", async () => {
      const decisionNoContext = await authorizer.authorize(
        ComputerActionName.GET_STATUS,
        null as unknown as ComputerAgentActionContext,
      );
      expect(decisionNoContext.authorized).toBe(false);
      expect(decisionNoContext.status).toBe("UNAUTHORIZED");
      expect(decisionNoContext.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);

      const decisionNoUser = await authorizer.authorize(
        ComputerActionName.GET_STATUS,
        { agentId: "agent-1", userId: "" },
      );
      expect(decisionNoUser.authorized).toBe(false);
      expect(decisionNoUser.status).toBe("UNAUTHORIZED");
      expect(decisionNoUser.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
    });

    it("fails closed when agentId is missing in context", async () => {
      const decision = await authorizer.authorize(
        ComputerActionName.GET_STATUS,
        { agentId: "", userId: "user-123" },
      );
      expect(decision.authorized).toBe(false);
      expect(decision.status).toBe("UNAUTHORIZED");
      expect(decision.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
    });

    it("fails closed on empty or invalid action name", async () => {
      const decision = await authorizer.authorize("", VALID_CONTEXT);
      expect(decision.authorized).toBe(false);
      expect(decision.status).toBe("UNAUTHORIZED");
      expect(decision.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
    });

    it("fails closed for unknown / non-computer actions", async () => {
      const decision = await authorizer.authorize(
        "format_hard_drive",
        VALID_CONTEXT,
      );
      expect(decision.authorized).toBe(false);
      expect(decision.status).toBe("UNAUTHORIZED");
      expect(decision.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
    });

    it("automatically authorizes read-only computer actions without explicit permissions", async () => {
      const readOnlyActions = [
        ComputerActionName.GET_STATUS,
        ComputerActionName.LIST_APPLICATIONS,
        ComputerActionName.LIST_FILES,
        ComputerActionName.READ_FILE,
      ];

      for (const action of readOnlyActions) {
        const decision = await authorizer.authorize(action, VALID_CONTEXT);
        expect(decision.authorized).toBe(true);
        expect(decision.status).toBe("AUTHORIZED");
        expect(decision.risk).toBe("READ_ONLY");
        expect(decision.authorizationRequired).toBe(false);
      }

      // No unauthorized audit record emitted
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });

    it("rejects privileged actions by default when no trusted server grant exists", async () => {
      const privilegedActions = [
        ComputerActionName.WRITE_FILE,
        ComputerActionName.LAUNCH_APPLICATION,
      ];

      for (const action of privilegedActions) {
        const decision = await authorizer.authorize(action, VALID_CONTEXT);
        expect(decision.authorized).toBe(false);
        expect(decision.status).toBe("UNAUTHORIZED");
        expect(decision.risk).toBe("ACTION");
        expect(decision.authorizationRequired).toBe(true);
        expect(decision.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      }

      // Preserves existing audit behavior by logging unauthorized attempts
      expect(mockAuditService.record).toHaveBeenCalledTimes(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: ComputerActionName.WRITE_FILE,
          userId: VALID_CONTEXT.userId,
          outcome: "UNAUTHORIZED",
          computerTool: true,
          authorizationRequired: true,
        }),
      );
    });

    it("SECURITY: rejects client-supplied permissions attempted via context injection", async () => {
      // Attempt to tamper by supplying permissions in context
      const spoofedContext = {
        ...VALID_CONTEXT,
        authorizedActions: [
          ComputerActionName.WRITE_FILE,
          ComputerActionName.LAUNCH_APPLICATION,
        ],
      } as unknown as ComputerAgentActionContext;

      const decision = await authorizer.authorize(
        ComputerActionName.WRITE_FILE,
        spoofedContext,
      );

      // Must remain UNAUTHORIZED: permissions cannot be self-granted by client or context
      expect(decision.authorized).toBe(false);
      expect(decision.status).toBe("UNAUTHORIZED");
      expect(decision.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
    });

    it("authorizes privileged action tools when explicitly granted by trusted server permission provider", async () => {
      const trustedProvider = new InMemoryComputerActionPermissionProvider();
      trustedProvider.grant(VALID_CONTEXT.agentId, ComputerActionName.WRITE_FILE);

      const serverAuthorizedAuthorizer = new ComputerAgentActionAuthorizer({
        permissionProvider: trustedProvider,
        auditService: mockAuditService,
        clock: () => mockTime,
      });

      const decision = await serverAuthorizedAuthorizer.authorize(
        ComputerActionName.WRITE_FILE,
        VALID_CONTEXT,
      );

      expect(decision.authorized).toBe(true);
      expect(decision.status).toBe("AUTHORIZED");
      expect(decision.risk).toBe("ACTION");
      expect(decision.authorizationRequired).toBe(true);
      expect(mockAuditService.record).not.toHaveBeenCalled();
    });
  });

  describe("Action Request & Response Helpers", () => {
    it("creates an action request with correlationId and timestamp", () => {
      const req = createActionRequest({
        action: ComputerActionName.GET_STATUS,
        params: { verbose: true },
      });

      expect(typeof req.correlationId).toBe("string");
      expect(req.correlationId.length).toBeGreaterThan(0);
      expect(req.action).toBe(ComputerActionName.GET_STATUS);
      expect(req.params).toEqual({ verbose: true });
      expect(typeof req.timestamp).toBe("number");
    });

    it("throws ComputerAgentActionException when action is missing", () => {
      expect(() =>
        createActionRequest({ action: "" }),
      ).toThrowError(ComputerAgentActionException);
    });

    it("creates a successful response preserving correlationId", () => {
      const correlationId = generateCorrelationId();
      const res = createActionSuccessResponse({
        correlationId,
        action: ComputerActionName.GET_STATUS,
        data: { status: "ONLINE" },
      });

      expect(res.correlationId).toBe(correlationId);
      expect(res.action).toBe(ComputerActionName.GET_STATUS);
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ status: "ONLINE" });
      expect(res.error).toBeUndefined();
    });

    it("creates an error response preserving correlationId", () => {
      const correlationId = generateCorrelationId();
      const res = createActionErrorResponse({
        correlationId,
        action: ComputerActionName.WRITE_FILE,
        error: {
          code: ProtocolErrorCode.UNAUTHORIZED,
          message: "Write denied.",
        },
      });

      expect(res.correlationId).toBe(correlationId);
      expect(res.action).toBe(ComputerActionName.WRITE_FILE);
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      expect(res.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(res.error?.message).toBe("Write denied.");
    });
  });

  describe("DefaultComputerAgentActionDispatcher", () => {
    let mockAuditService: ToolAuditService;
    let authorizer: ComputerAgentActionAuthorizer;
    let mockTime: number;

    const VALID_CONTEXT: ComputerAgentActionContext = {
      agentId: "agent-alpha",
      userId: "user-alpha-owner",
    };

    beforeEach(() => {
      mockTime = 1_700_000_000_000;
      mockAuditService = {
        record: vi.fn(),
      } as unknown as ToolAuditService;

      authorizer = new ComputerAgentActionAuthorizer({
        auditService: mockAuditService,
        clock: () => mockTime,
      });
    });

    it("rejects malformed requests with missing correlationId", async () => {
      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        clock: () => mockTime,
      });

      const response = await dispatcher.dispatch(
        { correlationId: "", action: ComputerActionName.GET_STATUS },
        VALID_CONTEXT,
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ProtocolErrorCode.INVALID_ENVELOPE);
    });

    it("rejects requests when action is unauthorized and returns structured error with correlationId", async () => {
      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        clock: () => mockTime,
      });

      const req = createActionRequest({
        action: ComputerActionName.WRITE_FILE,
        params: { path: "secret.txt", content: "hello" },
        correlationId: "corr-unauth-123",
      });

      const response = await dispatcher.dispatch(req, VALID_CONTEXT);

      expect(response.success).toBe(false);
      expect(response.correlationId).toBe("corr-unauth-123");
      expect(response.action).toBe(ComputerActionName.WRITE_FILE);
      expect(response.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(response.error?.message).toContain("requires authorization");
    });

    it("SECURITY: ensures handler is never executed if authorization fails", async () => {
      const mockHandler = {
        execute: vi.fn(),
      };

      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        handler: mockHandler,
        clock: () => mockTime,
      });

      // Attempt to self-grant permissions inside request params
      const req = createActionRequest({
        action: ComputerActionName.WRITE_FILE,
        params: {
          path: "critical.txt",
          content: "exploit",
          authorizedActions: [ComputerActionName.WRITE_FILE],
        },
        correlationId: "corr-self-grant-fail",
      });

      const response = await dispatcher.dispatch(req, VALID_CONTEXT);

      // Handler was never invoked
      expect(mockHandler.execute).not.toHaveBeenCalled();
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
    });

    it("fails closed with ACTION_FAILED when authorized but no handler is registered (contract only)", async () => {
      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        clock: () => mockTime,
      });

      const req = createActionRequest({
        action: ComputerActionName.GET_STATUS,
        correlationId: "corr-contract-456",
      });

      const response = await dispatcher.dispatch(req, VALID_CONTEXT);

      // Contract milestone verification: does NOT execute actions without an explicit handler
      expect(response.success).toBe(false);
      expect(response.correlationId).toBe("corr-contract-456");
      expect(response.action).toBe(ComputerActionName.GET_STATUS);
      expect(response.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
      expect(response.error?.message).toContain("no action execution handler is bound");
    });

    it("delegates to an injected ComputerActionHandler when authorized by server", async () => {
      const trustedProvider = new InMemoryComputerActionPermissionProvider();
      trustedProvider.grant(VALID_CONTEXT.agentId, ComputerActionName.WRITE_FILE);

      const serverAuthorizer = new ComputerAgentActionAuthorizer({
        permissionProvider: trustedProvider,
        auditService: mockAuditService,
        clock: () => mockTime,
      });

      const mockHandler = {
        execute: vi.fn().mockResolvedValue({ written: true, bytes: 42 }),
      };

      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer: serverAuthorizer,
        handler: mockHandler,
        clock: () => mockTime,
      });

      const req = createActionRequest({
        action: ComputerActionName.WRITE_FILE,
        params: { path: "allowed.txt", content: "data" },
        correlationId: "corr-handler-789",
      });

      const response = await dispatcher.dispatch(req, VALID_CONTEXT);

      expect(response.success).toBe(true);
      expect(response.correlationId).toBe("corr-handler-789");
      expect(response.action).toBe(ComputerActionName.WRITE_FILE);
      expect(response.data).toEqual({ written: true, bytes: 42 });
      expect(mockHandler.execute).toHaveBeenCalledWith(
        ComputerActionName.WRITE_FILE,
        { path: "allowed.txt", content: "data" },
        VALID_CONTEXT,
      );
    });

    it("captures handler exceptions and returns structured ACTION_FAILED response", async () => {
      const mockHandler = {
        execute: vi.fn().mockRejectedValue(new Error("Subsystem timeout")),
      };

      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        handler: mockHandler,
        clock: () => mockTime,
      });

      const req = createActionRequest({
        action: ComputerActionName.GET_STATUS,
        correlationId: "corr-err-999",
      });

      const response = await dispatcher.dispatch(req, VALID_CONTEXT);

      expect(response.success).toBe(false);
      expect(response.correlationId).toBe("corr-err-999");
      expect(response.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
      expect(response.error?.message).toBe("Subsystem timeout");
    });
  });
});
