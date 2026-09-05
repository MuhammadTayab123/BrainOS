import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),

  getAuth: () => ({
    userId: "test-clerk-user",
    sessionId: "test-session",
    isAuthenticated: true,
  }),
}));

import app from "../../../../src/app";
import {
  COMPUTER_AGENT_PROTOCOL_VERSION,
  createProtocolRequest,
  ProtocolErrorCode,
} from "../../../../src/services/computer/protocol";
import {
  ComputerActionName,
  ComputerAgentActionAuthorizer,
  ComputerAgentActionContext,
  ComputerAgentActionDispatcher,
  ComputerActionHandler,
  DefaultComputerAgentActionDispatcher,
  InMemoryComputerActionPermissionProvider,
} from "../../../../src/services/computer/dispatch";
import {
  ComputerAgentAuthenticator,
  ComputerAgentHttpTransportService,
  InMemoryEnvelopeReplayGuard,
} from "../../../../src/services/computer/transport";
import { setComputerAgentHttpTransportService } from "../../../../src/controllers/computer-agent/computer-agent.controller";

describe("Computer Agent HTTP Transport", () => {
  describe("InMemoryEnvelopeReplayGuard", () => {
    it("atomically records unseen envelope ID and reports true", () => {
      const guard = new InMemoryEnvelopeReplayGuard();
      expect(guard.checkAndRecord("env-1", Date.now())).toBe(true);
      expect(guard.hasBeenSeen("env-1")).toBe(true);
      expect(guard.hasBeenSeen("env-2")).toBe(false);
    });

    it("rejects duplicate envelope ID on second checkAndRecord call", () => {
      const guard = new InMemoryEnvelopeReplayGuard();
      expect(guard.checkAndRecord("env-1", Date.now())).toBe(true);
      expect(guard.checkAndRecord("env-1", Date.now())).toBe(false);
    });

    it("atomically allows only one caller to succeed under concurrent checkAndRecord race", async () => {
      const guard = new InMemoryEnvelopeReplayGuard();
      const results = await Promise.all([
        Promise.resolve().then(() => guard.checkAndRecord("env-race", Date.now())),
        Promise.resolve().then(() => guard.checkAndRecord("env-race", Date.now())),
      ]);

      expect(results.filter((res) => res === true)).toHaveLength(1);
      expect(results.filter((res) => res === false)).toHaveLength(1);
    });

    it("expires seen envelope IDs after ttlMs has passed and allows re-recording", () => {
      let currentTime = 1_000_000;
      const guard = new InMemoryEnvelopeReplayGuard({
        ttlMs: 5_000,
        clock: () => currentTime,
      });

      expect(guard.checkAndRecord("env-1", currentTime)).toBe(true);
      expect(guard.checkAndRecord("env-1", currentTime)).toBe(false);

      currentTime += 5_001;
      expect(guard.hasBeenSeen("env-1")).toBe(false);
      expect(guard.checkAndRecord("env-1", currentTime)).toBe(true);
    });

    it("prunes expired entries", () => {
      let currentTime = 1_000_000;
      const guard = new InMemoryEnvelopeReplayGuard({
        ttlMs: 2_000,
        clock: () => currentTime,
      });

      guard.checkAndRecord("env-1", currentTime);
      currentTime += 1_000;
      guard.checkAndRecord("env-2", currentTime);

      expect(guard.size).toBe(2);

      currentTime += 1_001; // env-1 is expired (> 2000 ms), env-2 is active
      guard.prune();

      expect(guard.size).toBe(1);
      expect(guard.hasBeenSeen("env-1")).toBe(false);
      expect(guard.hasBeenSeen("env-2")).toBe(true);
    });

    it("evicts oldest entry when reaching maxEntries capacity", () => {
      const guard = new InMemoryEnvelopeReplayGuard({
        maxEntries: 2,
        ttlMs: 100_000,
      });

      guard.checkAndRecord("env-1", Date.now());
      guard.checkAndRecord("env-2", Date.now());
      expect(guard.size).toBe(2);

      guard.checkAndRecord("env-3", Date.now());
      expect(guard.size).toBe(2);
      expect(guard.hasBeenSeen("env-1")).toBe(false); // env-1 evicted
      expect(guard.hasBeenSeen("env-2")).toBe(true);
      expect(guard.hasBeenSeen("env-3")).toBe(true);
    });
  });

  describe("ComputerAgentHttpTransportService Unit Tests", () => {
    let mockAuthenticator: ComputerAgentAuthenticator;
    let replayGuard: InMemoryEnvelopeReplayGuard;
    let transportService: ComputerAgentHttpTransportService;
    let mockTime: number;

    const VALID_AGENT_ID = "agent_01j7abc";
    const VALID_CREDENTIAL = "secret_credential_123";
    const SERVER_USER_ID = "user_owner_456";

    beforeEach(() => {
      mockTime = 1_700_000_000_000;

      mockAuthenticator = {
        authenticate: vi.fn(async (agentId: string, credential: string) => {
          if (
            agentId === VALID_AGENT_ID &&
            credential === VALID_CREDENTIAL
          ) {
            return {
              authenticated: true,
              agentId: VALID_AGENT_ID,
              userId: SERVER_USER_ID,
              authenticatedAt: new Date(mockTime),
            };
          }
          return null;
        }),
      };

      replayGuard = new InMemoryEnvelopeReplayGuard({
        ttlMs: 120_000,
        clock: () => mockTime,
      });

      transportService = new ComputerAgentHttpTransportService({
        authenticator: mockAuthenticator,
        replayGuard,
        clock: () => mockTime,
        maxDriftMs: 60_000,
      });
    });

    it("fails with 401 when x-agent-id header is missing or empty", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: { test: true },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        { credential: VALID_CREDENTIAL },
        envelope,
      );

      expect(result.statusCode).toBe(401);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(result.envelope.error?.message).toBe("Invalid agent credentials.");
    });

    it("fails with 401 when x-agent-credential header is missing or empty", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: { test: true },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID },
        envelope,
      );

      expect(result.statusCode).toBe(401);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(result.envelope.error?.message).toBe("Invalid agent credentials.");
    });

    it("fails with 401 and generic message when credentials are invalid", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: { test: true },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        {
          agentId: VALID_AGENT_ID,
          credential: "wrong_password",
        },
        envelope,
      );

      expect(result.statusCode).toBe(401);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(result.envelope.error?.message).toBe("Invalid agent credentials.");
    });

    it("fails with 401 when agent is unknown or unauthenticated", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: "unknown_agent",
        payload: { test: true },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        {
          agentId: "unknown_agent",
          credential: VALID_CREDENTIAL,
        },
        envelope,
      );

      expect(result.statusCode).toBe(401);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(result.envelope.error?.message).toBe("Invalid agent credentials.");
    });

    it("fails closed with 401 when authenticator throws unexpectedly", async () => {
      const brokenAuthService = new ComputerAgentHttpTransportService({
        authenticator: {
          authenticate: vi.fn().mockRejectedValue(new Error("Database disconnected")),
        },
        replayGuard,
        clock: () => mockTime,
      });

      const envelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: {},
        timestamp: mockTime,
      });

      const result = await brokenAuthService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        envelope,
      );

      expect(result.statusCode).toBe(401);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(result.envelope.error?.message).toBe("Invalid agent credentials.");
    });

    it("fails with 400 when request body is not a valid envelope", async () => {
      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        { notAnEnvelope: true },
      );

      expect(result.statusCode).toBe(400);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.INVALID_ENVELOPE);
    });

    it("fails with 400 when envelope has unsupported protocol version", async () => {
      const invalidVersionEnvelope = {
        id: "env-test-id",
        version: "99.0",
        type: "ping",
        agentId: VALID_AGENT_ID,
        timestamp: mockTime,
        payload: {},
      };

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        invalidVersionEnvelope,
      );

      expect(result.statusCode).toBe(400);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(
        ProtocolErrorCode.INVALID_PROTOCOL_VERSION,
      );
    });

    it("fails with 403 when envelope agentId does not match authenticated credential", async () => {
      const mismatchedEnvelope = createProtocolRequest({
        type: "ping",
        agentId: "agent_impersonator_999",
        payload: { attempt: "spoof" },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        mismatchedEnvelope,
      );

      expect(result.statusCode).toBe(403);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(result.envelope.error?.message).toBe("Agent identity mismatch.");
    });

    it("fails with 400 when timestamp is older than maxDriftMs (drift in the past)", async () => {
      const staleEnvelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: {},
        timestamp: mockTime - 60_001, // 60.001 seconds ago
      });

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        staleEnvelope,
      );

      expect(result.statusCode).toBe(400);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.PROTOCOL_ERROR);
      expect(result.envelope.error?.message).toBe(
        "Message timestamp outside acceptable window.",
      );
    });

    it("fails with 400 when timestamp is ahead of maxDriftMs (drift in the future)", async () => {
      const futureEnvelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: {},
        timestamp: mockTime + 60_001, // 60.001 seconds in future
      });

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        futureEnvelope,
      );

      expect(result.statusCode).toBe(400);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.PROTOCOL_ERROR);
      expect(result.envelope.error?.message).toBe(
        "Message timestamp outside acceptable window.",
      );
    });

    it("succeeds with 200 OK and safe protocol acknowledgement for valid message", async () => {
      const validEnvelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: { command: "hello" },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        validEnvelope,
      );

      expect(result.statusCode).toBe(200);
      expect(result.envelope.success).toBe(true);
      expect(result.envelope.id).toBe(validEnvelope.id);
      expect(result.envelope.version).toBe(COMPUTER_AGENT_PROTOCOL_VERSION);
      expect(result.envelope.timestamp).toBe(mockTime);
      expect(result.envelope.data).toEqual({
        status: "acknowledged",
        receivedAt: mockTime,
      });
      // Crucial: preserve protocol contract without ad-hoc requestId property
      expect("requestId" in result.envelope).toBe(false);
    });

    it("detects replay and rejects duplicate envelope ID with 409 Conflict", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: { nonce: "once" },
        timestamp: mockTime,
      });

      // First submission passes
      const firstResult = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        envelope,
      );
      expect(firstResult.statusCode).toBe(200);

      // Replay submission fails
      const secondResult = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        envelope,
      );
      expect(secondResult.statusCode).toBe(409);
      expect(secondResult.envelope.success).toBe(false);
      expect(secondResult.envelope.error?.code).toBe(
        ProtocolErrorCode.PROTOCOL_ERROR,
      );
      expect(secondResult.envelope.error?.message).toBe(
        "Duplicate envelope ID rejected.",
      );
    });

    it("does NOT record envelope ID if authentication fails", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: {},
        timestamp: mockTime,
      });

      await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: "bad_credential" },
        envelope,
      );

      expect(replayGuard.hasBeenSeen(envelope.id)).toBe(false);
    });

    it("does NOT record envelope ID if timestamp validation fails", async () => {
      const expiredEnvelope = createProtocolRequest({
        type: "ping",
        agentId: VALID_AGENT_ID,
        payload: {},
        timestamp: mockTime - 999_999,
      });

      await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        expiredEnvelope,
      );

      expect(replayGuard.hasBeenSeen(expiredEnvelope.id)).toBe(false);
    });

    it("does NOT invoke ComputerAgentGateway, tools, shell, or filesystem", async () => {
      const validEnvelope = createProtocolRequest({
        type: "execute_action",
        agentId: VALID_AGENT_ID,
        payload: { action: "mouse_click", x: 100, y: 200 },
        timestamp: mockTime,
      });

      const result = await transportService.handleIncomingMessage(
        { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
        validEnvelope,
      );

      expect(result.statusCode).toBe(200);
      // Result is strictly an ingress acknowledgement, not action execution output
      expect(result.envelope.data).toEqual({
        status: "acknowledged",
        receivedAt: mockTime,
      });
    });

    describe("Action Request Dispatch Pipeline", () => {
      let permissionProvider: InMemoryComputerActionPermissionProvider;
      let authorizer: ComputerAgentActionAuthorizer;
      let mockHandler: ComputerActionHandler;
      let dispatcher: DefaultComputerAgentActionDispatcher;
      let dispatchTransportService: ComputerAgentHttpTransportService;

      beforeEach(() => {
        permissionProvider = new InMemoryComputerActionPermissionProvider();
        authorizer = new ComputerAgentActionAuthorizer({
          permissionProvider,
          clock: () => mockTime,
        });
        mockHandler = {
          execute: vi.fn(async (action: string, _params: unknown) => {
            if (action === ComputerActionName.GET_STATUS) {
              return { status: "ONLINE", platform: "win32" };
            }
            if (action === ComputerActionName.WRITE_FILE) {
              return { written: true, bytes: 12 };
            }
            return { ok: true };
          }),
        };
        dispatcher = new DefaultComputerAgentActionDispatcher({
          authorizer,
          handler: mockHandler,
          clock: () => mockTime,
        });
        dispatchTransportService = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          dispatcher,
          clock: () => mockTime,
          maxDriftMs: 60_000,
        });
      });

      it("authorized read-only action executes successfully", async () => {
        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: { action: ComputerActionName.GET_STATUS },
          timestamp: mockTime,
        });

        const result = await dispatchTransportService.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(result.statusCode).toBe(200);
        expect(result.envelope.success).toBe(true);
        expect(result.envelope.id).toBe(envelope.id);
        expect(result.envelope.data).toEqual({
          status: "ONLINE",
          platform: "win32",
        });
        expect(mockHandler.execute).toHaveBeenCalledWith(
          ComputerActionName.GET_STATUS,
          undefined,
          { agentId: VALID_AGENT_ID, userId: SERVER_USER_ID },
        );
      });

      it("authorized privileged action executes successfully", async () => {
        permissionProvider.grant(
          VALID_AGENT_ID,
          ComputerActionName.WRITE_FILE,
        );

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: {
            action: ComputerActionName.WRITE_FILE,
            params: { path: "allowed.txt", content: "data" },
          },
          timestamp: mockTime,
        });

        const result = await dispatchTransportService.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(result.statusCode).toBe(200);
        expect(result.envelope.success).toBe(true);
        expect(result.envelope.id).toBe(envelope.id);
        expect(result.envelope.data).toEqual({ written: true, bytes: 12 });
        expect(mockHandler.execute).toHaveBeenCalledWith(
          ComputerActionName.WRITE_FILE,
          { path: "allowed.txt", content: "data" },
          { agentId: VALID_AGENT_ID, userId: SERVER_USER_ID },
        );
      });

      it("unauthorized privileged action does not execute and produces the expected authorization/protocol error", async () => {
        // No permission granted for WRITE_FILE
        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: {
            action: ComputerActionName.WRITE_FILE,
            params: { path: "forbidden.txt", content: "evil" },
          },
          timestamp: mockTime,
        });

        const result = await dispatchTransportService.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(mockHandler.execute).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(200);
        expect(result.envelope.success).toBe(false);
        expect(result.envelope.id).toBe(envelope.id);
        expect(result.envelope.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
        expect(result.envelope.error?.message).toContain(
          'Computer action "computer_write_file" requires authorization.',
        );
      });

      it("invalid credentials stop before dispatch", async () => {
        const mockDispatcher: ComputerAgentActionDispatcher = {
          authorize: vi.fn(),
          dispatch: vi.fn(),
        };

        const serviceWithMock = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          dispatcher: mockDispatcher,
          clock: () => mockTime,
        });

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: { action: ComputerActionName.GET_STATUS },
          timestamp: mockTime,
        });

        const result = await serviceWithMock.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: "wrong_credential" },
          envelope,
        );

        expect(result.statusCode).toBe(401);
        expect(result.envelope.success).toBe(false);
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      });

      it("identity mismatch stops before dispatch", async () => {
        const mockDispatcher: ComputerAgentActionDispatcher = {
          authorize: vi.fn(),
          dispatch: vi.fn(),
        };

        const serviceWithMock = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          dispatcher: mockDispatcher,
          clock: () => mockTime,
        });

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: "different_agent_id",
          payload: { action: ComputerActionName.GET_STATUS },
          timestamp: mockTime,
        });

        const result = await serviceWithMock.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(result.statusCode).toBe(403);
        expect(result.envelope.success).toBe(false);
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      });

      it("timestamp drift stops before dispatch", async () => {
        const mockDispatcher: ComputerAgentActionDispatcher = {
          authorize: vi.fn(),
          dispatch: vi.fn(),
        };

        const serviceWithMock = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          dispatcher: mockDispatcher,
          clock: () => mockTime,
          maxDriftMs: 60_000,
        });

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: { action: ComputerActionName.GET_STATUS },
          timestamp: mockTime - 60_001,
        });

        const result = await serviceWithMock.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(result.statusCode).toBe(400);
        expect(result.envelope.success).toBe(false);
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      });

      it("replayed envelope stops before dispatch", async () => {
        const mockDispatcher: ComputerAgentActionDispatcher = {
          authorize: vi.fn(),
          dispatch: vi.fn().mockResolvedValue({
            correlationId: "corr-1",
            action: ComputerActionName.GET_STATUS,
            success: true,
            timestamp: mockTime,
            data: { status: "ONLINE" },
          }),
        };

        const serviceWithMock = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          dispatcher: mockDispatcher,
          clock: () => mockTime,
        });

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: { action: ComputerActionName.GET_STATUS },
          timestamp: mockTime,
        });

        const firstResult = await serviceWithMock.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );
        expect(firstResult.statusCode).toBe(200);

        const secondResult = await serviceWithMock.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );
        expect(secondResult.statusCode).toBe(409);
        expect(secondResult.envelope.success).toBe(false);
        expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);
      });

      it("missing dispatcher fails safely", async () => {
        const serviceWithoutDispatcher = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          clock: () => mockTime,
        });

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: { action: ComputerActionName.GET_STATUS },
          timestamp: mockTime,
        });

        const result = await serviceWithoutDispatcher.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(result.statusCode).toBe(200);
        expect(result.envelope.success).toBe(false);
        expect(result.envelope.error?.code).toBe(
          ProtocolErrorCode.ACTION_FAILED,
        );
        expect(result.envelope.error?.message).toBe(
          "Action dispatcher is not configured.",
        );
      });

      it("derives ComputerAgentActionContext ONLY from authenticated server context and ignores client-supplied userId or authorization", async () => {
        let capturedContext: ComputerAgentActionContext | null = null;
        const mockDispatcher: ComputerAgentActionDispatcher = {
          authorize: vi.fn(),
          dispatch: vi.fn(async (_req, ctx) => {
            capturedContext = ctx;
            return {
              correlationId: "corr-sec",
              action: ComputerActionName.GET_STATUS,
              success: true,
              timestamp: mockTime,
              data: {},
            };
          }),
        };

        const serviceWithMock = new ComputerAgentHttpTransportService({
          authenticator: mockAuthenticator,
          replayGuard,
          dispatcher: mockDispatcher,
          clock: () => mockTime,
        });

        const envelope = createProtocolRequest({
          type: "action_request",
          agentId: VALID_AGENT_ID,
          payload: {
            action: ComputerActionName.GET_STATUS,
            userId: "attacker-spoofed-user",
            isAuthorized: true,
            permissions: ["all"],
          },
          timestamp: mockTime,
        });

        await serviceWithMock.handleIncomingMessage(
          { agentId: VALID_AGENT_ID, credential: VALID_CREDENTIAL },
          envelope,
        );

        expect(capturedContext).toEqual({
          agentId: VALID_AGENT_ID,
          userId: SERVER_USER_ID,
        });
        expect((capturedContext as any)?.isAuthorized).toBeUndefined();
        expect((capturedContext as any)?.permissions).toBeUndefined();
      });
    });
  });

  describe("HTTP Route Integration Tests (POST /api/v1/computer-agents/protocol/messages)", () => {
    const AGENT_ID = "agent_http_integration";
    const CREDENTIAL = "integration_secret_token";
    let replayGuard: InMemoryEnvelopeReplayGuard;

    beforeEach(() => {
      replayGuard = new InMemoryEnvelopeReplayGuard({ ttlMs: 60_000 });
      const testTransportService = new ComputerAgentHttpTransportService({
        authenticator: {
          authenticate: async (id, cred) => {
            if (id === AGENT_ID && cred === CREDENTIAL) {
              return {
                authenticated: true,
                agentId: AGENT_ID,
                userId: "user_integration",
                authenticatedAt: new Date(),
              };
            }
            return null;
          },
        },
        replayGuard,
        maxDriftMs: 60_000,
      });

      setComputerAgentHttpTransportService(testTransportService);
    });

    it("returns 401 when auth headers are completely missing", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .send({ some: "data" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(response.body.error.message).toBe("Invalid agent credentials.");
    });

    it("returns 401 when credentials in headers are invalid", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", "wrong-secret")
        .send({ some: "data" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
    });

    it("returns 400 when authenticated but envelope is malformed", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send({ invalid: "body" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.INVALID_ENVELOPE);
    });

    it("returns 200 OK with protocol acknowledgement for valid request", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: AGENT_ID,
        payload: { message: "ping from test" },
        timestamp: Date.now(),
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe(envelope.id);
      expect(response.body.data.status).toBe("acknowledged");
      expect(typeof response.body.data.receivedAt).toBe("number");
      expect("requestId" in response.body).toBe(false);
    });

    it("returns 409 Conflict when envelope ID is replayed", async () => {
      const envelope = createProtocolRequest({
        type: "ping",
        agentId: AGENT_ID,
        payload: { nonce: "replay_test" },
        timestamp: Date.now(),
      });

      // First request succeeds
      const firstRes = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send(envelope);
      expect(firstRes.status).toBe(200);

      // Duplicate request fails
      const secondRes = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send(envelope);
      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe(ProtocolErrorCode.PROTOCOL_ERROR);
      expect(secondRes.body.error.message).toBe("Duplicate envelope ID rejected.");
    });

    it("dispatches action_request and returns 200 OK with action response data", async () => {
      const permissionProvider = new InMemoryComputerActionPermissionProvider();
      const authorizer = new ComputerAgentActionAuthorizer({
        permissionProvider,
      });
      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        handler: {
          execute: async () => ({ status: "ONLINE", appCount: 5 }),
        },
      });

      const testTransportService = new ComputerAgentHttpTransportService({
        authenticator: {
          authenticate: async (id, cred) => {
            if (id === AGENT_ID && cred === CREDENTIAL) {
              return {
                authenticated: true,
                agentId: AGENT_ID,
                userId: "user_integration",
                authenticatedAt: new Date(),
              };
            }
            return null;
          },
        },
        replayGuard: new InMemoryEnvelopeReplayGuard({ ttlMs: 60_000 }),
        dispatcher,
      });

      setComputerAgentHttpTransportService(testTransportService);

      const envelope = createProtocolRequest({
        type: "action_request",
        agentId: AGENT_ID,
        payload: { action: ComputerActionName.GET_STATUS },
        timestamp: Date.now(),
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe(envelope.id);
      expect(response.body.data).toEqual({ status: "ONLINE", appCount: 5 });
    });

    it("returns protocol unauthorized error for unauthorized privileged action through HTTP route", async () => {
      const permissionProvider = new InMemoryComputerActionPermissionProvider();
      const authorizer = new ComputerAgentActionAuthorizer({
        permissionProvider,
      });
      const mockHandler = { execute: vi.fn() };
      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer,
        handler: mockHandler,
      });

      const testTransportService = new ComputerAgentHttpTransportService({
        authenticator: {
          authenticate: async (id, cred) => {
            if (id === AGENT_ID && cred === CREDENTIAL) {
              return {
                authenticated: true,
                agentId: AGENT_ID,
                userId: "user_integration",
                authenticatedAt: new Date(),
              };
            }
            return null;
          },
        },
        replayGuard: new InMemoryEnvelopeReplayGuard({ ttlMs: 60_000 }),
        dispatcher,
      });

      setComputerAgentHttpTransportService(testTransportService);

      const envelope = createProtocolRequest({
        type: "action_request",
        agentId: AGENT_ID,
        payload: {
          action: ComputerActionName.WRITE_FILE,
          params: { path: "denied.txt", content: "payload" },
        },
        timestamp: Date.now(),
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.id).toBe(envelope.id);
      expect(response.body.error.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(mockHandler.execute).not.toHaveBeenCalled();
    });

    it("returns protocol action failed error when dispatcher is missing through HTTP route", async () => {
      const testTransportService = new ComputerAgentHttpTransportService({
        authenticator: {
          authenticate: async (id, cred) => {
            if (id === AGENT_ID && cred === CREDENTIAL) {
              return {
                authenticated: true,
                agentId: AGENT_ID,
                userId: "user_integration",
                authenticatedAt: new Date(),
              };
            }
            return null;
          },
        },
        replayGuard: new InMemoryEnvelopeReplayGuard({ ttlMs: 60_000 }),
      });

      setComputerAgentHttpTransportService(testTransportService);

      const envelope = createProtocolRequest({
        type: "action_request",
        agentId: AGENT_ID,
        payload: { action: ComputerActionName.GET_STATUS },
        timestamp: Date.now(),
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", AGENT_ID)
        .set("x-agent-credential", CREDENTIAL)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.ACTION_FAILED);
      expect(response.body.error.message).toBe(
        "Action dispatcher is not configured.",
      );
    });
  });
});
