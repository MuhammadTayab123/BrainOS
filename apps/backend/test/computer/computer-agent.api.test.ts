import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComputerAgentStatus } from "@prisma/client";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  create: vi.fn(),
  createWithCredential: vi.fn(),
  createCredential: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  findById: vi.fn(),
  findActiveCredentialsByAgentId: vi.fn(),
  updateLastAuthenticatedAt: vi.fn(),
  revokeByIdForUser: vi.fn(),
  softDeleteByIdForUser: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),

  getAuth: () => ({
    userId: "user-a",
    sessionId: "test-session",
    isAuthenticated: true,
  }),
}));

vi.mock("../../src/services/auth/auth.service", () => ({
  getAuthenticatedUser: fakes.authenticatedUser,
}));

vi.mock(
  "../../src/services/computer/repositories/computer-agent.repository",
  () => ({
    ComputerAgentRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      createWithCredential(data: Record<string, unknown>) {
        return fakes.createWithCredential(data);
      }

      createCredential(data: Record<string, unknown>) {
        return fakes.createCredential(data);
      }

      listByUser(options: Record<string, unknown>) {
        return fakes.listByUser(options);
      }

      findByIdForUser(agentId: string, userId: string) {
        return fakes.findByIdForUser(agentId, userId);
      }

      findById(agentId: string) {
        return fakes.findById(agentId);
      }

      findActiveCredentialsByAgentId(agentId: string) {
        return fakes.findActiveCredentialsByAgentId(agentId);
      }

      updateLastAuthenticatedAt(agentId: string) {
        return fakes.updateLastAuthenticatedAt(agentId);
      }

      revokeByIdForUser(agentId: string, userId: string) {
        return fakes.revokeByIdForUser(agentId, userId);
      }

      softDeleteByIdForUser(agentId: string, userId: string) {
        return fakes.softDeleteByIdForUser(agentId, userId);
      }
    },
  }),
);

import app from "../../src/app";
import { NotFoundError } from "../../src/errors";
import { hashCredential } from "../../src/services/computer/security/computer-agent-auth.service";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
  firstName: null,
  lastName: null,
  imageUrl: null,
};

const mockAgent = {
  id: "agent-1",
  userId: "user-a",
  name: "Office Workstation",
  status: ComputerAgentStatus.ACTIVE,
  lastAuthenticatedAt: null,
  revokedAt: null,
  createdAt: new Date("2026-09-05T00:00:00.000Z"),
  updatedAt: new Date("2026-09-05T00:00:00.000Z"),
};

describe("Computer Agents API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.authenticatedUser.mockResolvedValue(userA);
  });

  describe("POST /api/v1/computer-agents", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/computer-agents")
        .send({ name: "Work Laptop" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    });

    it("rejects missing name", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_NAME",
          message: "Computer agent name is required.",
        },
      });
    });

    it("rejects empty name string", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents")
        .send({ name: "   " });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_NAME");
    });

    it("rejects non-string name", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents")
        .send({ name: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_NAME");
    });

    it("rejects invalid agent ID", async () => {
      const response = await request(app)
        .post("/api/v1/computer-agents")
        .send({ name: "Work Laptop", id: "   " });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Agent ID must be a non-empty string.",
        },
      });
    });

    it("registers a computer agent successfully and ignores client-supplied userId", async () => {
      fakes.createWithCredential.mockResolvedValue(mockAgent);

      const response = await request(app)
        .post("/api/v1/computer-agents")
        .send({
          userId: "malicious-user-id",
          name: "  Office Workstation  ",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agent.id).toBe("agent-1");
      expect(response.body.data.agent.name).toBe("Office Workstation");
      expect(typeof response.body.data.credential).toBe("string");
      expect(response.body.data.credential.length).toBeGreaterThanOrEqual(32);

      // Ensure credentialHash is never in the returned data
      expect(response.body.data.agent.credentialHash).toBeUndefined();
      expect(response.body.data.credentialHash).toBeUndefined();

      // Enforce userId was taken from req.user.id and createWithCredential was called atomically
      expect(fakes.createWithCredential).toHaveBeenCalledWith({
        userId: "user-a",
        name: "Office Workstation",
        id: undefined,
        credentialHash: expect.stringMatching(/^[\da-f]+:[\da-f]+$/),
      });
    });
  });

  describe("GET /api/v1/computer-agents", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/computer-agents");

      expect(response.status).toBe(401);
    });

    it("lists agents for the authenticated user", async () => {
      fakes.listByUser.mockResolvedValue([mockAgent]);

      const response = await request(app).get("/api/v1/computer-agents");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe("Office Workstation");

      // Verify no credential hashes leaked
      expect(response.body.data[0].credentialHash).toBeUndefined();
      expect(response.body.data[0].credential).toBeUndefined();

      expect(fakes.listByUser).toHaveBeenCalledWith({
        userId: "user-a",
        status: undefined,
        limit: 50,
      });
    });

    it("validates and applies query filters", async () => {
      fakes.listByUser.mockResolvedValue([mockAgent]);

      const response = await request(app).get(
        "/api/v1/computer-agents?status=ACTIVE&limit=10",
      );

      expect(response.status).toBe(200);
      expect(fakes.listByUser).toHaveBeenCalledWith({
        userId: "user-a",
        status: ComputerAgentStatus.ACTIVE,
        limit: 10,
      });
    });

    it("rejects invalid limit", async () => {
      const response = await request(app).get(
        "/api/v1/computer-agents?limit=0",
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_LIMIT");
    });

    it("rejects invalid status", async () => {
      const response = await request(app).get(
        "/api/v1/computer-agents?status=UNKNOWN",
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_STATUS");
    });
  });

  describe("GET /api/v1/computer-agents/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/v1/computer-agents/agent-1",
      );

      expect(response.status).toBe(401);
    });

    it("returns 404 when agent is not found or not owned by user", async () => {
      fakes.findByIdForUser.mockResolvedValue(null);

      const response = await request(app).get(
        "/api/v1/computer-agents/agent-1",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns agent by ID without credential exposure", async () => {
      fakes.findByIdForUser.mockResolvedValue(mockAgent);

      const response = await request(app).get(
        "/api/v1/computer-agents/agent-1",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe("agent-1");
      expect(response.body.data.name).toBe("Office Workstation");
      expect(response.body.data.credentialHash).toBeUndefined();
      expect(response.body.data.credential).toBeUndefined();

      expect(fakes.findByIdForUser).toHaveBeenCalledWith("agent-1", "user-a");
    });
  });

  describe("POST /api/v1/computer-agents/:id/revoke", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).post(
        "/api/v1/computer-agents/agent-1/revoke",
      );

      expect(response.status).toBe(401);
    });

    it("returns 404 when revoking non-existent agent", async () => {
      fakes.revokeByIdForUser.mockRejectedValue(
        new NotFoundError(
          "Computer agent not found for the authenticated user.",
        ),
      );

      const response = await request(app).post(
        "/api/v1/computer-agents/agent-1/revoke",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("revokes an agent successfully", async () => {
      fakes.revokeByIdForUser.mockResolvedValue(undefined);

      const response = await request(app).post(
        "/api/v1/computer-agents/agent-1/revoke",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "agent-1",
          status: ComputerAgentStatus.REVOKED,
        },
      });

      expect(fakes.revokeByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-a",
      );
    });
  });

  describe("DELETE /api/v1/computer-agents/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).delete(
        "/api/v1/computer-agents/agent-1",
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    });

    it("returns 404 when deleting non-existent or unowned agent", async () => {
      fakes.softDeleteByIdForUser.mockRejectedValue(
        new NotFoundError(
          "Computer agent not found for the authenticated user.",
        ),
      );

      const response = await request(app).delete(
        "/api/v1/computer-agents/agent-1",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("deletes an agent successfully and passes owner userId", async () => {
      fakes.softDeleteByIdForUser.mockResolvedValue(undefined);

      const response = await request(app).delete(
        "/api/v1/computer-agents/agent-1",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "agent-1",
          deleted: true,
        },
      });

      expect(fakes.softDeleteByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-a",
      );
    });
  });

  describe("POST /api/v1/computer-agents/authenticate", () => {
    it("fails closed on missing or empty payload", async () => {
      const res1 = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({});

      expect(res1.status).toBe(401);
      expect(res1.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid agent credentials.",
        },
      });

      const res2 = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({ agentId: "agent-1" });

      expect(res2.status).toBe(401);
      expect(res2.body.error.code).toBe("UNAUTHORIZED");

      const res3 = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({ credential: "secret" });

      expect(res3.status).toBe(401);
      expect(res3.body.error.code).toBe("UNAUTHORIZED");

      const res4 = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({ agentId: "   ", credential: "secret" });

      expect(res4.status).toBe(401);
      expect(res4.body.error.code).toBe("UNAUTHORIZED");
    });

    it("fails closed with 401 when agent does not exist without leaking existence", async () => {
      fakes.findById.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({
          agentId: "unknown-agent",
          credential: "some-credential",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid agent credentials.",
        },
      });
    });

    it("fails closed with 401 when agent is revoked or deleted", async () => {
      fakes.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-a",
        name: "Revoked Agent",
        status: ComputerAgentStatus.REVOKED,
      });

      const response = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({
          agentId: "agent-1",
          credential: "some-credential",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid agent credentials.",
        },
      });
      expect(fakes.findActiveCredentialsByAgentId).not.toHaveBeenCalled();
    });

    it("fails closed with 401 when agent has no active credentials", async () => {
      fakes.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-a",
        name: "Active Agent",
        status: ComputerAgentStatus.ACTIVE,
      });
      fakes.findActiveCredentialsByAgentId.mockResolvedValue([]);

      const response = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({
          agentId: "agent-1",
          credential: "some-credential",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid agent credentials.",
        },
      });
    });

    it("fails closed with 401 when candidate credential does not match hash", async () => {
      const rawSecret = "correct-agent-secret";
      const storedHash = hashCredential(rawSecret);

      fakes.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-a",
        name: "Active Agent",
        status: ComputerAgentStatus.ACTIVE,
      });
      fakes.findActiveCredentialsByAgentId.mockResolvedValue([
        {
          id: "cred-1",
          agentId: "agent-1",
          credentialHash: storedHash,
        },
      ]);

      const response = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({
          agentId: "agent-1",
          credential: "wrong-agent-secret",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid agent credentials.",
        },
      });
      expect(fakes.updateLastAuthenticatedAt).not.toHaveBeenCalled();
    });

    it("authenticates agent successfully without Clerk user auth, returns minimum result, and updates timestamp", async () => {
      // Unauthenticated in Clerk to prove Clerk session is NOT used
      fakes.authenticatedUser.mockResolvedValue(null);

      const rawSecret = "super-secret-agent-password-32bytes";
      const storedHash = hashCredential(rawSecret);

      fakes.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-a",
        name: "Active Agent",
        status: ComputerAgentStatus.ACTIVE,
      });
      fakes.findActiveCredentialsByAgentId.mockResolvedValue([
        {
          id: "cred-1",
          agentId: "agent-1",
          credentialHash: storedHash,
        },
      ]);
      fakes.updateLastAuthenticatedAt.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/v1/computer-agents/authenticate")
        .send({
          agentId: "agent-1",
          credential: rawSecret,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          authenticated: true,
          agentId: "agent-1",
        },
      });

      // Verify no hash or sensitive data is returned
      expect(response.body.data.credentialHash).toBeUndefined();
      expect(response.body.data.credential).toBeUndefined();

      // Verify lastAuthenticatedAt updated
      expect(fakes.updateLastAuthenticatedAt).toHaveBeenCalledWith("agent-1");
    });
  });
});
