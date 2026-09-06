import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest";

let streamAssistant: typeof import("./brainos-client-api").streamAssistant;
let listReminders: typeof import("./brainos-client-api").listReminders;
let createReminder: typeof import("./brainos-client-api").createReminder;
let getReminder: typeof import("./brainos-client-api").getReminder;
let cancelReminder: typeof import("./brainos-client-api").cancelReminder;
let deleteReminder: typeof import("./brainos-client-api").deleteReminder;
let listDocuments: typeof import("./brainos-client-api").listDocuments;
let uploadDocument: typeof import("./brainos-client-api").uploadDocument;
let createTextDocument: typeof import("./brainos-client-api").createTextDocument;
let getDocument: typeof import("./brainos-client-api").getDocument;
let deleteDocument: typeof import("./brainos-client-api").deleteDocument;
let searchDocuments: typeof import("./brainos-client-api").searchDocuments;
type AssistantStreamEvent = import("./brainos-client-api").AssistantStreamEvent;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_BRAINOS_API_URL = "http://localhost:3001";
  const mod = await import("./brainos-client-api");
  streamAssistant = mod.streamAssistant;
  listReminders = mod.listReminders;
  createReminder = mod.createReminder;
  getReminder = mod.getReminder;
  cancelReminder = mod.cancelReminder;
  deleteReminder = mod.deleteReminder;
  listDocuments = mod.listDocuments;
  uploadDocument = mod.uploadDocument;
  createTextDocument = mod.createTextDocument;
  getDocument = mod.getDocument;
  deleteDocument = mod.deleteDocument;
  searchDocuments = mod.searchDocuments;
});

describe("streamAssistant (Frontend SSE Client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;

    return new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  it("1. Full Streaming Flow: processes state_changed, task_event, response, and done events in order", async () => {
    const ssePayload = [
      'event: state_changed\ndata: {"state":"THINKING","activeTaskId":null}\n\n',
      'event: task_event\ndata: {"type":"TASK_STARTED","taskId":"task-1","message":"Executing search_memories.","timestamp":"2026-09-06T08:00:00.000Z"}\n\n',
      'event: task_event\ndata: {"type":"TASK_COMPLETED","taskId":"task-1","message":"search_memories completed.","timestamp":"2026-09-06T08:00:01.000Z"}\n\n',
      'event: state_changed\ndata: {"state":"SPEAKING","activeTaskId":null}\n\n',
      'event: response\ndata: {"text":"Hello, I retrieved your memories!","model":"test-model","provider":"test-provider","retrievedMemories":[]}\n\n',
      'event: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(ssePayload),
    });

    const events: AssistantStreamEvent[] = [];
    const result = await streamAssistant("mock-token", "Hello BrainOS", {
      conversationId: "conv-123",
      onEvent: (event) => events.push(event),
    });

    expect(result.text).toBe("Hello, I retrieved your memories!");
    expect(result.model).toBe("test-model");
    expect(result.provider).toBe("test-provider");

    expect(events).toHaveLength(6);
    expect(events[0]).toEqual({
      type: "state_changed",
      data: { state: "THINKING", activeTaskId: null },
    });
    expect(events[1]).toEqual({
      type: "task_event",
      data: {
        type: "TASK_STARTED",
        taskId: "task-1",
        message: "Executing search_memories.",
        timestamp: "2026-09-06T08:00:00.000Z",
      },
    });
    expect(events[2]).toEqual({
      type: "task_event",
      data: {
        type: "TASK_COMPLETED",
        taskId: "task-1",
        message: "search_memories completed.",
        timestamp: "2026-09-06T08:00:01.000Z",
      },
    });
    expect(events[3]).toEqual({
      type: "state_changed",
      data: { state: "SPEAKING", activeTaskId: null },
    });
    expect(events[4].type).toBe("response");
    expect(events[5]).toEqual({
      type: "done",
      data: {},
    });
  });

  it("2. Split Chunks / Frame Boundaries: correctly parses events fragmented across arbitrary chunk boundaries", async () => {
    // Deliberately split across arbitrary byte boundaries:
    // chunk 0: 'event: state_'
    // chunk 1: 'changed\nda'
    // chunk 2: 'ta: {"state":"THINKING"}\n\nevent: resp'
    // chunk 3: 'onse\ndata: {"text":"Fragmented response success","model":"m","provider":"p","retrievedMemories":[]}\n\nevent: done\ndata: {}\n\n'
    const fragmentedChunks = [
      "event: state_",
      "changed\nda",
      'ta: {"state":"THINKING","activeTaskId":null}\n\nevent: resp',
      'onse\ndata: {"text":"Fragmented response success","model":"m","provider":"p","retrievedMemories":[]}\n\nevent: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(fragmentedChunks),
    });

    const receivedTypes: string[] = [];
    const result = await streamAssistant("mock-token", "Fragment test", {
      onEvent: (event) => receivedTypes.push(event.type),
    });

    expect(result.text).toBe("Fragmented response success");
    expect(receivedTypes).toEqual(["state_changed", "response", "done"]);
  });

  it("3. HTTP Errors: rejects with server error message when HTTP response is not ok (e.g. 401)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: vi.fn().mockResolvedValue({
        error: { message: "Authentication required." },
      }),
    });

    await expect(
      streamAssistant("invalid-token", "Hello"),
    ).rejects.toThrow("Authentication required.");
  });

  it("4. SSE Error Event: rejects when backend emits an error event during streaming", async () => {
    const errorChunks = [
      'event: state_changed\ndata: {"state":"THINKING","activeTaskId":null}\n\n',
      'event: error\ndata: {"message":"Tool execution failed."}\n\n',
      'event: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(errorChunks),
    });

    const events: AssistantStreamEvent[] = [];
    await expect(
      streamAssistant("mock-token", "Error trigger", {
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toThrow("Tool execution failed.");

    expect(events.some((e) => e.type === "error")).toBe(true);
  });

  it("5. Client Cancellation: supports AbortController cancellation", async () => {
    const abortController = new AbortController();

    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      if (init?.signal?.aborted) {
        return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
      }

      const stream = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener("abort", () => {
            controller.error(new DOMException("The user aborted a request.", "AbortError"));
          });
        },
      });

      return Promise.resolve({
        ok: true,
        status: 200,
        body: stream,
      });
    });

    const promise = streamAssistant("mock-token", "Abort test", {
      signal: abortController.signal,
    });

    abortController.abort();

    await expect(promise).rejects.toThrow();
  });

  it("6. Premature Stream Closure: rejects if stream closes without emitting response or error", async () => {
    const incompleteChunks = [
      'event: state_changed\ndata: {"state":"THINKING","activeTaskId":null}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(incompleteChunks),
    });

    await expect(
      streamAssistant("mock-token", "Incomplete stream"),
    ).rejects.toThrow("Stream terminated without delivering a response.");
  });

  it("7. Token Streaming: processes text_delta events and delivers incremental deltas before final response", async () => {
    const ssePayload = [
      'event: state_changed\ndata: {"state":"THINKING","activeTaskId":null}\n\n',
      'event: state_changed\ndata: {"state":"SPEAKING","activeTaskId":null}\n\n',
      'event: text_delta\ndata: {"delta":"Hello "}\n\n',
      'event: text_delta\ndata: {"delta":"world"}\n\n',
      'event: text_delta\ndata: {"delta":"!"}\n\n',
      'event: response\ndata: {"text":"Hello world!","model":"m","provider":"p","retrievedMemories":[]}\n\n',
      'event: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(ssePayload),
    });

    const receivedEvents: AssistantStreamEvent[] = [];
    const receivedDeltas: string[] = [];

    const result = await streamAssistant("mock-token", "Stream tokens test", {
      onEvent: (event) => {
        receivedEvents.push(event);
        if (event.type === "text_delta") {
          receivedDeltas.push(event.data.delta);
        }
      },
    });

    expect(result.text).toBe("Hello world!");
    expect(receivedDeltas).toEqual(["Hello ", "world", "!"]);

    const textDeltaIndices = receivedEvents
      .map((e, idx) => (e.type === "text_delta" ? idx : -1))
      .filter((idx) => idx !== -1);
    const responseIndex = receivedEvents.findIndex((e) => e.type === "response");
    const doneIndex = receivedEvents.findIndex((e) => e.type === "done");

    expect(textDeltaIndices).toHaveLength(3);
    expect(responseIndex).toBeGreaterThan(textDeltaIndices[2]);
    expect(doneIndex).toBeGreaterThan(responseIndex);
  });

  it("8. Split text_delta Chunks: safely reconstructs text_delta frames split across network packets", async () => {
    const fragmentedChunks = [
      "event: text_",
      'delta\ndata: {"del',
      'ta":"Frag',
      'mented token"}\n\nevent: response\ndata: {"text":"Fragmented token","model":"m","provider":"p","retrievedMemories":[]}\n\nevent: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(fragmentedChunks),
    });

    const deltas: string[] = [];
    const result = await streamAssistant("mock-token", "Split delta test", {
      onEvent: (event) => {
        if (event.type === "text_delta") {
          deltas.push(event.data.delta);
        }
      },
    });

    expect(result.text).toBe("Fragmented token");
    expect(deltas).toEqual(["Fragmented token"]);
  });

  it("9. Multiple sequential deltas: accurately delivers individual tokens in exact arrival order", async () => {
    const tokens = ["The ", "quick ", "brown ", "fox ", "jumps."];
    const sseChunks = [
      ...tokens.map((t) => `event: text_delta\ndata: ${JSON.stringify({ delta: t })}\n\n`),
      'event: response\ndata: {"text":"The quick brown fox jumps.","model":"m","provider":"p","retrievedMemories":[]}\n\n',
      'event: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(sseChunks),
    });

    let accumulated = "";
    await streamAssistant("mock-token", "Quick fox", {
      onEvent: (event) => {
        if (event.type === "text_delta") {
          accumulated += event.data.delta;
        }
      },
    });

    expect(accumulated).toBe("The quick brown fox jumps.");
  });

  it("10. Memory & Retrieval Options: omits enableMemoryRetrieval by default so backend policy applies, while forwarding explicit options", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.body && typeof init.body === "string") {
        capturedBody = JSON.parse(init.body) as Record<string, unknown>;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        body: createMockReadableStream([
          'event: response\ndata: {"text":"ok","model":"m","provider":"p","retrievedMemories":[]}\n\n',
          'event: done\ndata: {}\n\n',
        ]),
      });
    });

    // Default call: without enableMemoryRetrieval option
    await streamAssistant("mock-token", "Remember this", {
      conversationId: "conv-test",
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody?.conversationId).toBe("conv-test");
    expect(capturedBody?.enableMemoryRetrieval).toBeUndefined();

    // Explicit override call: with enableMemoryRetrieval: false
    await streamAssistant("mock-token", "Do not remember", {
      conversationId: "conv-test-2",
      enableMemoryRetrieval: false,
    });

    expect(capturedBody?.conversationId).toBe("conv-test-2");
    expect(capturedBody?.enableMemoryRetrieval).toBe(false);
  });
});

describe("Reminders API (Frontend Client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. listReminders: queries with status, dueBefore, limit, and auth header", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                id: "rem-1",
                userId: "user-1",
                taskId: null,
                message: "Call dentist",
                scheduledFor: "2026-09-07T10:00:00.000Z",
                status: "PENDING",
                attempts: 0,
                deliveredAt: null,
                lastError: null,
                createdAt: "2026-09-06T10:00:00.000Z",
                updatedAt: "2026-09-06T10:00:00.000Z",
              },
            ],
          }),
      });
    });

    const dueDate = new Date("2026-09-08T00:00:00.000Z");
    const result = await listReminders("mock-token", {
      status: "PENDING",
      dueBefore: dueDate,
      limit: 10,
    });

    expect(capturedUrl).toContain("http://localhost:3001/api/v1/reminders?");
    expect(capturedUrl).toContain("status=PENDING");
    expect(capturedUrl).toContain(`dueBefore=${encodeURIComponent(dueDate.toISOString())}`);
    expect(capturedUrl).toContain("limit=10");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("Call dentist");
  });

  it("2. createReminder: sends POST request with trimmed message and ISO scheduled date", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "rem-2",
              userId: "user-1",
              taskId: "task-1",
              message: "Team meeting",
              scheduledFor: "2026-09-07T14:00:00.000Z",
              status: "PENDING",
              attempts: 0,
              deliveredAt: null,
              lastError: null,
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const scheduleDate = new Date("2026-09-07T14:00:00.000Z");
    const result = await createReminder("mock-token", {
      message: "  Team meeting  ",
      scheduledFor: scheduleDate,
      taskId: "task-1",
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/reminders");
    expect(capturedMethod).toBe("POST");
    expect(capturedBody.message).toBe("Team meeting");
    expect(capturedBody.scheduledFor).toBe(scheduleDate.toISOString());
    expect(capturedBody.taskId).toBe("task-1");
    expect(result.id).toBe("rem-2");
  });

  it("3. getReminder: sends GET request to encoded reminder ID", async () => {
    let capturedUrl = "";

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "rem-3",
              message: "Pay bills",
              status: "PENDING",
            },
          }),
      });
    });

    const result = await getReminder("mock-token", "rem/3?special");
    expect(capturedUrl).toBe(`http://localhost:3001/api/v1/reminders/${encodeURIComponent("rem/3?special")}`);
    expect(result.id).toBe("rem-3");
  });

  it("4. cancelReminder: sends POST request to cancel endpoint and returns updated status", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "rem-4",
              status: "CANCELLED",
            },
          }),
      });
    });

    const result = await cancelReminder("mock-token", "rem-4");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/reminders/rem-4/cancel");
    expect(capturedMethod).toBe("POST");
    expect(result.status).toBe("CANCELLED");
  });

  it("5. deleteReminder: sends DELETE request to reminder endpoint", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "rem-5",
            },
          }),
      });
    });

    const result = await deleteReminder("mock-token", "rem-5");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/reminders/rem-5");
    expect(capturedMethod).toBe("DELETE");
    expect(result.id).toBe("rem-5");
  });

  it("6. Error handling: throws formatted error on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "INVALID_SCHEDULED_FOR",
            message: "Reminder scheduled time must be a valid date.",
          },
        }),
    });

    await expect(
      createReminder("mock-token", {
        message: "Bad date",
        scheduledFor: "invalid",
      }),
    ).rejects.toThrow("Reminder scheduled time must be a valid date.");
  });
});

describe("Documents API (Frontend Client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. listDocuments: sends GET request with Bearer token and optional query params", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                id: "doc-1",
                title: "Test Doc",
                sourceType: "TEXT",
                source: null,
                content: "Sample content",
                mimeType: "text/plain",
                status: "READY",
                createdAt: "2026-09-06T10:00:00.000Z",
                updatedAt: "2026-09-06T10:00:00.000Z",
              },
            ],
          }),
      });
    });

    const result = await listDocuments("mock-token", { status: "READY", limit: 10 });
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents?status=READY&limit=10");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("doc-1");
    expect(result[0].status).toBe("READY");
  });

  it("2. uploadDocument: sends FormData with title, sourceType=UPLOAD, and file without manual Content-Type", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: unknown;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "doc-uploaded-1",
              title: "Manual.pdf",
              sourceType: "UPLOAD",
              source: "Manual.pdf",
              content: null,
              mimeType: "application/pdf",
              status: "READY",
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const mockFile = new File(["dummy pdf content"], "Manual.pdf", { type: "application/pdf" });
    const result = await uploadDocument("mock-token", {
      title: "Manual.pdf",
      file: mockFile,
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    // CRITICAL: Do NOT manually set Content-Type header on multipart upload
    expect(capturedHeaders["Content-Type"]).toBeUndefined();

    expect(capturedBody).toBeInstanceOf(FormData);
    const formData = capturedBody as FormData;
    expect(formData.get("title")).toBe("Manual.pdf");
    expect(formData.get("sourceType")).toBe("UPLOAD");
    expect(formData.get("file")).toBe(mockFile);

    expect(result.id).toBe("doc-uploaded-1");
    expect(result.status).toBe("READY");
  });

  it("3. createTextDocument: sends JSON payload with title, sourceType=TEXT, and content", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body as string;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "doc-text-1",
              title: "My Notes",
              sourceType: "TEXT",
              source: null,
              content: "Note content",
              mimeType: null,
              status: "READY",
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const result = await createTextDocument("mock-token", {
      title: "My Notes",
      content: "Note content",
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(JSON.parse(capturedBody)).toEqual({
      title: "My Notes",
      sourceType: "TEXT",
      content: "Note content",
    });
    expect(result.id).toBe("doc-text-1");
  });

  it("4. getDocument: encodes documentId and sends GET request with Bearer auth", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "doc/special-id#1",
              title: "Special Doc",
              sourceType: "TEXT",
              source: null,
              content: "Detail content",
              mimeType: null,
              status: "READY",
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const result = await getDocument("mock-token", "doc/special-id#1");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents/doc%2Fspecial-id%231");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("doc/special-id#1");
  });

  it("5. deleteDocument: encodes documentId and sends DELETE request with Bearer auth", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "doc-to-delete",
            },
          }),
      });
    });

    const result = await deleteDocument("mock-token", "doc-to-delete");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents/doc-to-delete");
    expect(capturedMethod).toBe("DELETE");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("doc-to-delete");
  });

  it("6. searchDocuments: sends POST to search endpoint with query and limit", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = "";

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body as string;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                id: "chunk-1",
                documentId: "doc-1",
                documentTitle: "Doc One",
                sourceType: "TEXT",
                source: null,
                chunkIndex: 0,
                content: "Matched chunk content",
                similarity: 0.95,
              },
            ],
          }),
      });
    });

    const result = await searchDocuments("mock-token", "vector query", 5);
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents/search");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(JSON.parse(capturedBody)).toEqual({
      query: "vector query",
      limit: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].chunkIndex).toBe(0);
    expect(result[0].similarity).toBe(0.95);
  });

  it("7. Error handling: throws formatted error on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "FILE_REQUIRED",
            message: "An uploaded file is required for UPLOAD documents.",
          },
        }),
    });

    await expect(
      createTextDocument("mock-token", {
        title: "Test",
        content: "Content",
      }),
    ).rejects.toThrow("An uploaded file is required for UPLOAD documents.");
  });
});
