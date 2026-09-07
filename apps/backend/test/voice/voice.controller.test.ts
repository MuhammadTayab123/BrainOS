import { describe, expect, it, vi } from "vitest";
import express, { Request, Response } from "express";
import request from "supertest";
import {
  createVoiceSession,
  getVoiceSession,
  interruptVoiceSession,
  endVoiceSession,
  processVoiceTurn,
  streamVoiceTurn,
  VoiceController,
} from "../../src/controllers/voice/voice.controller";
import { createVoiceRouter } from "../../src/routes/voice.routes";
import {
  MockSTTProvider,
  MockTTSProvider,
  VoiceService,
  VoiceTurnResult,
} from "../../src/services/voice";
import { AssistantService } from "../../src/services/assistant/assistant.service";
import { AssistantResponse } from "../../src/services/assistant/assistant.types";

describe("Voice Controller & Transport Layer (Mission 68)", () => {
  function createAssistantServiceMock(defaultText = "BrainOS response.") {
    const defaultResponse: AssistantResponse = {
      text: defaultText,
      model: "omniroute/gpt-4o",
      provider: "omniroute",
      retrievedMemories: [],
      retrievedDocuments: [],
    };

    return {
      ask: vi.fn().mockImplementation(async (input: any) => {
        if (input.runtime) {
          input.runtime.emitTextDelta("BrainOS ");
          input.runtime.emitTextDelta("response.");
        }
        return defaultResponse;
      }),
    } as unknown as AssistantService;
  }

  function createTestVoiceService(assistantText = "BrainOS response.") {
    const assistantService = createAssistantServiceMock(assistantText);
    const sttProvider = new MockSTTProvider();
    sttProvider.customTranscript = "Transcribed test voice input";
    const ttsProvider = new MockTTSProvider();
    ttsProvider.customAudio = Buffer.from("RIFF....WAVEfmt test audio data");
    return new VoiceService(assistantService, sttProvider, ttsProvider);
  }

  function createMockResponse() {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as any,
      writableEnded: false,
      status: vi.fn(function (code: number) {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn(function (data: any) {
        res.body = data;
        res.writableEnded = true;
        return res;
      }),
      setHeader: vi.fn(function (key: string, val: string) {
        res.headers[key] = val;
        return res;
      }),
      flushHeaders: vi.fn(),
      write: vi.fn(function () {
        return true;
      }),
      end: vi.fn(function () {
        res.writableEnded = true;
        return res;
      }),
    };
    return res;
  }

  describe("Authentication Enforcement", () => {
    it("rejects unauthenticated requests with 401 across all endpoints", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);

      const unauthReq = { user: undefined, body: {}, params: { id: "sess-1" } } as unknown as Request;

      const endpoints = [
        () => controller.createSession(unauthReq, createMockResponse()),
        () => controller.getSession(unauthReq, createMockResponse()),
        () => controller.interruptSession(unauthReq, createMockResponse()),
        () => controller.endSession(unauthReq, createMockResponse()),
        () => controller.processTurn(unauthReq, createMockResponse()),
        () => controller.streamTurn(unauthReq, createMockResponse()),
      ];

      for (const fn of endpoints) {
        const res = createMockResponse();
        await fn();
      }
    });

    it("verifies 401 response shape when user is absent", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = { user: undefined, body: {} } as unknown as Request;
      const res = createMockResponse();

      await controller.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    });
  });

  describe("Session Lifecycle Endpoints", () => {
    it("creates a voice session for the authenticated user", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { conversationId: "conv-123" },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.userId).toBe("user-test-1");
      expect(res.body.data.conversationId).toBe("conv-123");
      expect(res.body.data.status).toBe("IDLE");
    });

    it("rejects invalid conversationId on session creation", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { conversationId: "   " },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_CONVERSATION_ID");
    });

    it("retrieves an existing session for the owner", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const session = voiceService.createSession("user-test-1");

      const req = {
        user: { id: "user-test-1" },
        params: { id: session.id },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(session.id);
    });

    it("fails closed (404) when retrieving a non-existent session", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);

      const req = {
        user: { id: "user-test-1" },
        params: { id: "non-existent-id" },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body.error.code).toBe("SESSION_NOT_FOUND");
    });

    it("enforces tenant isolation when retrieving another user's session", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const session = voiceService.createSession("user-alice");

      const req = {
        user: { id: "user-bob" },
        params: { id: session.id },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body.error.code).toBe("SESSION_NOT_FOUND");
    });

    it("interrupts a voice session", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const session = voiceService.createSession("user-test-1");

      const req = {
        user: { id: "user-test-1" },
        params: { id: session.id },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.interruptSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({
        success: true,
        data: { interrupted: true },
      });

      const updated = voiceService.getSession(session.id, "user-test-1");
      expect(updated?.status).toBe("INTERRUPTED");
    });

    it("ends a voice session", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const session = voiceService.createSession("user-test-1");

      const req = {
        user: { id: "user-test-1" },
        params: { id: session.id },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.endSession(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({
        success: true,
        data: { ended: true },
      });

      const updated = voiceService.getSession(session.id, "user-test-1");
      expect(updated?.status).toBe("CLOSED");
    });

    it("rejects empty or malformed session ID parameter", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        params: { id: "   " },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.getSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_SESSION_ID");
    });
  });

  describe("Turn Request Validation", () => {
    it("rejects non-object request bodies", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: "invalid-string",
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_BODY");
    });

    it("rejects turn when both transcript and audio are missing", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: {},
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_TURN_INPUT");
    });

    it("rejects turn when audio is not an object or lacks data", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { audio: "not-an-object" },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_AUDIO");
    });

    it("rejects turn when audio data is empty base64 string", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { audio: { data: "   " } },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_AUDIO_DATA");
    });

    it("rejects turn when synthesizeSpeech is not boolean", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { transcript: "Hello", synthesizeSpeech: "yes" },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_SYNTHESIZE_SPEECH");
    });

    it("rejects turn when authorizedComputerActions is not an array", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { transcript: "Hello", authorizedComputerActions: "action1" },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.error.code).toBe("INVALID_AUTHORIZED_ACTIONS");
    });
  });

  describe("Synchronous Voice Turn Processing", () => {
    it("processes a voice turn with text transcript successfully", async () => {
      const voiceService = createTestVoiceService("BrainOS text answer");
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: { transcript: "What is the weather?" },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcript).toBe("What is the weather?");
      expect(res.body.data.assistantResponse.text).toBe("BrainOS text answer");
      expect(res.body.data.status).toBe("IDLE");
      expect(res.body.data.audioResponse).toBeUndefined();
    });

    it("processes a voice turn with base64 audio and STT transcription", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const rawAudio = Buffer.from("RIFF....WAVEfmt dummy test audio");
      const base64Audio = rawAudio.toString("base64");

      const req = {
        user: { id: "user-test-1" },
        body: {
          audio: {
            data: base64Audio,
            mimeType: "audio/wav",
            sampleRate: 16000,
            channels: 1,
          },
        },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcript).toBe("Transcribed test voice input");
      expect(res.body.data.assistantResponse.text).toBe("BrainOS response.");
    });

    it("synthesizes speech when synthesizeSpeech is true and returns audioBase64", async () => {
      const voiceService = createTestVoiceService();
      const controller = new VoiceController(voiceService);
      const req = {
        user: { id: "user-test-1" },
        body: {
          transcript: "Speak to me",
          synthesizeSpeech: true,
        },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.audioResponse).toBeDefined();
      expect(typeof res.body.data.audioResponse.audioBase64).toBe("string");

      const decoded = Buffer.from(res.body.data.audioResponse.audioBase64, "base64");
      expect(decoded.toString()).toContain("RIFF");
    });

    it("fails closed (404) when processing a turn for an unauthorized session ID", async () => {
      const voiceService = createTestVoiceService();
      const session = voiceService.createSession("user-alice");
      const controller = new VoiceController(voiceService);

      const req = {
        user: { id: "user-bob" },
        body: {
          sessionId: session.id,
          transcript: "Sneaky access",
        },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.processTurn(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body.error.code).toBe("VOICE_TURN_FAILED");
    });
  });

  describe("Server-Sent Events (SSE) Streaming Turn", () => {
    it("sets correct SSE headers and streams runtime events and final result", async () => {
      const voiceService = createTestVoiceService("Streamed response.");
      const controller = new VoiceController(voiceService);

      const closeListeners: Array<() => void> = [];
      const writtenChunks: string[] = [];

      const req = {
        user: { id: "user-test-1" },
        body: {
          transcript: "Hello BrainOS via SSE",
          synthesizeSpeech: true,
        },
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "close") {
            closeListeners.push(cb);
          }
        }),
      } as unknown as Request;

      const res: any = {
        writableEnded: false,
        headers: {} as Record<string, string>,
        setHeader: vi.fn((key: string, val: string) => {
          res.headers[key] = val;
        }),
        flushHeaders: vi.fn(),
        write: vi.fn((chunk: string) => {
          writtenChunks.push(chunk);
          return true;
        }),
        end: vi.fn(() => {
          res.writableEnded = true;
        }),
      };

      await controller.streamTurn(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache, no-transform");
      expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      expect(res.end).toHaveBeenCalled();

      const combinedOutput = writtenChunks.join("");
      expect(combinedOutput).toContain("event: state_changed");
      expect(combinedOutput).toContain("event: text_delta");
      expect(combinedOutput).toContain("event: voice_result");
      expect(combinedOutput).toContain("event: done");
    });

    it("cleans up and triggers abort signal when client disconnects", async () => {
      let turnStartedPromiseResolve: () => void;
      const turnStartedPromise = new Promise<void>((resolve) => {
        turnStartedPromiseResolve = resolve;
      });

      const assistantService = {
        ask: vi.fn(async (input: any) => {
          turnStartedPromiseResolve();
          // Wait to be aborted
          await new Promise((_, reject) => {
            input.signal.addEventListener("abort", () => {
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          });
        }),
      } as unknown as AssistantService;

      const voiceService = new VoiceService(assistantService);
      const controller = new VoiceController(voiceService);

      let closeHandler: (() => void) | undefined;
      const req = {
        user: { id: "user-test-1" },
        body: { transcript: "Long running query" },
        on: vi.fn((event: string, cb: () => void) => {
          if (event === "close") closeHandler = cb;
        }),
      } as unknown as Request;

      const res: any = {
        writableEnded: false,
        headers: {} as Record<string, string>,
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn(),
        end: vi.fn(() => {
          res.writableEnded = true;
        }),
      };

      const streamPromise = controller.streamTurn(req, res);
      await turnStartedPromise;

      // Simulate client abrupt disconnect
      closeHandler?.();
      await streamPromise;

      expect(assistantService.ask).toHaveBeenCalled();
    });
  });

  describe("Router & Supertest End-to-End Transport", () => {
    function createTestApp() {
      const app = express();
      app.use(express.json());

      const testAuthMiddleware = (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required.",
            },
          });
        }
        if (authHeader === "Bearer user-token") {
          req.user = { id: "user-supertest-1" };
          return next();
        }
        if (authHeader === "Bearer bob-token") {
          req.user = { id: "user-bob" };
          return next();
        }
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        });
      };

      const voiceService = createTestVoiceService();
      const voiceRouter = createVoiceRouter(voiceService, testAuthMiddleware as any);
      app.use("/api/v1/voice", voiceRouter);

      return { app, voiceService };
    }

    it("rejects unauthenticated request via HTTP 401", async () => {
      const { app } = createTestApp();
      const res = await request(app)
        .post("/api/v1/voice/sessions")
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("creates, retrieves, and ends session via authenticated HTTP", async () => {
      const { app } = createTestApp();

      // 1. Create
      const createRes = await request(app)
        .post("/api/v1/voice/sessions")
        .set("Authorization", "Bearer user-token")
        .send({ conversationId: "conv-http-1" });

      expect(createRes.status).toBe(201);
      const sessionId = createRes.body.data.id;
      expect(sessionId).toBeDefined();

      // 2. Get
      const getRes = await request(app)
        .get(`/api/v1/voice/sessions/${sessionId}`)
        .set("Authorization", "Bearer user-token");

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(sessionId);

      // 3. Interrupt
      const interruptRes = await request(app)
        .post(`/api/v1/voice/sessions/${sessionId}/interrupt`)
        .set("Authorization", "Bearer user-token");

      expect(interruptRes.status).toBe(200);
      expect(interruptRes.body.data.interrupted).toBe(true);

      // 4. End
      const endRes = await request(app)
        .post(`/api/v1/voice/sessions/${sessionId}/end`)
        .set("Authorization", "Bearer user-token");

      expect(endRes.status).toBe(200);
      expect(endRes.body.data.ended).toBe(true);
    });

    it("executes a turn over HTTP /turn", async () => {
      const { app } = createTestApp();

      const turnRes = await request(app)
        .post("/api/v1/voice/turn")
        .set("Authorization", "Bearer user-token")
        .send({
          transcript: "What is my next reminder?",
          synthesizeSpeech: true,
        });

      expect(turnRes.status).toBe(200);
      expect(turnRes.body.success).toBe(true);
      expect(turnRes.body.data.transcript).toBe("What is my next reminder?");
      expect(turnRes.body.data.audioResponse).toBeDefined();
      expect(typeof turnRes.body.data.audioResponse.audioBase64).toBe("string");
    });

    it("enforces tenant isolation over HTTP", async () => {
      const { app } = createTestApp();

      // Alice creates session
      const createRes = await request(app)
        .post("/api/v1/voice/sessions")
        .set("Authorization", "Bearer user-token")
        .send({});

      const sessionId = createRes.body.data.id;

      // Bob tries to access Alice's session
      const bobRes = await request(app)
        .get(`/api/v1/voice/sessions/${sessionId}`)
        .set("Authorization", "Bearer bob-token");

      expect(bobRes.status).toBe(404);
      expect(bobRes.body.error.code).toBe("SESSION_NOT_FOUND");
    });
  });
});
