import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  askAssistant: vi.fn(),
}));

let currentAuthUser: { id: string; email?: string } | null = {
  id: "user-test-payload",
  email: "voice-test@brainos.test",
};

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
  getAuth: () => ({
    userId: currentAuthUser ? currentAuthUser.id : null,
    sessionId: currentAuthUser ? "test-session" : null,
    isAuthenticated: Boolean(currentAuthUser),
  }),
}));

vi.mock("../../src/services/auth/auth.service", () => ({
  getAuthenticatedUser: async () => {
    if (!currentAuthUser) {
      const { UnauthorizedError } = await import("../../src/errors");
      throw new UnauthorizedError("Authentication required.");
    }
    return currentAuthUser;
  },
}));

vi.mock("../../src/services/assistant/assistant.service", () => ({
  AssistantService: class {
    ask(input: unknown) {
      return fakes.askAssistant(input);
    }
  },
}));

import app from "../../src/app";

describe("Voice & Global JSON Payload Limit Integration (app.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAuthUser = {
      id: "user-test-payload",
      email: "voice-test@brainos.test",
    };

    fakes.askAssistant.mockResolvedValue({
      text: "Assistant processed voice turn.",
      model: "mock-model",
      provider: "mock-provider",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });

  describe("1. Global 100 KB limit for non-voice JSON routes", () => {
    it("rejects >100 KB JSON payloads on non-voice APIs with HTTP 413 PAYLOAD_TOO_LARGE", async () => {
      // 110 KB string payload (>100 KB)
      const oversizedPayload = {
        message: "A".repeat(110 * 1024),
      };

      const res = await request(app)
        .post("/api/v1/assistant/ask")
        .set("Content-Type", "application/json")
        .send(oversizedPayload);

      expect(res.status).toBe(413);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Request payload exceeds size limit.",
        },
      });
    });

    it("accepts normal <=100 KB JSON payloads on non-voice APIs", async () => {
      const normalPayload = {
        message: "What is the weather today?",
      };

      const res = await request(app)
        .post("/api/v1/assistant/ask")
        .set("Content-Type", "application/json")
        .send(normalPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("2. Authenticated Voice Turn allows controlled larger payloads (~147 KB audio)", () => {
    it("accepts a ~147 KB base64 audio payload on POST /api/v1/voice/turn", async () => {
      // 110 KB raw bytes -> ~147 KB base64 string
      const rawAudio = Buffer.alloc(110 * 1024, 0x5a);
      const audioBase64 = rawAudio.toString("base64");
      expect(audioBase64.length).toBeGreaterThan(140 * 1024);

      const res = await request(app)
        .post("/api/v1/voice/turn")
        .send({
          audio: {
            data: audioBase64,
            mimeType: "audio/webm",
          },
          synthesizeSpeech: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcript).toBeDefined();
    });

    it("accepts a ~147 KB base64 audio payload on POST /api/v1/voice/turn/stream", async () => {
      const rawAudio = Buffer.alloc(110 * 1024, 0x5a);
      const audioBase64 = rawAudio.toString("base64");

      const res = await request(app)
        .post("/api/v1/voice/turn/stream")
        .send({
          audio: {
            data: audioBase64,
            mimeType: "audio/webm",
          },
          synthesizeSpeech: false,
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");
    });
  });

  describe("3. Unauthenticated Voice requests fail closed before body parsing", () => {
    it("rejects unauthenticated large payloads on POST /api/v1/voice/turn with HTTP 401", async () => {
      currentAuthUser = null;

      const rawAudio = Buffer.alloc(110 * 1024, 0x5a);
      const audioBase64 = rawAudio.toString("base64");

      const res = await request(app)
        .post("/api/v1/voice/turn")
        .send({
          audio: {
            data: audioBase64,
            mimeType: "audio/webm",
          },
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("4. Voice metadata endpoints remain limited to standard 100 KB", () => {
    it("rejects >100 KB payloads on POST /api/v1/voice/sessions with HTTP 413", async () => {
      const oversizedPayload = {
        conversationId: "C".repeat(110 * 1024),
      };

      const res = await request(app)
        .post("/api/v1/voice/sessions")
        .send(oversizedPayload);

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    });
  });
});
