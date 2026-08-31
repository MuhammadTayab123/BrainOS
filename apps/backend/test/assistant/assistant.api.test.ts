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

const documentSource = {
  id: "chunk-a",
  documentId: "document-a",
  documentTitle: "BrainOS Notes",
  sourceType: "TEXT",
  source: null,
  chunkIndex: 0,
  content: "BrainOS is a personal AI operating system.",
  similarity: 0.87,
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
      retrievedDocuments: [],
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
          retrievedDocuments: [],
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
        enableDocumentRetrieval: undefined,
        documentSearchLimit: undefined,
        model: undefined,
        authorizedComputerActions: undefined,
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
          enableDocumentRetrieval: true,
          documentSearchLimit: 10,
          model: "test-model",
          authorizedComputerActions: [
            "computer_write_file",
            "computer_launch_application",
          ],
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
        enableDocumentRetrieval: true,
        documentSearchLimit: 10,
        model: "test-model",
        authorizedComputerActions: [
          "computer_write_file",
          "computer_launch_application",
        ],
      });
    });

    it("passes document retrieval parameters through", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "What does my document say about BrainOS?",
          enableDocumentRetrieval: true,
          documentSearchLimit: 7,
        });

      expect(response.status).toBe(200);

      expect(fakes.ask).toHaveBeenCalledWith({
        userId: "user-a",
        message: "What does my document say about BrainOS?",
        conversationId: undefined,
        systemPrompt: undefined,
        conversationHistory: undefined,
        enableMemoryRetrieval: undefined,
        memorySearchLimit: undefined,
        enableDocumentRetrieval: true,
        documentSearchLimit: 7,
        model: undefined,
        authorizedComputerActions: undefined,
      });
    });

    it("returns retrieved document sources", async () => {
      fakes.ask.mockResolvedValueOnce({
        text: "BrainOS is a personal AI operating system.",
        model: "test-model",
        provider: "test",
        retrievedMemories: [],
        retrievedDocuments: [documentSource],
      });

      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "What is BrainOS?",
          enableDocumentRetrieval: true,
          documentSearchLimit: 5,
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          text: "BrainOS is a personal AI operating system.",
          model: "test-model",
          provider: "test",
          retrievedMemories: [],
          retrievedDocuments: [documentSource],
        },
      });
    });

    it("accepts an empty authorizedComputerActions array", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          authorizedComputerActions: [],
        });

      expect(response.status).toBe(200);

      expect(fakes.ask).toHaveBeenCalledWith({
        userId: "user-a",
        message: "Hello BrainOS",
        conversationId: undefined,
        systemPrompt: undefined,
        conversationHistory: undefined,
        enableMemoryRetrieval: undefined,
        memorySearchLimit: undefined,
        enableDocumentRetrieval: undefined,
        documentSearchLimit: undefined,
        model: undefined,
        authorizedComputerActions: [],
      });
    });

    it("trims authorizedComputerActions strings before passing to AssistantService", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          authorizedComputerActions: [
            "  computer_write_file  ",
            " computer_launch_application ",
          ],
        });

      expect(response.status).toBe(200);

      expect(fakes.ask).toHaveBeenCalledWith({
        userId: "user-a",
        message: "Hello BrainOS",
        conversationId: undefined,
        systemPrompt: undefined,
        conversationHistory: undefined,
        enableMemoryRetrieval: undefined,
        memorySearchLimit: undefined,
        enableDocumentRetrieval: undefined,
        documentSearchLimit: undefined,
        model: undefined,
        authorizedComputerActions: [
          "computer_write_file",
          "computer_launch_application",
        ],
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

    it("rejects an invalid conversationId", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          conversationId: "   ",
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_CONVERSATION_ID",
          message:
            "conversationId must be a non-empty string.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an invalid systemPrompt", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          systemPrompt: 123,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_SYSTEM_PROMPT",
          message: "systemPrompt must be a string.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an invalid memory retrieval flag", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          enableMemoryRetrieval: "true",
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MEMORY_RETRIEVAL",
          message:
            "enableMemoryRetrieval must be a boolean.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an invalid memory search limit", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          memorySearchLimit: 51,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MEMORY_SEARCH_LIMIT",
          message:
            "memorySearchLimit must be an integer between 1 and 50.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an invalid document retrieval flag", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          enableDocumentRetrieval: "true",
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_DOCUMENT_RETRIEVAL",
          message:
            "enableDocumentRetrieval must be a boolean.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an invalid document search limit", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          documentSearchLimit: 21,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_DOCUMENT_SEARCH_LIMIT",
          message:
            "documentSearchLimit must be an integer between 1 and 20.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an invalid model", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          model: 123,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MODEL",
          message: "model must be a string.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects a non-array authorizedComputerActions", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          authorizedComputerActions: "computer_write_file",
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_AUTHORIZED_COMPUTER_ACTIONS",
          message:
            "authorizedComputerActions must be an array of non-empty strings.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an authorizedComputerActions array containing non-string items", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          authorizedComputerActions: [123],
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_AUTHORIZED_COMPUTER_ACTIONS",
          message:
            "authorizedComputerActions must be an array of non-empty strings.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("rejects an authorizedComputerActions array containing empty or whitespace strings", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/ask")
        .send({
          message: "Hello BrainOS",
          authorizedComputerActions: ["   "],
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_AUTHORIZED_COMPUTER_ACTIONS",
          message:
            "authorizedComputerActions must be an array of non-empty strings.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });
  });
});