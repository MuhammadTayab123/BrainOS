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
  ComputerAgentAuthenticator,
  ComputerAgentHttpTransportService,
  InMemoryEnvelopeReplayGuard,
} from "../../../../src/services/computer/transport";
import { ComputerAgentClient } from "../../../../src/services/computer/client";
import { ComputerActionQueueService } from "../../../../src/services/computer/queue/computer-action-queue.service";
import { ComputerAgentActionRecord } from "../../../../src/services/computer/queue/computer-action-queue.types";
import { setComputerAgentHttpTransportService } from "../../../../src/controllers/computer-agent/computer-agent.controller";

describe("Mission 81 — Computer Agent Action Protocol & Polling", () => {
  const validAgentId = "agent-host-1";
  const validCredential = "ca_sec_valid_token_1234567890abcdef";
  const ownerUserId = "user-owner-1";

  let mockQueueService: ComputerActionQueueService;
  let mockAuthenticator: ComputerAgentAuthenticator;
  let replayGuard: InMemoryEnvelopeReplayGuard;
  let transportService: ComputerAgentHttpTransportService;

  beforeEach(() => {
    mockAuthenticator = {
      authenticate: vi.fn().mockImplementation(async (agentId, credential) => {
        if (agentId === validAgentId && credential === validCredential) {
          return {
            authenticated: true,
            agentId: validAgentId,
            userId: ownerUserId,
            authenticatedAt: new Date(),
          };
        }
        return null;
      }),
    };

    mockQueueService = {
      claimNextAction: vi.fn(),
      completeAction: vi.fn(),
      failAction: vi.fn(),
      cancelAction: vi.fn(),
      expireStaleActions: vi.fn(),
      enqueueAction: vi.fn(),
      getAction: vi.fn(),
      listActions: vi.fn(),
    } as unknown as ComputerActionQueueService;

    replayGuard = new InMemoryEnvelopeReplayGuard();

    transportService = new ComputerAgentHttpTransportService({
      authenticator: mockAuthenticator,
      replayGuard,
      queueService: mockQueueService,
    });

    setComputerAgentHttpTransportService(transportService);
  });

  describe("action_poll protocol handling", () => {
    it("returns claimed action when queue has pending work for the authenticated agent", async () => {
      const mockRecord: ComputerAgentActionRecord = {
        id: "action-123",
        agentId: validAgentId,
        userId: ownerUserId,
        correlationId: "corr-abc-1",
        actionName: "computer_launch_application",
        params: { appId: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App" },
        status: "CLAIMED",
        result: null,
        error: null,
        claimedAt: new Date("2026-09-09T08:00:00.000Z"),
        completedAt: null,
        expiresAt: new Date("2026-09-09T08:05:00.000Z"),
        createdAt: new Date("2026-09-09T07:59:00.000Z"),
        updatedAt: new Date("2026-09-09T08:00:00.000Z"),
      };

      vi.mocked(mockQueueService.claimNextAction).mockResolvedValue(mockRecord);

      const envelope = createProtocolRequest({
        type: "action_poll",
        agentId: validAgentId,
        payload: { capabilities: ["computer_launch_application"] },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.id).toBe(envelope.id);
      expect(response.body.data).toEqual({
        hasAction: true,
        action: {
          id: "action-123",
          correlationId: "corr-abc-1",
          actionName: "computer_launch_application",
          params: { appId: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App" },
          expiresAt: "2026-09-09T08:05:00.000Z",
        },
      });

      // Security check: userId is NEVER exposed in the action response data
      expect(response.body.data.action).not.toHaveProperty("userId");

      expect(mockQueueService.claimNextAction).toHaveBeenCalledWith(validAgentId);
    });

    it("returns hasAction: false and action: null when queue is empty", async () => {
      vi.mocked(mockQueueService.claimNextAction).mockResolvedValue(null);

      const envelope = createProtocolRequest({
        type: "action_poll",
        agentId: validAgentId,
        payload: {},
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        hasAction: false,
        action: null,
      });
    });

    it("fails closed when queueService is not configured", async () => {
      const transportWithoutQueue = new ComputerAgentHttpTransportService({
        authenticator: mockAuthenticator,
        replayGuard,
      });

      const result = await transportWithoutQueue.handleIncomingMessage(
        { agentId: validAgentId, credential: validCredential },
        createProtocolRequest({
          type: "action_poll",
          agentId: validAgentId,
          payload: {},
        }),
      );

      expect(result.statusCode).toBe(200);
      expect(result.envelope.success).toBe(false);
      expect(result.envelope.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
      expect(result.envelope.error?.message).toContain("Queue service is not configured");
    });

    it("rejects action_poll when credentials are invalid (401)", async () => {
      const envelope = createProtocolRequest({
        type: "action_poll",
        agentId: validAgentId,
        payload: {},
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", "wrong-secret")
        .send(envelope);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(mockQueueService.claimNextAction).not.toHaveBeenCalled();
    });

    it("rejects action_poll when envelope agentId does not match auth headers (403)", async () => {
      const envelope = createProtocolRequest({
        type: "action_poll",
        agentId: "different-agent-id",
        payload: {},
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(mockQueueService.claimNextAction).not.toHaveBeenCalled();
    });

    it("rejects duplicate envelope ID on second action_poll (409 Replay)", async () => {
      vi.mocked(mockQueueService.claimNextAction).mockResolvedValue(null);

      const envelope = createProtocolRequest({
        type: "action_poll",
        agentId: validAgentId,
        payload: {},
      });

      const res1 = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);
      expect(res2.status).toBe(409);
      expect(res2.body.error.message).toContain("Duplicate envelope ID rejected");
    });
  });

  describe("action_result protocol handling", () => {
    it("successfully completes a claimed action with result data", async () => {
      const completedRecord: ComputerAgentActionRecord = {
        id: "act-101",
        agentId: validAgentId,
        userId: ownerUserId,
        correlationId: "corr-101",
        actionName: "computer_launch_application",
        params: { appId: "Spotify" },
        status: "COMPLETED",
        result: { launched: true, pid: 1234 },
        error: null,
        claimedAt: new Date("2026-09-09T08:00:00.000Z"),
        completedAt: new Date("2026-09-09T08:00:05.000Z"),
        expiresAt: new Date("2026-09-09T08:05:00.000Z"),
        createdAt: new Date("2026-09-09T07:59:00.000Z"),
        updatedAt: new Date("2026-09-09T08:00:05.000Z"),
      };

      vi.mocked(mockQueueService.completeAction).mockResolvedValue(completedRecord);

      const envelope = createProtocolRequest({
        type: "action_result",
        agentId: validAgentId,
        payload: {
          actionId: "act-101",
          correlationId: "corr-101",
          success: true,
          result: { launched: true, pid: 1234 },
        },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        actionId: "act-101",
        status: "COMPLETED",
        completedAt: "2026-09-09T08:00:05.000Z",
      });

      expect(mockQueueService.completeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: "act-101",
          correlationId: "corr-101",
          agentId: validAgentId,
          result: { launched: true, pid: 1234 },
        }),
      );
    });

    it("successfully records a failed action result with error message", async () => {
      const failedRecord: ComputerAgentActionRecord = {
        id: "act-102",
        agentId: validAgentId,
        userId: ownerUserId,
        correlationId: "corr-102",
        actionName: "computer_launch_application",
        params: { appId: "NonExistent" },
        status: "FAILED",
        result: null,
        error: "Process spawn error: 0x80070002",
        claimedAt: new Date("2026-09-09T08:00:00.000Z"),
        completedAt: new Date("2026-09-09T08:00:02.000Z"),
        expiresAt: new Date("2026-09-09T08:05:00.000Z"),
        createdAt: new Date("2026-09-09T07:59:00.000Z"),
        updatedAt: new Date("2026-09-09T08:00:02.000Z"),
      };

      vi.mocked(mockQueueService.failAction).mockResolvedValue(failedRecord);

      const envelope = createProtocolRequest({
        type: "action_result",
        agentId: validAgentId,
        payload: {
          actionId: "act-102",
          correlationId: "corr-102",
          success: false,
          error: "Process spawn error: 0x80070002",
        },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        actionId: "act-102",
        status: "FAILED",
        completedAt: "2026-09-09T08:00:02.000Z",
      });

      expect(mockQueueService.failAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: "act-102",
          correlationId: "corr-102",
          agentId: validAgentId,
          error: "Process spawn error: 0x80070002",
        }),
      );
    });

    it("rejects action_result when correlationId mismatches persisted record", async () => {
      const { AppError } = await import("../../../../src/errors");
      vi.mocked(mockQueueService.completeAction).mockRejectedValue(
        new AppError({
          message: "Action correlation ID mismatch.",
          statusCode: 400,
          code: "CORRELATION_MISMATCH",
        }),
      );

      const envelope = createProtocolRequest({
        type: "action_result",
        agentId: validAgentId,
        payload: {
          actionId: "act-101",
          correlationId: "forged-corr-id",
          success: true,
        },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("CORRELATION_MISMATCH");
      expect(response.body.error.message).toContain("Action correlation ID mismatch");
    });

    it("rejects cross-agent action_result attempt (agent attempting to complete another agent's action)", async () => {
      const { AppError } = await import("../../../../src/errors");
      vi.mocked(mockQueueService.completeAction).mockRejectedValue(
        new AppError({
          message: "Action does not belong to the authenticated agent.",
          statusCode: 403,
          code: "AGENT_MISMATCH",
        }),
      );

      const envelope = createProtocolRequest({
        type: "action_result",
        agentId: validAgentId,
        payload: {
          actionId: "act-belonging-to-other-agent",
          correlationId: "corr-other",
          success: true,
        },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("AGENT_MISMATCH");
    });

    it("rejects action_result when action is not in CLAIMED status (e.g. TIMED_OUT / CANCELLED)", async () => {
      const { AppError } = await import("../../../../src/errors");
      vi.mocked(mockQueueService.completeAction).mockRejectedValue(
        new AppError({
          message: 'Cannot complete action in status "TIMED_OUT". Action must be CLAIMED.',
          statusCode: 409,
          code: "INVALID_STATUS_TRANSITION",
        }),
      );

      const envelope = createProtocolRequest({
        type: "action_result",
        agentId: validAgentId,
        payload: {
          actionId: "act-timed-out",
          correlationId: "corr-to",
          success: true,
        },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("rejects action_result with 400 when payload is missing actionId, correlationId, or success", async () => {
      const badEnvelopes = [
        createProtocolRequest({
          type: "action_result",
          agentId: validAgentId,
          payload: { correlationId: "c1", success: true }, // missing actionId
        }),
        createProtocolRequest({
          type: "action_result",
          agentId: validAgentId,
          payload: { actionId: "a1", success: true }, // missing correlationId
        }),
        createProtocolRequest({
          type: "action_result",
          agentId: validAgentId,
          payload: { actionId: "a1", correlationId: "c1" }, // missing success boolean
        }),
      ];

      for (const badEnv of badEnvelopes) {
        const response = await request(app)
          .post("/api/v1/computer-agents/protocol/messages")
          .set("x-agent-id", validAgentId)
          .set("x-agent-credential", validCredential)
          .send(badEnv);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ProtocolErrorCode.INVALID_ENVELOPE);
      }
    });

    it("returns ACTION_NOT_FOUND when action does not exist", async () => {
      const { NotFoundError } = await import("../../../../src/errors");
      vi.mocked(mockQueueService.completeAction).mockRejectedValue(
        new NotFoundError("Computer agent action not found."),
      );

      const envelope = createProtocolRequest({
        type: "action_result",
        agentId: validAgentId,
        payload: {
          actionId: "nonexistent-action",
          correlationId: "corr-none",
          success: true,
        },
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/protocol/messages")
        .set("x-agent-id", validAgentId)
        .set("x-agent-credential", validCredential)
        .send(envelope);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ProtocolErrorCode.ACTION_NOT_FOUND);
    });
  });

  describe("ComputerAgentClient action polling and reporting", () => {
    it("client.pollAction successfully claims an action from the server", async () => {
      const mockRecord: ComputerAgentActionRecord = {
        id: "act-client-1",
        agentId: validAgentId,
        userId: ownerUserId,
        correlationId: "corr-client-1",
        actionName: "computer_write_file",
        params: { path: "test.txt", content: "hello" },
        status: "CLAIMED",
        result: null,
        error: null,
        claimedAt: new Date("2026-09-09T08:00:00.000Z"),
        completedAt: null,
        expiresAt: new Date("2026-09-09T08:05:00.000Z"),
        createdAt: new Date("2026-09-09T07:59:00.000Z"),
        updatedAt: new Date("2026-09-09T08:00:00.000Z"),
      };

      vi.mocked(mockQueueService.claimNextAction).mockResolvedValue(mockRecord);

      const customFetch: typeof fetch = async (url, init) => {
        const bodyObj = JSON.parse(init?.body as string);
        const headers = init?.headers as Record<string, string>;

        const transportRes = await transportService.handleIncomingMessage(
          {
            agentId: headers["x-agent-id"],
            credential: headers["x-agent-credential"],
          },
          bodyObj,
        );

        return new Response(JSON.stringify(transportRes.envelope), {
          status: transportRes.statusCode,
          headers: { "Content-Type": "application/json" },
        });
      };

      const client = new ComputerAgentClient({
        baseUrl: "http://localhost:3000",
        agentId: validAgentId,
        credential: validCredential,
        fetch: customFetch,
      });

      const result = await client.pollAction();

      expect(result.success).toBe(true);
      expect(result.data?.hasAction).toBe(true);
      expect(result.data?.action?.id).toBe("act-client-1");
      expect(result.data?.action?.actionName).toBe("computer_write_file");
    });

    it("client.reportActionResult successfully submits a completed result", async () => {
      const completedRecord: ComputerAgentActionRecord = {
        id: "act-client-2",
        agentId: validAgentId,
        userId: ownerUserId,
        correlationId: "corr-client-2",
        actionName: "computer_write_file",
        params: { path: "test.txt" },
        status: "COMPLETED",
        result: { written: true },
        error: null,
        claimedAt: new Date("2026-09-09T08:00:00.000Z"),
        completedAt: new Date("2026-09-09T08:00:03.000Z"),
        expiresAt: new Date("2026-09-09T08:05:00.000Z"),
        createdAt: new Date("2026-09-09T07:59:00.000Z"),
        updatedAt: new Date("2026-09-09T08:00:03.000Z"),
      };

      vi.mocked(mockQueueService.completeAction).mockResolvedValue(completedRecord);

      const customFetch: typeof fetch = async (url, init) => {
        const bodyObj = JSON.parse(init?.body as string);
        const headers = init?.headers as Record<string, string>;

        const transportRes = await transportService.handleIncomingMessage(
          {
            agentId: headers["x-agent-id"],
            credential: headers["x-agent-credential"],
          },
          bodyObj,
        );

        return new Response(JSON.stringify(transportRes.envelope), {
          status: transportRes.statusCode,
          headers: { "Content-Type": "application/json" },
        });
      };

      const client = new ComputerAgentClient({
        baseUrl: "http://localhost:3000",
        agentId: validAgentId,
        credential: validCredential,
        fetch: customFetch,
      });

      const res = await client.reportActionResult({
        actionId: "act-client-2",
        correlationId: "corr-client-2",
        success: true,
        result: { written: true },
      });

      expect(res.success).toBe(true);
      expect(res.data?.actionId).toBe("act-client-2");
      expect(res.data?.status).toBe("COMPLETED");
    });
  });
});
