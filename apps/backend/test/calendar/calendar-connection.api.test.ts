import crypto from "node:crypto";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
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

import app from "../../src/app";
import {
  setCalendarConnectionManager,
  setCalendarProviderRegistry,
} from "../../src/controllers/calendar/calendar-connection.controller";
import {
  AesGcmCredentialVault,
  CalendarConnectionManager,
  InMemoryUserCalendarConnectionRepository,
} from "../../src/services/calendar/connections";
import {
  CalendarProviderRegistry,
  MockCalendarProvider,
} from "../../src/services/calendar/providers";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
};

const userB = {
  id: "user-b",
  clerkId: "clerk-b",
  email: "user-b@example.test",
};

describe("Calendar Connection REST API (Mission 94)", () => {
  let repository: InMemoryUserCalendarConnectionRepository;
  let vault: AesGcmCredentialVault;
  let registry: CalendarProviderRegistry;
  let manager: CalendarConnectionManager;
  let mockDriver: MockCalendarProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    fakes.authenticatedUser.mockResolvedValue(userA);

    repository = new InMemoryUserCalendarConnectionRepository();
    vault = new AesGcmCredentialVault({ key: crypto.randomBytes(32) });
    registry = new CalendarProviderRegistry();
    mockDriver = new MockCalendarProvider({
      id: "mock-calendar",
      name: "Mock Calendar Provider",
    });
    registry.register(mockDriver);

    manager = new CalendarConnectionManager(repository, vault, registry);
    setCalendarConnectionManager(manager);
    setCalendarProviderRegistry(registry);
  });

  describe("Authentication Requirements (401)", () => {
    beforeEach(() => {
      fakes.authenticatedUser.mockResolvedValue(null);
    });

    it("returns 401 on GET /api/v1/calendar/connections when unauthenticated", async () => {
      const res = await request(app).get("/api/v1/calendar/connections");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 on GET /api/v1/calendar/connections/:id when unauthenticated", async () => {
      const res = await request(app).get("/api/v1/calendar/connections/conn-123");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 on PATCH /api/v1/calendar/connections/:id when unauthenticated", async () => {
      const res = await request(app)
        .patch("/api/v1/calendar/connections/conn-123")
        .send({ displayName: "New Name" });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 on DELETE /api/v1/calendar/connections/:id when unauthenticated", async () => {
      const res = await request(app).delete(
        "/api/v1/calendar/connections/conn-123",
      );
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 on GET /api/v1/calendar/providers when unauthenticated", async () => {
      const res = await request(app).get("/api/v1/calendar/providers");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /api/v1/calendar/connections (List)", () => {
    it("returns an empty list when user has no connections", async () => {
      const res = await request(app).get("/api/v1/calendar/connections");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it("returns only connections owned by the authenticated user", async () => {
      // Create connection for user A
      await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        accountEmail: "alice@work.com",
        displayName: "Alice Work",
        credentials: { accessToken: "token-a" },
      });

      // Create connection for user B
      await manager.createConnection(userB.id, {
        providerId: "mock-calendar",
        accountEmail: "bob@work.com",
        displayName: "Bob Work",
        credentials: { accessToken: "token-b" },
      });

      const res = await request(app).get("/api/v1/calendar/connections");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].userId).toBe(userA.id);
      expect(res.body.data[0].accountEmail).toBe("alice@work.com");
      expect(res.body.data[0].displayName).toBe("Alice Work");
    });
  });

  describe("GET /api/v1/calendar/connections/:id (Get By ID)", () => {
    it("returns connection metadata for an owned connection", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        accountEmail: "alice@example.com",
        displayName: "Alice Calendar",
        metadata: { department: "AI" },
        credentials: { accessToken: "token-alice" },
      });

      const res = await request(app).get(
        `/api/v1/calendar/connections/${conn.id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(conn.id);
      expect(res.body.data.userId).toBe(userA.id);
      expect(res.body.data.providerId).toBe("mock-calendar");
      expect(res.body.data.accountEmail).toBe("alice@example.com");
      expect(res.body.data.displayName).toBe("Alice Calendar");
      expect(res.body.data.metadata).toEqual({ department: "AI" });
      expect(res.body.data.status).toBe("CONNECTED");
    });

    it("returns 404 for a nonexistent connection", async () => {
      const res = await request(app).get(
        "/api/v1/calendar/connections/nonexistent-conn-id",
      );
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when attempting to get another user's connection (cross-user fail-closed)", async () => {
      // Created by User B
      const bobConn = await manager.createConnection(userB.id, {
        providerId: "mock-calendar",
        accountEmail: "bob@example.com",
        credentials: { accessToken: "token-bob" },
      });

      // User A attempts to view User B's connection
      const res = await request(app).get(
        `/api/v1/calendar/connections/${bobConn.id}`,
      );
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/calendar/connections/:id (Update)", () => {
    it("updates displayName, accountEmail, metadata, and status", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        accountEmail: "initial@example.com",
        displayName: "Old Display Name",
        credentials: { accessToken: "token-patch" },
      });

      const res = await request(app)
        .patch(`/api/v1/calendar/connections/${conn.id}`)
        .send({
          displayName: "New Display Name",
          accountEmail: "newemail@example.com",
          metadata: { color: "blue" },
          status: "DISCONNECTED",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(conn.id);
      expect(res.body.data.displayName).toBe("New Display Name");
      expect(res.body.data.accountEmail).toBe("newemail@example.com");
      expect(res.body.data.metadata).toEqual({ color: "blue" });
      expect(res.body.data.status).toBe("DISCONNECTED");
    });

    it("returns 400 on empty PATCH payload", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        credentials: { accessToken: "token-1" },
      });

      const res = await request(app)
        .patch(`/api/v1/calendar/connections/${conn.id}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 on invalid email format in PATCH body", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        credentials: { accessToken: "token-1" },
      });

      const res = await request(app)
        .patch(`/api/v1/calendar/connections/${conn.id}`)
        .send({ accountEmail: "invalid-email-address" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 when attempting to update another user's connection (cross-user fail-closed)", async () => {
      const bobConn = await manager.createConnection(userB.id, {
        providerId: "mock-calendar",
        displayName: "Bob Original",
        credentials: { accessToken: "token-bob" },
      });

      // User A attempts to PATCH User B's connection
      const res = await request(app)
        .patch(`/api/v1/calendar/connections/${bobConn.id}`)
        .send({ displayName: "Hacked Display Name" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");

      // Verify Bob's record in repository was not altered
      const unmodified = await manager.getConnection(userB.id, bobConn.id);
      expect(unmodified.displayName).toBe("Bob Original");
    });
  });

  describe("DELETE /api/v1/calendar/connections/:id (Delete / Disconnect)", () => {
    it("deletes an owned connection and prevents subsequent access", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        accountEmail: "delete-me@example.com",
        credentials: { accessToken: "token-del" },
      });

      const res = await request(app).delete(
        `/api/v1/calendar/connections/${conn.id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("deleted successfully");

      // Subsequent GET returns 404
      const getRes = await request(app).get(
        `/api/v1/calendar/connections/${conn.id}`,
      );
      expect(getRes.status).toBe(404);
    });

    it("returns 404 when deleting a nonexistent connection", async () => {
      const res = await request(app).delete(
        "/api/v1/calendar/connections/nonexistent-id",
      );
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when attempting to delete another user's connection (cross-user fail-closed)", async () => {
      const bobConn = await manager.createConnection(userB.id, {
        providerId: "mock-calendar",
        credentials: { accessToken: "token-bob" },
      });

      // User A attempts to delete User B's connection
      const res = await request(app).delete(
        `/api/v1/calendar/connections/${bobConn.id}`,
      );
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");

      // Verify Bob's connection still exists
      const intact = await manager.getConnection(userB.id, bobConn.id);
      expect(intact).not.toBeNull();
    });
  });

  describe("GET /api/v1/calendar/providers (Provider Discovery)", () => {
    it("returns registered providers and their declared capabilities", async () => {
      const res = await request(app).get("/api/v1/calendar/providers");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);

      const provider = res.body.data[0];
      expect(provider.id).toBe("mock-calendar");
      expect(provider.name).toBe("Mock Calendar Provider");
      expect(provider.capabilities).toBeDefined();
      expect(provider.capabilities.supportsRecurring).toBe(true);
    });
  });

  describe("Projection Hygiene & Credential Protection", () => {
    it("never exposes ciphertext, iv, authTag, algorithm, keyVersion, accessToken, or refreshToken in any response", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        accountEmail: "classified@example.com",
        credentials: {
          accessToken: "super-secret-access-token-999",
          refreshToken: "super-secret-refresh-token-888",
        },
      });

      // Check GET /connections response
      const listRes = await request(app).get("/api/v1/calendar/connections");
      const listPayload = JSON.stringify(listRes.body);
      expect(listPayload).not.toContain("ciphertext");
      expect(listPayload).not.toContain("authTag");
      expect(listPayload).not.toContain("super-secret-access-token");
      expect(listPayload).not.toContain("super-secret-refresh-token");

      // Check GET /connections/:id response
      const getRes = await request(app).get(
        `/api/v1/calendar/connections/${conn.id}`,
      );
      const getPayload = JSON.stringify(getRes.body);
      expect(getPayload).not.toContain("ciphertext");
      expect(getPayload).not.toContain("authTag");
      expect(getPayload).not.toContain("super-secret-access-token");
      expect(getPayload).not.toContain("super-secret-refresh-token");

      // Check PATCH /connections/:id response
      const patchRes = await request(app)
        .patch(`/api/v1/calendar/connections/${conn.id}`)
        .send({ displayName: "Sanitized Check" });
      const patchPayload = JSON.stringify(patchRes.body);
      expect(patchPayload).not.toContain("ciphertext");
      expect(patchPayload).not.toContain("authTag");
      expect(patchPayload).not.toContain("super-secret-access-token");
      expect(patchPayload).not.toContain("super-secret-refresh-token");
    });
  });

  describe("Client-Supplied Identity Protection", () => {
    it("ignores client-supplied userId in query/body and strictly enforces authenticated session identity", async () => {
      const conn = await manager.createConnection(userA.id, {
        providerId: "mock-calendar",
        accountEmail: "user-a@example.com",
        credentials: { accessToken: "token-a" },
      });

      // Attacker passes ?userId=user-b or body { userId: "user-b" }
      const res = await request(app)
        .patch(`/api/v1/calendar/connections/${conn.id}?userId=user-b`)
        .send({
          displayName: "Should Still Belong To User A",
          userId: "user-b",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(userA.id);

      // Verify connection is still owned by User A in repository
      const verified = await manager.getConnection(userA.id, conn.id);
      expect(verified.userId).toBe(userA.id);
      expect(verified.displayName).toBe("Should Still Belong To User A");
    });
  });
});
