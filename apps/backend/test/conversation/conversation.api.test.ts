import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  create: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  softDeleteByIdForUser: vi.fn(),
  records: [] as Array<Record<string, unknown>>,
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () =>
    (_req: unknown, _res: unknown, next: () => void) =>
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
  "../../src/services/conversation/repositories/conversation.repository",
  () => ({
    ConversationRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      listByUser(userId: string, limit: number) {
        return fakes.listByUser(userId, limit);
      }

      findByIdForUser(
        conversationId: string,
        userId: string,
      ) {
        return fakes.findByIdForUser(
          conversationId,
          userId,
        );
      }

      softDeleteByIdForUser(
        conversationId: string,
        userId: string,
      ) {
        return fakes.softDeleteByIdForUser(
          conversationId,
          userId,
        );
      }
    },
  }),
);

import app from "../../src/app";
import {
  NotFoundError,
  UnauthorizedError,
} from "../../src/errors";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
  firstName: null,
  lastName: null,
  imageUrl: null,
};

const conversation = {
  id: "conversation-a",
  userId: "user-a",
  title: "First conversation",
  createdAt: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
  updatedAt: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
  deletedAt: null,
};

function publicConversation(
  record: Record<string, unknown>,
) {
  const {
    id,
    title,
    createdAt,
    updatedAt,
  } = record;

  return {
    id,
    title,
    createdAt,
    updatedAt,
  };
}

function addConversation(
  overrides: Record<string, unknown> = {},
) {
  const record = {
    ...conversation,
    ...overrides,
  };

  fakes.records.push(record);

  return record;
}

function findActive(
  conversationId: string,
  userId: string,
) {
  return fakes.records.find(
    (record) =>
      record.id === conversationId &&
      record.userId === userId &&
      record.deletedAt === null,
  );
}

describe("authenticated conversation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fakes.records.length = 0;

    fakes.authenticatedUser.mockResolvedValue(
      userA,
    );

    fakes.create.mockImplementation(
      async (data: Record<string, unknown>) => {
        const record = addConversation({
          id: "conversation-created",
          userId: data.userId,
          title: data.title ?? null,
        });

        return publicConversation(record);
      },
    );

    fakes.listByUser.mockImplementation(
      async (userId: string, limit: number) =>
        fakes.records
          .filter(
            (record) =>
              record.userId === userId &&
              record.deletedAt === null,
          )
          .slice(0, limit)
          .map(publicConversation),
    );

    fakes.findByIdForUser.mockImplementation(
      async (
        conversationId: string,
        userId: string,
      ) => {
        const record = findActive(
          conversationId,
          userId,
        );

        return record
          ? publicConversation(record)
          : null;
      },
    );

    fakes.softDeleteByIdForUser.mockImplementation(
      async (
        conversationId: string,
        userId: string,
      ) => {
        const record = findActive(
          conversationId,
          userId,
        );

        if (!record) {
          throw new NotFoundError(
            "Conversation not found for the authenticated user.",
          );
        }

        record.deletedAt = new Date(
          "2026-01-02T00:00:00.000Z",
        );
      },
    );
  });

  describe("authentication", () => {
    it.each([
      ["POST", "/api/v1/conversations"],
      ["GET", "/api/v1/conversations"],
      [
        "GET",
        "/api/v1/conversations/conversation-a",
      ],
      [
        "DELETE",
        "/api/v1/conversations/conversation-a",
      ],
    ])(
      "returns 401 for unauthenticated %s %s",
      async (method, path) => {
        fakes.authenticatedUser.mockRejectedValueOnce(
          new UnauthorizedError(),
        );

        const response =
          await request(app)[
            method.toLowerCase() as "get"
          ](path);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        });
      },
    );
  });

  describe("create", () => {
    it("creates an owner-scoped conversation", async () => {
      const response = await request(app)
        .post("/api/v1/conversations")
        .send({
          title: "  First conversation  ",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject({
        id: "conversation-created",
        title: "First conversation",
      });

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "First conversation",
      });
    });

    it("allows a conversation without a title", async () => {
      const response = await request(app)
        .post("/api/v1/conversations")
        .send({});

      expect(response.status).toBe(201);

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: undefined,
      });
    });

    it("rejects an empty title", async () => {
      const response = await request(app)
        .post("/api/v1/conversations")
        .send({
          title: "   ",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(
        "INVALID_TITLE",
      );

      expect(fakes.create).not.toHaveBeenCalled();
    });

    it("rejects a non-string title", async () => {
      const response = await request(app)
        .post("/api/v1/conversations")
        .send({
          title: 123,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(
        "INVALID_TITLE",
      );

      expect(fakes.create).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns only active owner-scoped conversations", async () => {
      addConversation();

      addConversation({
        id: "conversation-b",
        userId: "user-b",
        title: "User B conversation",
      });

      addConversation({
        id: "conversation-deleted",
        deletedAt: new Date(),
        title: "Deleted conversation",
      });

      const response = await request(app).get(
        "/api/v1/conversations",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);

      expect(response.body.data[0]).toMatchObject({
        id: "conversation-a",
        title: "First conversation",
      });

      expect(
        response.body.data[0],
      ).not.toHaveProperty("userId");

      expect(
        response.body.data[0],
      ).not.toHaveProperty("deletedAt");

      expect(fakes.listByUser).toHaveBeenCalledWith(
        "user-a",
        20,
      );
    });

    it("accepts a valid limit", async () => {
      const response = await request(app).get(
        "/api/v1/conversations?limit=50",
      );

      expect(response.status).toBe(200);

      expect(fakes.listByUser).toHaveBeenCalledWith(
        "user-a",
        50,
      );
    });

    it.each([
      "0",
      "-1",
      "1.5",
      "words",
      "101",
    ])(
      "rejects invalid limit %s",
      async (limit) => {
        const response = await request(app).get(
          `/api/v1/conversations?limit=${limit}`,
        );

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe(
          "INVALID_LIMIT",
        );

        expect(
          fakes.listByUser,
        ).not.toHaveBeenCalled();
      },
    );
  });

  describe("get by id and ownership", () => {
    it("retrieves an owner-scoped conversation", async () => {
      addConversation();

      const response = await request(app).get(
        "/api/v1/conversations/conversation-a",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject({
        id: "conversation-a",
        title: "First conversation",
      });

      expect(
        response.body.data,
      ).not.toHaveProperty("userId");

      expect(
        response.body.data,
      ).not.toHaveProperty("deletedAt");

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );
    });

    it("does not expose another user's conversation", async () => {
      addConversation({
        id: "conversation-b",
        userId: "user-b",
      });

      const response = await request(app).get(
        "/api/v1/conversations/conversation-b",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(
        "NOT_FOUND",
      );

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-b",
        "user-a",
      );
    });

    it("returns 404 for a soft-deleted conversation", async () => {
      addConversation({
        deletedAt: new Date(),
      });

      const response = await request(app).get(
        "/api/v1/conversations/conversation-a",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(
        "NOT_FOUND",
      );
    });

    it("rejects an empty conversation id", async () => {
      const response = await request(app).get(
        "/api/v1/conversations/%20",
      );

      expect(response.status).toBe(400);
      expect(
        response.body.error.code,
      ).toBe("INVALID_CONVERSATION_ID");

      expect(
        fakes.findByIdForUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("soft-deletes an owner conversation", async () => {
      const record = addConversation();

      const response = await request(app).delete(
        "/api/v1/conversations/conversation-a",
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "conversation-a",
        },
      });

      expect(
        fakes.softDeleteByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );

      expect(record.deletedAt).toBeInstanceOf(Date);
    });

    it("does not delete another user's conversation", async () => {
      addConversation({
        id: "conversation-b",
        userId: "user-b",
      });

      const response = await request(app).delete(
        "/api/v1/conversations/conversation-b",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(
        "NOT_FOUND",
      );

      expect(
        fakes.softDeleteByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-b",
        "user-a",
      );
    });

    it("returns 404 for a nonexistent conversation", async () => {
      const response = await request(app).delete(
        "/api/v1/conversations/missing",
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(
        "NOT_FOUND",
      );
    });

    it("rejects an empty conversation id", async () => {
      const response = await request(app).delete(
        "/api/v1/conversations/%20",
      );

      expect(response.status).toBe(400);
      expect(
        response.body.error.code,
      ).toBe("INVALID_CONVERSATION_ID");

      expect(
        fakes.softDeleteByIdForUser,
      ).not.toHaveBeenCalled();
    });
  });
});