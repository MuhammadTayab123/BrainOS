import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  ask: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (
    _req: unknown,
    _res: unknown,
    next: () => void,
  ) => next(),

  getAuth: () => ({
    userId: "clerk-a",
  }),
}));

vi.mock("../../src/services/auth/auth.service", () => ({
  getAuthenticatedUser: fakes.authenticatedUser,
}));

vi.mock("../../src/services/assistant/assistant.service", () => ({
  AssistantService: class {
    ask(input: unknown) {
      return fakes.ask(input);
    }
  },
}));

import app from "../../src/app";
import { UnauthorizedError } from "../../src/errors";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
  firstName: null,
  lastName: null,
  imageUrl: null,
};

describe("assistant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fakes.authenticatedUser.mockResolvedValue(userA);

    fakes.ask.mockResolvedValue({
      text: "Hello from BrainOS.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
    });
  });

  describe("authentication", () => {
    it("returns 401 for an unauthenticated request", async () => {
      fakes.authenticatedUser.mockRejectedValueOnce(
        new UnauthorizedError(),
      );

      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
        });

      expect(response.status).toBe(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });
  });

  describe("ask", () => {
    it("passes the authenticated user and message to AssistantService", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          text: "Hello from BrainOS.",
          model: "test-model",
          provider: "test",
          retrievedMemories: [],
        },
      });

      expect(fakes.ask).toHaveBeenCalledWith({
        userId: "user-a",
       message: "Hello BrainOS",
       conversationId: undefined,
        systemPrompt: undefined,
        conversationHistory: undefined,
        enableMemoryRetrieval: undefined,
        memorySearchLimit: undefined,
        model: undefined,
      });
    });

    it("passes optional assistant parameters through", async () => {
      const response = await request(app)
  .post("/api/v1/assistant/ask")
  .send({
    message: "What do you remember?",
    conversationId: "conversation-a",
    systemPrompt: "Be concise.",
    conversationHistory: [
      {
        role: "user",
        content: "Hello",
      },
    ],
    enableMemoryRetrieval: true,
    memorySearchLimit: 5,
    model: "test-model",
  });

      expect(response.status).toBe(200);

      expect(fakes.ask).toHaveBeenCalledWith({
  userId: "user-a",
  message: "What do you remember?",
  conversationId: "conversation-a",
  systemPrompt: "Be concise.",
  conversationHistory: [
    {
      role: "user",
      content: "Hello",
    },
  ],
  enableMemoryRetrieval: true,
  memorySearchLimit: 5,
  model: "test-model",
});
    });

    it("rejects an empty message", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "   ",
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MESSAGE",
          message: "Message is required.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });
  });
});