import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  createMessage: vi.fn(),
  listByConversation: vi.fn(),
  findByIdForUser: vi.fn(),
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
  "../../src/services/conversation/repositories/message.repository",
  () => ({
    MessageRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.createMessage(data);
      }

      listByConversation(conversationId: string) {
        return fakes.listByConversation(conversationId);
      }
    },
  }),
);

vi.mock(
  "../../src/services/conversation/repositories/conversation.repository",
  () => ({
    ConversationRepository: class {
      findByIdForUser(
        conversationId: string,
        userId: string,
      ) {
        return fakes.findByIdForUser(
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
  title: "First conversation",
  createdAt: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
  updatedAt: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
};

const message = {
  id: "message-a",
  conversationId: "conversation-a",
  role: "USER",
  content: "Hello BrainOS",
  createdAt: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
  updatedAt: new Date(
    "2026-01-01T00:00:00.000Z",
  ),
};

describe("authenticated message API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fakes.authenticatedUser.mockResolvedValue(
      userA,
    );

    fakes.findByIdForUser.mockResolvedValue(
      conversation,
    );

    fakes.createMessage.mockResolvedValue(
      message,
    );

    fakes.listByConversation.mockResolvedValue([
      message,
    ]);
  });

  describe("authentication", () => {
    it.each([
      [
        "POST",
        "/api/v1/conversations/conversation-a/messages",
      ],
      [
        "GET",
        "/api/v1/conversations/conversation-a/messages",
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
    it("creates an owner-scoped message", async () => {
      const response = await request(app)
        .post(
          "/api/v1/conversations/conversation-a/messages",
        )
        .send({
          role: "USER",
          content: "  Hello BrainOS  ",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject({
        id: "message-a",
        conversationId: "conversation-a",
        role: "USER",
        content: "Hello BrainOS",
      });

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );

      expect(
        fakes.createMessage,
      ).toHaveBeenCalledWith({
        conversationId: "conversation-a",
        role: "USER",
        content: "Hello BrainOS",
      });
    });

    it("rejects an empty conversation id", async () => {
      const response = await request(app)
        .post(
          "/api/v1/conversations/%20/messages",
        )
        .send({
          role: "USER",
          content: "Hello",
        });

      expect(response.status).toBe(400);

      expect(
        response.body.error.code,
      ).toBe("INVALID_CONVERSATION_ID");

      expect(
        fakes.findByIdForUser,
      ).not.toHaveBeenCalled();

      expect(
        fakes.createMessage,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid role", async () => {
      const response = await request(app)
        .post(
          "/api/v1/conversations/conversation-a/messages",
        )
        .send({
          role: "INVALID",
          content: "Hello",
        });

      expect(response.status).toBe(400);

      expect(
        response.body.error.code,
      ).toBe("INVALID_MESSAGE_ROLE");

      expect(
        fakes.findByIdForUser,
      ).not.toHaveBeenCalled();

      expect(
        fakes.createMessage,
      ).not.toHaveBeenCalled();
    });

    it("rejects empty content", async () => {
      const response = await request(app)
        .post(
          "/api/v1/conversations/conversation-a/messages",
        )
        .send({
          role: "USER",
          content: "   ",
        });

      expect(response.status).toBe(400);

      expect(
        response.body.error.code,
      ).toBe("INVALID_MESSAGE_CONTENT");

      expect(
        fakes.findByIdForUser,
      ).not.toHaveBeenCalled();

      expect(
        fakes.createMessage,
      ).not.toHaveBeenCalled();
    });

    it("does not create a message in another user's conversation", async () => {
      fakes.findByIdForUser.mockResolvedValueOnce(
        null,
      );

      const response = await request(app)
        .post(
          "/api/v1/conversations/conversation-b/messages",
        )
        .send({
          role: "USER",
          content: "Hello",
        });

      expect(response.status).toBe(404);

      expect(
        response.body.error.code,
      ).toBe("NOT_FOUND");

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-b",
        "user-a",
      );

      expect(
        fakes.createMessage,
      ).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("lists messages after verifying conversation ownership", async () => {
      const response = await request(app).get(
        "/api/v1/conversations/conversation-a/messages",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toHaveLength(1);

      expect(response.body.data[0]).toMatchObject({
        id: "message-a",
        conversationId: "conversation-a",
        role: "USER",
        content: "Hello BrainOS",
      });

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-a",
        "user-a",
      );

      expect(
        fakes.listByConversation,
      ).toHaveBeenCalledWith(
        "conversation-a",
      );
    });

    it("does not expose messages from another user's conversation", async () => {
      fakes.findByIdForUser.mockResolvedValueOnce(
        null,
      );

      const response = await request(app).get(
        "/api/v1/conversations/conversation-b/messages",
      );

      expect(response.status).toBe(404);

      expect(
        response.body.error.code,
      ).toBe("NOT_FOUND");

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "conversation-b",
        "user-a",
      );

      expect(
        fakes.listByConversation,
      ).not.toHaveBeenCalled();
    });

    it("rejects an empty conversation id", async () => {
      const response = await request(app).get(
        "/api/v1/conversations/%20/messages",
      );

      expect(response.status).toBe(400);

      expect(
        response.body.error.code,
      ).toBe("INVALID_CONVERSATION_ID");

      expect(
        fakes.findByIdForUser,
      ).not.toHaveBeenCalled();

      expect(
        fakes.listByConversation,
      ).not.toHaveBeenCalled();
    });
  });
});