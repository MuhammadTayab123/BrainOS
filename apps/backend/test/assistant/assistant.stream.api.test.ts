import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";
import { AssistantRuntime } from "../../src/services/assistant/assistant.runtime";
import { streamAssistant } from "../../src/controllers/assistant/assistant.controller";

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
    userId: "clerk-stream-user",
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

const testUser = {
  id: "user-stream-a",
  clerkId: "clerk-stream-user",
  email: "stream-user@example.test",
  firstName: "Stream",
  lastName: "User",
  imageUrl: null,
};

function parseSseEvents(raw: string): Array<{ event: string; data: any }> {
  const events: Array<{ event: string; data: any }> = [];
  const blocks = raw.split("\n\n").map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    let eventName = "message";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventName = line.substring("event: ".length).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.substring("data: ".length).trim();
      }
    }

    let parsedData: unknown = dataStr;
    try {
      parsedData = JSON.parse(dataStr);
    } catch {
      // keep string
    }

    events.push({ event: eventName, data: parsedData });
  }

  return events;
}

describe("Assistant SSE Streaming API (POST /api/v1/assistant/stream)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.authenticatedUser.mockResolvedValue(testUser);

    fakes.ask.mockImplementation(async (input: { runtime?: AssistantRuntime; signal?: AbortSignal }) => {
      if (input.runtime) {
        input.runtime.setState("THINKING");
        input.runtime.startTask("task-123");
        input.runtime.progressTask("task-123", "Executing test tool.");
        input.runtime.completeTask("task-123", "Test tool completed.");
        input.runtime.setState("SPEAKING");
        input.runtime.emitTextDelta("This is ");
        input.runtime.emitTextDelta("the final ");
        input.runtime.emitTextDelta("assistant streaming response.");
        input.runtime.setState("IDLE");
      }

      return {
        text: "This is the final assistant streaming response.",
        model: "test-model",
        provider: "test-provider",
        retrievedMemories: [],
        retrievedDocuments: [],
      };
    });
  });

  describe("1. SSE Headers", () => {
    it("returns correct SSE headers on successful stream request", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({ message: "Hello stream" });

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/event-stream/);
      expect(response.headers["cache-control"]).toMatch(/no-cache/);
      expect(response.headers["connection"]).toBe("keep-alive");
      expect(response.headers["x-accel-buffering"]).toBe("no");
    });
  });

  describe("2. Authentication Rejection", () => {
    it("returns 401 JSON error when unauthenticated without establishing SSE stream", async () => {
      fakes.authenticatedUser.mockRejectedValueOnce(new UnauthorizedError());

      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({ message: "Hello stream" });

      expect(response.status).toBe(401);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
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

  describe("3. Validation Rejection", () => {
    it("returns 400 JSON when message is missing or empty", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({ message: "   " });

      expect(response.status).toBe(400);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MESSAGE",
          message: "Message is required.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });

    it("returns 400 JSON when parameters are invalid", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({
          message: "Valid message",
          memorySearchLimit: 100, // max is 50
        });

      expect(response.status).toBe(400);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MEMORY_SEARCH_LIMIT",
          message: "memorySearchLimit must be an integer between 1 and 50.",
        },
      });

      expect(fakes.ask).not.toHaveBeenCalled();
    });
  });

  describe("4. Event Ordering & Authenticated Streaming Flow", () => {
    it("emits expected SSE events in exact order: state_changed, task_event, response, done", async () => {
      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({ message: "Run task" });

      expect(response.status).toBe(200);

      const events = parseSseEvents(response.text);
      expect(events.length).toBeGreaterThanOrEqual(6);

      // 1. Initial subscription state
      expect(events[0].event).toBe("state_changed");
      expect(events[0].data).toEqual({ state: "IDLE", activeTaskId: null });

      // 2. State transition to THINKING
      expect(events[1].event).toBe("state_changed");
      expect(events[1].data).toEqual({ state: "THINKING", activeTaskId: null });

      // 3. Task events during tool execution
      const taskStarted = events.find(
        (e) => e.event === "task_event" && e.data.type === "TASK_STARTED",
      );
      expect(taskStarted).toBeDefined();
      expect(taskStarted?.data.taskId).toBe("task-123");

      const taskProgress = events.find(
        (e) => e.event === "task_event" && e.data.type === "TASK_PROGRESS",
      );
      expect(taskProgress).toBeDefined();
      expect(taskProgress?.data.message).toBe("Executing test tool.");

      const taskCompleted = events.find(
        (e) => e.event === "task_event" && e.data.type === "TASK_COMPLETED",
      );
      expect(taskCompleted).toBeDefined();

      // 4. Text delta events must be emitted in sequence before response and done
      const textDeltaEvents = events.filter((e) => e.event === "text_delta");
      expect(textDeltaEvents).toHaveLength(3);
      expect(textDeltaEvents.map((e) => e.data.delta)).toEqual([
        "This is ",
        "the final ",
        "assistant streaming response.",
      ]);

      const firstTextDeltaIndex = events.findIndex((e) => e.event === "text_delta");
      const lastTextDeltaIndex = events.map((e) => e.event).lastIndexOf("text_delta");
      const responseIndex = events.findIndex((e) => e.event === "response");
      const doneIndex = events.findIndex((e) => e.event === "done");

      expect(firstTextDeltaIndex).toBeGreaterThan(-1);
      expect(responseIndex).toBeGreaterThan(lastTextDeltaIndex);
      expect(doneIndex).toBeGreaterThan(responseIndex);

      expect(events[responseIndex].data).toEqual({
        text: "This is the final assistant streaming response.",
        model: "test-model",
        provider: "test-provider",
        retrievedMemories: [],
        retrievedDocuments: [],
      });

      expect(events[doneIndex].data).toEqual({});
    });
  });

  describe("5. Error Handling & Sanitization", () => {
    it("emits sanitized error event followed by done event when orchestration fails", async () => {
      fakes.ask.mockRejectedValueOnce(
        new Error("Conversation not found for the authenticated user."),
      );

      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({ message: "Hello with error" });

      expect(response.status).toBe(200);

      const events = parseSseEvents(response.text);
      const errorIndex = events.findIndex((e) => e.event === "error");
      const doneIndex = events.findIndex((e) => e.event === "done");

      expect(errorIndex).toBeGreaterThan(-1);
      expect(doneIndex).toBeGreaterThan(errorIndex);

      expect(events[errorIndex].data).toEqual({
        message: "Conversation not found for the authenticated user.",
      });
      expect(events[doneIndex].data).toEqual({});
    });

    it("sanitizes sensitive/internal error messages", async () => {
      fakes.ask.mockRejectedValueOnce(
        new Error("PrismaClientKnownRequestError: connection DATABASE_URL failed"),
      );

      const response = await request(app)
        .post("/api/v1/assistant/stream")
        .send({ message: "Crash DB" });

      expect(response.status).toBe(200);

      const events = parseSseEvents(response.text);
      const errorEvent = events.find((e) => e.event === "error");

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.message).toBe("An internal server error occurred.");
      expect(response.text).not.toContain("DATABASE_URL");
      expect(response.text).not.toContain("PrismaClient");
    });
  });

  describe("6. Request Disconnect & Cleanup", () => {
    it("unsubscribes and cleans up safely when client disconnects early", async () => {
      const mockReq = new EventEmitter() as any;
      mockReq.user = testUser;
      mockReq.body = { message: "Test disconnect" };

      const written: string[] = [];
      const mockRes = {
        setHeader: vi.fn(),
        flushHeaders: vi.fn(),
        write: vi.fn((chunk: string) => written.push(chunk)),
        end: vi.fn(),
        writableEnded: false,
      } as any;

      let capturedRuntime: AssistantRuntime | undefined;
      let capturedSignal: AbortSignal | undefined;
      fakes.ask.mockImplementationOnce(
        async (input: { runtime?: AssistantRuntime; signal?: AbortSignal }) => {
          capturedRuntime = input.runtime;
          capturedSignal = input.signal;

          // Simulate client disconnect mid-stream
          mockReq.emit("close");

          // Further runtime calls after disconnect
          if (capturedRuntime) {
            capturedRuntime.startTask("task-after-close");
          }

          return {
            text: "Ignored text",
            model: "model",
            provider: "provider",
            retrievedMemories: [],
            retrievedDocuments: [],
          };
        },
      );

      await streamAssistant(mockReq, mockRes);

      // Verify abort signal was received and triggered
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(true);

      // Writes after disconnect should not be sent
      const postDisconnectWrites = written.filter((w) =>
        w.includes("task-after-close"),
      );
      expect(postDisconnectWrites).toHaveLength(0);
      expect(mockRes.end).not.toHaveBeenCalled();
    });
  });

  describe("7. Concurrent / Request Runtime Isolation", () => {
    it("allocates isolated runtime per streaming request without cross-user event leakage", async () => {
      const runtimes: AssistantRuntime[] = [];

      fakes.ask.mockImplementation(async (input: { runtime?: AssistantRuntime }) => {
        if (input.runtime) {
          runtimes.push(input.runtime);
        }
        return {
          text: "ok",
          model: "m",
          provider: "p",
          retrievedMemories: [],
          retrievedDocuments: [],
        };
      });

      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/v1/assistant/stream")
          .send({ message: "Request 1" }),
        request(app)
          .post("/api/v1/assistant/stream")
          .send({ message: "Request 2" }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      expect(runtimes).toHaveLength(2);
      expect(runtimes[0]).not.toBe(runtimes[1]); // completely distinct instances
    });
  });
});
