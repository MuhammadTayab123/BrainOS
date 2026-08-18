import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  embed: vi.fn(),
  records: [] as Array<Record<string, unknown>>,
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  updateByIdForUser: vi.fn(),
  updateEmbedding: vi.fn(),
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

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => callback({})),
  },
}));

vi.mock("../../src/services/memory/providers", () => ({
  OllamaProvider: class {
    embed(text: string) {
      return fakes.embed(text);
    }
  },
}));

vi.mock(
  "../../src/services/memory/repositories/memory.repository",
  () => ({
    MemoryRepository: class {
      listByUser(userId: string, limit: number) {
        return fakes.listByUser(userId, limit);
      }

      findByIdForUser(memoryId: string, userId: string) {
        return fakes.findByIdForUser(memoryId, userId);
      }

      updateByIdForUser(
        memoryId: string,
        userId: string,
        data: Record<string, unknown>,
      ) {
        return fakes.updateByIdForUser(memoryId, userId, data);
      }

      updateEmbedding(memoryId: string, userId: string, embedding: number[]) {
        return fakes.updateEmbedding(memoryId, userId, embedding);
      }

      softDeleteByIdForUser(memoryId: string, userId: string) {
        return fakes.softDeleteByIdForUser(memoryId, userId);
      }
    },
  }),
);

import app from "../../src/app";
import { NotFoundError, UnauthorizedError } from "../../src/errors";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
  firstName: null,
  lastName: null,
  imageUrl: null,
};
const userB = { ...userA, id: "user-b", clerkId: "clerk-b", email: "user-b@example.test" };
const vector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));

function publicMemory(record: Record<string, unknown>) {
  const { id, content, importance, lastAccessedAt, createdAt, updatedAt } = record;
  return { id, content, importance, lastAccessedAt, createdAt, updatedAt };
}

function addMemory(overrides: Record<string, unknown> = {}) {
  const record = {
    id: "memory-a",
    userId: "user-a",
    content: "User A memory",
    importance: 0.5,
    lastAccessedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
    embedding: vector,
    ...overrides,
  };
  fakes.records.push(record);
  return record;
}

function findActive(memoryId: string, userId: string) {
  return fakes.records.find(
    (record) =>
      record.id === memoryId &&
      record.userId === userId &&
      record.deletedAt === null,
  );
}

describe("authenticated memory API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.records.length = 0;
    fakes.authenticatedUser.mockResolvedValue(userA);
    fakes.embed.mockResolvedValue({
      vector,
      dimensions: 768,
      provider: "test",
      model: "test-model",
    });
    fakes.listByUser.mockImplementation(async (userId: string, limit: number) =>
      fakes.records
        .filter((record) => record.userId === userId && record.deletedAt === null)
        .slice(0, limit)
        .map(publicMemory),
    );
    fakes.findByIdForUser.mockImplementation(async (memoryId: string, userId: string) => {
      const record = findActive(memoryId, userId);
      return record ? publicMemory(record) : null;
    });
    fakes.updateByIdForUser.mockImplementation(
      async (memoryId: string, userId: string, data: Record<string, unknown>) => {
        const record = findActive(memoryId, userId);
        if (!record) {
          throw new NotFoundError("Memory not found for the authenticated user.");
        }
        Object.assign(record, data, { updatedAt: new Date("2026-01-02T00:00:00.000Z") });
      },
    );
    fakes.updateEmbedding.mockImplementation(async (memoryId: string, userId: string, embedding: number[]) => {
      const record = findActive(memoryId, userId);
      if (!record) {
        throw new NotFoundError("Memory not found for the authenticated user.");
      }
      record.embedding = embedding;
    });
    fakes.softDeleteByIdForUser.mockImplementation(async (memoryId: string, userId: string) => {
      const record = findActive(memoryId, userId);
      if (!record) {
        throw new NotFoundError("Memory not found for the authenticated user.");
      }
      record.deletedAt = new Date("2026-01-02T00:00:00.000Z");
    });
  });

  describe("authentication", () => {
    it.each([
      ["GET", "/api/v1/memories"],
      ["GET", "/api/v1/memories/memory-a"],
      ["PATCH", "/api/v1/memories/memory-a"],
      ["DELETE", "/api/v1/memories/memory-a"],
    ])("returns the existing 401 contract for unauthenticated %s %s", async (method, path) => {
      fakes.authenticatedUser.mockRejectedValueOnce(new UnauthorizedError());

      const response = await request(app)[method.toLowerCase() as "get"](path);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    });
  });

  describe("list", () => {
    it("returns only active owner-scoped memories with the default limit and public response shape", async () => {
      addMemory();
      addMemory({ id: "memory-b", userId: "user-b", content: "User B memory" });
      addMemory({ id: "memory-deleted", deletedAt: new Date(), content: "Deleted memory" });

      const response = await request(app).get("/api/v1/memories");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({ id: "memory-a", content: "User A memory" });
      expect(Object.keys(response.body.data[0]).sort()).toEqual(
        ["id", "content", "importance", "lastAccessedAt", "createdAt", "updatedAt"].sort(),
      );
      expect(fakes.listByUser).toHaveBeenCalledWith("user-a", 20);
    });

    it("accepts a valid limit", async () => {
      addMemory();

      const response = await request(app).get("/api/v1/memories?limit=1");

      expect(response.status).toBe(200);
      expect(fakes.listByUser).toHaveBeenCalledWith("user-a", 1);
    });

    it.each(["0", "-1", "1.5", "words", "51"])(
      "rejects invalid limit %s with INVALID_LIMIT",
      async (limit) => {
        const response = await request(app).get(`/api/v1/memories?limit=${limit}`);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_LIMIT");
        expect(fakes.listByUser).not.toHaveBeenCalled();
      },
    );
  });

  describe("get by id and ownership", () => {
    it("retrieves an active owner-scoped memory without exposing private fields", async () => {
      addMemory();

      const response = await request(app).get("/api/v1/memories/memory-a");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true, data: { id: "memory-a" } });
      expect(Object.keys(response.body.data).sort()).toEqual(
        ["id", "content", "importance", "lastAccessedAt", "createdAt", "updatedAt"].sort(),
      );
      expect(fakes.findByIdForUser).toHaveBeenCalledWith("memory-a", "user-a");
    });

    it("makes a different-owner and nonexistent memory indistinguishable", async () => {
      addMemory({ id: "memory-b", userId: "user-b" });

      const differentOwner = await request(app).get("/api/v1/memories/memory-b");
      const nonexistent = await request(app).get("/api/v1/memories/missing");

      expect(differentOwner.status).toBe(404);
      expect(differentOwner.body).toEqual(nonexistent.body);
      expect(differentOwner.body.error.code).toBe("NOT_FOUND");
      expect(fakes.findByIdForUser).toHaveBeenCalledWith("memory-b", "user-a");
    });

    it("returns the same not-found behavior for a soft-deleted memory", async () => {
      addMemory({ deletedAt: new Date() });

      const response = await request(app).get("/api/v1/memories/memory-a");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
      expect(fakes.findByIdForUser).toHaveBeenCalledWith("memory-a", "user-a");
    });
  });

  describe("patch", () => {
    it("updates owner content, generates an embedding, and keeps private fields out of the response", async () => {
      addMemory();

      const response = await request(app)
        .patch("/api/v1/memories/memory-a")
        .send({ content: "Updated content" });

      expect(response.status).toBe(200);
      expect(response.body.data.content).toBe("Updated content");
      expect(fakes.embed).toHaveBeenCalledWith("Updated content");
      expect(fakes.updateByIdForUser).toHaveBeenCalledWith(
        "memory-a",
        "user-a",
        { content: "Updated content" },
      );
      expect(fakes.updateEmbedding).toHaveBeenCalledWith("memory-a", "user-a", vector);
      expect(response.body.data).not.toHaveProperty("embedding");
      expect(response.body.data).not.toHaveProperty("userId");
    });

    it("updates owner importance without generating an embedding", async () => {
      addMemory();

      const response = await request(app)
        .patch("/api/v1/memories/memory-a")
        .send({ importance: 0.9 });

      expect(response.status).toBe(200);
      expect(response.body.data.importance).toBe(0.9);
      expect(fakes.embed).not.toHaveBeenCalled();
      expect(fakes.updateByIdForUser).toHaveBeenCalledWith("memory-a", "user-a", { importance: 0.9 });
    });

    it.each([
      ["different owner", { id: "memory-b", userId: "user-b" }],
      ["soft-deleted memory", { id: "memory-a", deletedAt: new Date() }],
    ])("does not update a %s", async (_description, record) => {
      addMemory(record);

      const response = await request(app)
        .patch(`/api/v1/memories/${record.id as string}`)
        .send({ importance: 0.9 });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
      expect(fakes.updateByIdForUser).not.toHaveBeenCalled();
      expect(fakes.embed).not.toHaveBeenCalled();
      expect(fakes.findByIdForUser).toHaveBeenCalledWith(record.id, "user-a");
    });

    it.each([
      { userId: "user-b" },
      { id: "other" },
      { embedding: vector },
      { deletedAt: "2026-01-01" },
      { createdAt: "2026-01-01" },
      { updatedAt: "2026-01-01" },
    ])("rejects protected or unknown update fields", async (payload) => {
      const response = await request(app).patch("/api/v1/memories/memory-a").send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_UPDATE_FIELDS");
    });

    it("rejects an empty update payload", async () => {
      const response = await request(app).patch("/api/v1/memories/memory-a").send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_UPDATE_PAYLOAD");
    });

    it.each([{ content: "" }, { content: "   " }, { content: 12 }])(
      "rejects invalid content",
      async (payload) => {
        const response = await request(app).patch("/api/v1/memories/memory-a").send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_CONTENT");
      },
    );

    it.each([{ importance: -0.1 }, { importance: 1.1 }, { importance: "high" }, { importance: null }])(
      "rejects invalid importance",
      async (payload) => {
        const response = await request(app).patch("/api/v1/memories/memory-a").send(payload);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe("INVALID_IMPORTANCE");
      },
    );

    it("returns the existing 500 response when embedding generation fails before mutation", async () => {
      addMemory();
      fakes.embed.mockRejectedValueOnce(new Error("embedding unavailable"));

      const response = await request(app)
        .patch("/api/v1/memories/memory-a")
        .send({ content: "Updated content" });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(fakes.updateByIdForUser).not.toHaveBeenCalled();
      expect(fakes.updateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe("delete and soft delete", () => {
    it("soft-deletes an owner memory, preserves its record, and makes it unavailable afterwards", async () => {
      const record = addMemory();

      const deleted = await request(app).delete("/api/v1/memories/memory-a");
      const retrieved = await request(app).get("/api/v1/memories/memory-a");

      expect(deleted.status).toBe(200);
      expect(deleted.body).toEqual({ success: true, data: { id: "memory-a" } });
      expect(fakes.softDeleteByIdForUser).toHaveBeenCalledWith("memory-a", "user-a");
      expect(fakes.records).toContain(record);
      expect(record.deletedAt).toBeInstanceOf(Date);
      expect(retrieved.status).toBe(404);
      expect(retrieved.body.error.code).toBe("NOT_FOUND");
    });

    it.each([
      ["different owner", { id: "memory-b", userId: "user-b" }],
      ["nonexistent", null],
      ["already-deleted", { id: "memory-a", deletedAt: new Date() }],
    ])("does not delete a %s memory", async (_description, record) => {
      if (record) {
        addMemory(record);
      }

      const memoryId = record?.id ?? "missing";
      const response = await request(app).delete(`/api/v1/memories/${memoryId}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
      expect(fakes.softDeleteByIdForUser).toHaveBeenCalledWith(memoryId, "user-a");
    });
  });
});
