import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest";

let askAssistant: typeof import("./brainos-client-api").askAssistant;
let streamAssistant: typeof import("./brainos-client-api").streamAssistant;
let createConversation: typeof import("./brainos-client-api").createConversation;
let listConversations: typeof import("./brainos-client-api").listConversations;
let getConversation: typeof import("./brainos-client-api").getConversation;
let deleteConversation: typeof import("./brainos-client-api").deleteConversation;
let listMessages: typeof import("./brainos-client-api").listMessages;
let listTasks: typeof import("./brainos-client-api").listTasks;
let createTask: typeof import("./brainos-client-api").createTask;
let getTask: typeof import("./brainos-client-api").getTask;
let updateTask: typeof import("./brainos-client-api").updateTask;
let completeTask: typeof import("./brainos-client-api").completeTask;
let deleteTask: typeof import("./brainos-client-api").deleteTask;
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
let searchDocumentChunks: typeof import("./brainos-client-api").searchDocumentChunks;
let listMemories: typeof import("./brainos-client-api").listMemories;
let createMemory: typeof import("./brainos-client-api").createMemory;
let getMemory: typeof import("./brainos-client-api").getMemory;
let updateMemory: typeof import("./brainos-client-api").updateMemory;
let deleteMemory: typeof import("./brainos-client-api").deleteMemory;
let searchMemories: typeof import("./brainos-client-api").searchMemories;
let listAutomations: typeof import("./brainos-client-api").listAutomations;
let createAutomation: typeof import("./brainos-client-api").createAutomation;
let getAutomation: typeof import("./brainos-client-api").getAutomation;
let updateAutomation: typeof import("./brainos-client-api").updateAutomation;
let pauseAutomation: typeof import("./brainos-client-api").pauseAutomation;
let resumeAutomation: typeof import("./brainos-client-api").resumeAutomation;
let deleteAutomation: typeof import("./brainos-client-api").deleteAutomation;
let createVoiceSession: typeof import("./brainos-client-api").createVoiceSession;
let getVoiceSession: typeof import("./brainos-client-api").getVoiceSession;
let interruptVoiceSession: typeof import("./brainos-client-api").interruptVoiceSession;
let endVoiceSession: typeof import("./brainos-client-api").endVoiceSession;
let processVoiceTurn: typeof import("./brainos-client-api").processVoiceTurn;
let streamVoiceTurn: typeof import("./brainos-client-api").streamVoiceTurn;
let listComputerAgents: typeof import("./brainos-client-api").listComputerAgents;
let getComputerAgent: typeof import("./brainos-client-api").getComputerAgent;
let createComputerAgent: typeof import("./brainos-client-api").createComputerAgent;
let revokeComputerAgent: typeof import("./brainos-client-api").revokeComputerAgent;
let deleteComputerAgent: typeof import("./brainos-client-api").deleteComputerAgent;
let listComputerAgentPermissions: typeof import("./brainos-client-api").listComputerAgentPermissions;
let grantComputerAgentPermission: typeof import("./brainos-client-api").grantComputerAgentPermission;
let revokeComputerAgentPermission: typeof import("./brainos-client-api").revokeComputerAgentPermission;
let listCalendarEvents: typeof import("./brainos-client-api").listCalendarEvents;
let createCalendarEvent: typeof import("./brainos-client-api").createCalendarEvent;
let getCalendarEvent: typeof import("./brainos-client-api").getCalendarEvent;
let updateCalendarEvent: typeof import("./brainos-client-api").updateCalendarEvent;
let deleteCalendarEvent: typeof import("./brainos-client-api").deleteCalendarEvent;
type AssistantStreamEvent = import("./brainos-client-api").AssistantStreamEvent;
type VoiceStreamEvent = import("./brainos-client-api").VoiceStreamEvent;
type VoiceTurnResult = import("./brainos-client-api").VoiceTurnResult;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_BRAINOS_API_URL = "http://localhost:3001";
  const mod = await import("./brainos-client-api");
  askAssistant = mod.askAssistant;
  streamAssistant = mod.streamAssistant;
  createConversation = mod.createConversation;
  listConversations = mod.listConversations;
  getConversation = mod.getConversation;
  deleteConversation = mod.deleteConversation;
  listMessages = mod.listMessages;
  listTasks = mod.listTasks;
  createTask = mod.createTask;
  getTask = mod.getTask;
  updateTask = mod.updateTask;
  completeTask = mod.completeTask;
  deleteTask = mod.deleteTask;
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
  searchDocumentChunks = mod.searchDocumentChunks;
  listMemories = mod.listMemories;
  createMemory = mod.createMemory;
  getMemory = mod.getMemory;
  updateMemory = mod.updateMemory;
  deleteMemory = mod.deleteMemory;
  searchMemories = mod.searchMemories;
  listAutomations = mod.listAutomations;
  createAutomation = mod.createAutomation;
  getAutomation = mod.getAutomation;
  updateAutomation = mod.updateAutomation;
  pauseAutomation = mod.pauseAutomation;
  resumeAutomation = mod.resumeAutomation;
  deleteAutomation = mod.deleteAutomation;
  createVoiceSession = mod.createVoiceSession;
  getVoiceSession = mod.getVoiceSession;
  interruptVoiceSession = mod.interruptVoiceSession;
  endVoiceSession = mod.endVoiceSession;
  processVoiceTurn = mod.processVoiceTurn;
  streamVoiceTurn = mod.streamVoiceTurn;
  listComputerAgents = mod.listComputerAgents;
  getComputerAgent = mod.getComputerAgent;
  createComputerAgent = mod.createComputerAgent;
  revokeComputerAgent = mod.revokeComputerAgent;
  deleteComputerAgent = mod.deleteComputerAgent;
  listComputerAgentPermissions = mod.listComputerAgentPermissions;
  grantComputerAgentPermission = mod.grantComputerAgentPermission;
  revokeComputerAgentPermission = mod.revokeComputerAgentPermission;
  listCalendarEvents = mod.listCalendarEvents;
  createCalendarEvent = mod.createCalendarEvent;
  getCalendarEvent = mod.getCalendarEvent;
  updateCalendarEvent = mod.updateCalendarEvent;
  deleteCalendarEvent = mod.deleteCalendarEvent;
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

describe("askAssistant (Authentication Recovery & Resilience)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. Normal request: succeeds without invoking getFreshToken", async () => {
    let capturedAuth = "";
    const getFreshTokenMock = vi.fn().mockResolvedValue("fresh-token-should-not-be-called");

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              text: "Hello from BrainOS",
              model: "test-model",
              provider: "test-provider",
              retrievedMemories: [],
            },
          }),
      });
    });

    const result = await askAssistant("initial-token", "Hello", {
      getFreshToken: getFreshTokenMock,
    });

    expect(result.text).toBe("Hello from BrainOS");
    expect(capturedAuth).toBe("Bearer initial-token");
    expect(getFreshTokenMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("2. 401 Expired Token Recovery: obtains fresh token and retries request once successfully", async () => {
    const authHeaders: string[] = [];
    const getFreshTokenMock = vi.fn().mockResolvedValue("fresh-clerk-token");

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
      authHeaders.push(auth);

      if (authHeaders.length === 1) {
        // First attempt with expired token: returns 401
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () =>
            Promise.resolve({
              success: false,
              error: { message: "Authentication required." },
            }),
        });
      }

      // Second attempt with fresh token: returns 200 success
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              text: "Recovered successfully with fresh token!",
              model: "test-model",
              provider: "test-provider",
              retrievedMemories: [],
            },
          }),
      });
    });

    const result = await askAssistant("expired-initial-token", "Retry test", {
      getFreshToken: getFreshTokenMock,
    });

    expect(result.text).toBe("Recovered successfully with fresh token!");
    expect(getFreshTokenMock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(authHeaders).toEqual([
      "Bearer expired-initial-token",
      "Bearer fresh-clerk-token",
    ]);
  });

  it("3. Second 401 Final Error: throws authentication error after retry without infinite loop", async () => {
    const authHeaders: string[] = [];
    const getFreshTokenMock = vi.fn().mockResolvedValue("still-invalid-token");

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
      authHeaders.push(auth);

      return Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "Authentication required." },
          }),
      });
    });

    await expect(
      askAssistant("expired-token", "Loop test", {
        getFreshToken: getFreshTokenMock,
      }),
    ).rejects.toThrow("Authentication required.");

    expect(getFreshTokenMock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(authHeaders).toEqual([
      "Bearer expired-token",
      "Bearer still-invalid-token",
    ]);
  });

  it("4. Cancellation: respects AbortSignal during authentication retry flow", async () => {
    const abortController = new AbortController();
    const getFreshTokenMock = vi.fn().mockImplementation(async () => {
      abortController.abort();
      return "fresh-token";
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () =>
        Promise.resolve({
          success: false,
          error: { message: "Authentication required." },
        }),
    });

    await expect(
      askAssistant("expired-token", "Abort during auth recovery", {
        signal: abortController.signal,
        getFreshToken: getFreshTokenMock,
      }),
    ).rejects.toThrow();

    expect(getFreshTokenMock).toHaveBeenCalledTimes(1);
    // Fetch should not have been called a second time after abort during token retrieval
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("5. No Infinite Retry: never retries if getFreshToken returns null or is omitted", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () =>
        Promise.resolve({
          success: false,
          error: { message: "Authentication required." },
        }),
    });

    // Case A: getFreshToken omitted
    await expect(
      askAssistant("token-without-hook", "No hook test"),
    ).rejects.toThrow("Authentication required.");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Case B: getFreshToken returns null
    const getNullTokenMock = vi.fn().mockResolvedValue(null);
    await expect(
      askAssistant("token-with-null", "Null token test", {
        getFreshToken: getNullTokenMock,
      }),
    ).rejects.toThrow("Authentication required.");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // 1st test + 1 call for 2nd test
  });
});

describe("streamAssistant (Authentication Recovery & Resilience)", () => {
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

  it("1. Normal stream: succeeds without invoking getFreshToken", async () => {
    const getFreshTokenMock = vi.fn().mockResolvedValue("fresh-token-should-not-be-called");
    const ssePayload = [
      'event: response\ndata: {"text":"Normal stream success","model":"m","provider":"p","retrievedMemories":[]}\n\n',
      'event: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockReadableStream(ssePayload),
    });

    const result = await streamAssistant("initial-token", "Normal stream", {
      getFreshToken: getFreshTokenMock,
    });

    expect(result.text).toBe("Normal stream success");
    expect(getFreshTokenMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("2. 401 Expired Token Recovery: stream 401 fetches fresh token and retries stream successfully", async () => {
    const authHeaders: string[] = [];
    const getFreshTokenMock = vi.fn().mockResolvedValue("fresh-stream-token");
    const ssePayload = [
      'event: response\ndata: {"text":"Stream recovered with fresh token!","model":"m","provider":"p","retrievedMemories":[]}\n\n',
      'event: done\ndata: {}\n\n',
    ];

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
      authHeaders.push(auth);

      if (authHeaders.length === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () =>
            Promise.resolve({
              error: { message: "Authentication required." },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        body: createMockReadableStream(ssePayload),
      });
    });

    const result = await streamAssistant("expired-stream-token", "Stream retry test", {
      getFreshToken: getFreshTokenMock,
    });

    expect(result.text).toBe("Stream recovered with fresh token!");
    expect(getFreshTokenMock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(authHeaders).toEqual([
      "Bearer expired-stream-token",
      "Bearer fresh-stream-token",
    ]);
  });

  it("3. Second 401 Final Error: stream retry returning 401 throws auth error and halts", async () => {
    const authHeaders: string[] = [];
    const getFreshTokenMock = vi.fn().mockResolvedValue("still-invalid-stream-token");

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.["Authorization"] || "";
      authHeaders.push(auth);

      return Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: () =>
          Promise.resolve({
            error: { message: "Authentication required." },
          }),
      });
    });

    await expect(
      streamAssistant("expired-token", "Stream loop test", {
        getFreshToken: getFreshTokenMock,
      }),
    ).rejects.toThrow("Authentication required.");

    expect(getFreshTokenMock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(authHeaders).toEqual([
      "Bearer expired-token",
      "Bearer still-invalid-stream-token",
    ]);
  });

  it("4. Cancellation: respects AbortSignal during stream auth retry", async () => {
    const abortController = new AbortController();
    const getFreshTokenMock = vi.fn().mockImplementation(async () => {
      abortController.abort();
      return "fresh-token";
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () =>
        Promise.resolve({
          error: { message: "Authentication required." },
        }),
    });

    await expect(
      streamAssistant("expired-token", "Stream abort during auth", {
        signal: abortController.signal,
        getFreshToken: getFreshTokenMock,
      }),
    ).rejects.toThrow();

    expect(getFreshTokenMock).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("5. No Infinite Retry: stream never retries more than once", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () =>
        Promise.resolve({
          error: { message: "Authentication required." },
        }),
    });

    // Case A: getFreshToken omitted
    await expect(
      streamAssistant("token-without-hook", "No hook stream test"),
    ).rejects.toThrow("Authentication required.");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Case B: getFreshToken returns null
    const getNullTokenMock = vi.fn().mockResolvedValue(null);
    await expect(
      streamAssistant("token-with-null", "Null token stream test", {
        getFreshToken: getNullTokenMock,
      }),
    ).rejects.toThrow("Authentication required.");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
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

  it("6. searchDocumentChunks: sends POST to search endpoint with query and limit", async () => {
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

    const result = await searchDocumentChunks("mock-token", "vector query", 5);
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

describe("Memory API (Frontend Client)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. listMemories: sends GET request with Bearer auth and optional limit", async () => {
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
                id: "mem-1",
                content: "User prefers dark mode",
                importance: 0.8,
                lastAccessedAt: "2026-09-06T10:00:00.000Z",
                createdAt: "2026-09-06T09:00:00.000Z",
                updatedAt: "2026-09-06T09:00:00.000Z",
              },
            ],
          }),
      });
    });

    const result = await listMemories("mock-token", { limit: 15 });
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/memories?limit=15");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("mem-1");
    expect(result[0].importance).toBe(0.8);
  });

  it("2. createMemory: sends POST request with JSON content and importance", async () => {
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
              id: "mem-2",
              content: "Doctor is Dr. Adams",
              importance: 0.9,
              lastAccessedAt: null,
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const result = await createMemory("mock-token", {
      content: "Doctor is Dr. Adams",
      importance: 0.9,
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/memories");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(JSON.parse(capturedBody)).toEqual({
      content: "Doctor is Dr. Adams",
      importance: 0.9,
    });
    expect(result.id).toBe("mem-2");
    expect(result.importance).toBe(0.9);
  });

  it("3. getMemory: encodes memoryId and sends GET request with Bearer auth", async () => {
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
              id: "mem/3#spec",
              content: "Special memory",
              importance: 0.5,
              lastAccessedAt: null,
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const result = await getMemory("mock-token", "mem/3#spec");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/memories/mem%2F3%23spec");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("mem/3#spec");
  });

  it("4. updateMemory: encodes memoryId and sends PATCH request with updatable fields", async () => {
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
            data: {
              id: "mem-4",
              content: "Updated content",
              importance: 1.0,
              lastAccessedAt: null,
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T11:00:00.000Z",
            },
          }),
      });
    });

    const result = await updateMemory("mock-token", "mem-4", {
      content: "Updated content",
      importance: 1.0,
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/memories/mem-4");
    expect(capturedMethod).toBe("PATCH");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(JSON.parse(capturedBody)).toEqual({
      content: "Updated content",
      importance: 1.0,
    });
    expect(result.content).toBe("Updated content");
    expect(result.importance).toBe(1.0);
  });

  it("5. deleteMemory: encodes memoryId and sends DELETE request with Bearer auth", async () => {
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
              id: "mem-5",
            },
          }),
      });
    });

    const result = await deleteMemory("mock-token", "mem-5");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/memories/mem-5");
    expect(capturedMethod).toBe("DELETE");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("mem-5");
  });

  it("6. searchMemories: sends POST request to /api/v1/memories/search with query and limit", async () => {
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
                id: "mem-search-1",
                content: "Prefers Python for quick scripts",
                similarity: 0.92,
                importance: 0.7,
              },
            ],
          }),
      });
    });

    const result = await searchMemories("mock-token", "coding languages", 5);
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/memories/search");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(JSON.parse(capturedBody)).toEqual({
      query: "coding languages",
      limit: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.92);
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
            code: "INVALID_IMPORTANCE",
            message: "Importance must be a number between 0 and 1.",
          },
        }),
    });

    await expect(
      createMemory("mock-token", {
        content: "Test",
        importance: 2.5,
      }),
    ).rejects.toThrow("Importance must be a number between 0 and 1.");
  });
});

describe("Automation API Client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. listAutomations: sends GET request with Authorization header and handles options", async () => {
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
                id: "auto-1",
                userId: "user-1",
                name: "Morning briefing",
                status: "ACTIVE",
                triggerType: "SCHEDULE",
                actionType: "CREATE_TASK",
                config: { recurrence: { type: "DAILY", hour: 9, minute: 0 } },
                nextRunAt: "2026-09-07T09:00:00.000Z",
                lastRunAt: null,
                createdAt: "2026-09-06T10:00:00.000Z",
                updatedAt: "2026-09-06T10:00:00.000Z",
              },
            ],
          }),
      });
    });

    const result = await listAutomations("mock-token");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Morning briefing");

    // With options
    await listAutomations("mock-token", { status: "ACTIVE", limit: 10 });
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations?status=ACTIVE&limit=10");
  });

  it("2. createAutomation: sends POST request with JSON payload including Date serialization", async () => {
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
              id: "auto-2",
              userId: "user-1",
              name: "Weekly report",
              status: "ACTIVE",
              triggerType: "SCHEDULE",
              actionType: "CREATE_REMINDER",
              config: { message: "Prepare report" },
              nextRunAt: "2026-09-08T10:00:00.000Z",
              lastRunAt: null,
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const runDate = new Date("2026-09-08T10:00:00.000Z");
    const result = await createAutomation("mock-token", {
      name: " Weekly report ",
      triggerType: "SCHEDULE",
      actionType: "CREATE_REMINDER",
      config: { message: "Prepare report" },
      nextRunAt: runDate,
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(JSON.parse(capturedBody)).toEqual({
      name: "Weekly report",
      triggerType: "SCHEDULE",
      actionType: "CREATE_REMINDER",
      config: { message: "Prepare report" },
      nextRunAt: "2026-09-08T10:00:00.000Z",
    });
    expect(result.id).toBe("auto-2");
  });

  it("3. getAutomation: sends GET request with properly encoded automationId", async () => {
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
              id: "auto/special#1",
              userId: "user-1",
              name: "Special Auto",
              status: "ACTIVE",
              triggerType: "TASK_DUE",
              actionType: "CREATE_REMINDER",
              config: { taskId: "task-1" },
              nextRunAt: null,
              lastRunAt: null,
              createdAt: "2026-09-06T10:00:00.000Z",
              updatedAt: "2026-09-06T10:00:00.000Z",
            },
          }),
      });
    });

    const result = await getAutomation("mock-token", "auto/special#1");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations/auto%2Fspecial%231");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("auto/special#1");
  });

  it("4. updateAutomation: sends PATCH request with encoded ID and payload", async () => {
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
            data: {
              id: "auto-3",
            },
          }),
      });
    });

    const result = await updateAutomation("mock-token", "auto-3", {
      name: " Renamed Automation ",
      status: "PAUSED",
      config: { updated: true },
      nextRunAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations/auto-3");
    expect(capturedMethod).toBe("PATCH");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(JSON.parse(capturedBody)).toEqual({
      name: "Renamed Automation",
      status: "PAUSED",
      config: { updated: true },
      nextRunAt: "2026-09-10T12:00:00.000Z",
    });
    expect(result.id).toBe("auto-3");
  });

  it("5. pauseAutomation: sends POST request to /api/v1/automations/:id/pause with encoded ID", async () => {
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
              id: "auto-4/pause",
              status: "PAUSED",
            },
          }),
      });
    });

    const result = await pauseAutomation("mock-token", "auto-4/pause");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations/auto-4%2Fpause/pause");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toEqual({
      id: "auto-4/pause",
      status: "PAUSED",
    });
  });

  it("6. resumeAutomation: sends POST request to /api/v1/automations/:id/resume with encoded ID", async () => {
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
              id: "auto-5",
              status: "ACTIVE",
            },
          }),
      });
    });

    const result = await resumeAutomation("mock-token", "auto-5");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations/auto-5/resume");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toEqual({
      id: "auto-5",
      status: "ACTIVE",
    });
  });

  it("7. deleteAutomation: sends DELETE request with encoded ID", async () => {
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
              id: "auto-6",
            },
          }),
      });
    });

    const result = await deleteAutomation("mock-token", "auto-6");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/automations/auto-6");
    expect(capturedMethod).toBe("DELETE");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("auto-6");
  });

  it("8. Error handling: throws formatted error on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "INVALID_NAME",
            message: "Automation name is required.",
          },
        }),
    });

    await expect(
      createAutomation("mock-token", {
        name: "",
        triggerType: "SCHEDULE",
        actionType: "CREATE_TASK",
        config: {},
      }),
    ).rejects.toThrow("Automation name is required.");
  });
});

describe("Conversations API Client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. createConversation: sends POST request with Bearer auth and optional title", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "conv-1",
              userId: "user-1",
              title: "Test Conversation",
              createdAt: "2026-09-06T08:00:00.000Z",
              updatedAt: "2026-09-06T08:00:00.000Z",
            },
          }),
      });
    });

    const result = await createConversation("mock-token", "  Test Conversation  ");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/conversations");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(capturedBody).toEqual({ title: "Test Conversation" });
    expect(result.id).toBe("conv-1");
    expect(result.title).toBe("Test Conversation");
  });

  it("2. createConversation: sends empty object body when title is omitted", async () => {
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "conv-2",
              userId: "user-1",
              title: null,
              createdAt: "2026-09-06T08:00:00.000Z",
              updatedAt: "2026-09-06T08:00:00.000Z",
            },
          }),
      });
    });

    const result = await createConversation("mock-token");
    expect(capturedBody).toEqual({});
    expect(result.id).toBe("conv-2");
    expect(result.title).toBeNull();
  });

  it("3. listConversations: sends GET request with cache no-store and handles query limit", async () => {
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
                id: "conv-1",
                userId: "user-1",
                title: "Chat 1",
                createdAt: "2026-09-06T08:00:00.000Z",
                updatedAt: "2026-09-06T08:00:00.000Z",
              },
            ],
          }),
      });
    });

    const result = await listConversations("mock-token", 20);
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/conversations?limit=20");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("conv-1");
  });

  it("4. getConversation: sends GET request with URI-encoded conversationId", async () => {
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
              id: "conv/special#1",
              userId: "user-1",
              title: "Special Chat",
              createdAt: "2026-09-06T08:00:00.000Z",
              updatedAt: "2026-09-06T08:00:00.000Z",
            },
          }),
      });
    });

    const result = await getConversation("mock-token", "conv/special#1");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/conversations/conv%2Fspecial%231");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("conv/special#1");
    expect(result.title).toBe("Special Chat");
  });

  it("5. deleteConversation: sends DELETE request with URI-encoded conversationId", async () => {
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
              id: "conv/special#1",
            },
          }),
      });
    });

    const result = await deleteConversation("mock-token", "conv/special#1");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/conversations/conv%2Fspecial%231");
    expect(capturedMethod).toBe("DELETE");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("conv/special#1");
  });

  it("6. listMessages: sends GET request with URI-encoded conversationId", async () => {
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
                id: "msg-1",
                conversationId: "conv/special#1",
                role: "USER",
                content: "Hello",
                createdAt: "2026-09-06T08:00:00.000Z",
                updatedAt: "2026-09-06T08:00:00.000Z",
              },
            ],
          }),
      });
    });

    const result = await listMessages("mock-token", "conv/special#1");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/conversations/conv%2Fspecial%231/messages");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg-1");
  });

  it("7. Error handling: throws parsed error on conversation failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "CONVERSATION_NOT_FOUND",
            message: "Conversation not found.",
          },
        }),
    });

    await expect(getConversation("mock-token", "non-existent")).rejects.toThrow(
      "Conversation not found.",
    );
  });
});

describe("Tasks API Client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. listTasks: sends GET request with cache no-store, Bearer auth, and query filters", async () => {
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
                id: "task-1",
                userId: "user-1",
                title: "Test Task",
                description: "Test Description",
                status: "TODO",
                priority: "HIGH",
                dueAt: "2026-09-10T12:00:00.000Z",
                completedAt: null,
                createdAt: "2026-09-06T08:00:00.000Z",
                updatedAt: "2026-09-06T08:00:00.000Z",
              },
            ],
          }),
      });
    });

    const dueDate = new Date("2026-09-10T00:00:00.000Z");
    const result = await listTasks("mock-token", {
      status: "TODO",
      priority: "HIGH",
      limit: 10,
      dueBefore: dueDate,
      dueAfter: "2026-09-01T00:00:00.000Z",
    });

    expect(capturedUrl).toBe(
      `http://localhost:3001/api/v1/tasks?limit=10&status=TODO&priority=HIGH&dueBefore=${encodeURIComponent("2026-09-10T00:00:00.000Z")}&dueAfter=${encodeURIComponent("2026-09-01T00:00:00.000Z")}`,
    );
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("task-1");
    expect(result[0].status).toBe("TODO");
    expect(result[0].priority).toBe("HIGH");
  });

  it("2. createTask: sends POST request with trimmed payload and Bearer auth", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return Promise.resolve({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "task-2",
              userId: "user-1",
              title: "Deploy BrainOS",
              description: "Production deploy",
              status: "TODO",
              priority: "HIGH",
              dueAt: "2026-09-15T18:00:00.000Z",
              completedAt: null,
              createdAt: "2026-09-06T08:00:00.000Z",
              updatedAt: "2026-09-06T08:00:00.000Z",
            },
          }),
      });
    });

    const result = await createTask("mock-token", {
      title: "  Deploy BrainOS  ",
      description: "  Production deploy  ",
      priority: "HIGH",
      dueAt: new Date("2026-09-15T18:00:00.000Z"),
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/tasks");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(capturedBody).toEqual({
      title: "Deploy BrainOS",
      description: "Production deploy",
      priority: "HIGH",
      dueAt: "2026-09-15T18:00:00.000Z",
    });
    expect(result.id).toBe("task-2");
    expect(result.title).toBe("Deploy BrainOS");
  });

  it("3. getTask: sends GET request with URI-encoded taskId and Bearer auth", async () => {
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
              id: "task/special#3",
              userId: "user-1",
              title: "Special Task",
              description: null,
              status: "TODO",
              priority: "MEDIUM",
              dueAt: null,
              completedAt: null,
              createdAt: "2026-09-06T08:00:00.000Z",
              updatedAt: "2026-09-06T08:00:00.000Z",
            },
          }),
      });
    });

    const result = await getTask("mock-token", "task/special#3");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/tasks/task%2Fspecial%233");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("task/special#3");
    expect(result.title).toBe("Special Task");
  });

  it("4. updateTask: sends PATCH request with partial payload and URI-encoded taskId", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: "task/special#3",
            },
          }),
      });
    });

    const result = await updateTask("mock-token", "task/special#3", {
      title: "  Updated Task Title  ",
      description: null,
      priority: "LOW",
      dueAt: new Date("2026-09-20T00:00:00.000Z"),
    });

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/tasks/task%2Fspecial%233");
    expect(capturedMethod).toBe("PATCH");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedBody).toEqual({
      title: "Updated Task Title",
      description: null,
      priority: "LOW",
      dueAt: "2026-09-20T00:00:00.000Z",
    });
    expect(result.id).toBe("task/special#3");
  });

  it("5. completeTask: sends POST request to complete endpoint with URI-encoded taskId", async () => {
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
              id: "task-4",
              status: "COMPLETED",
            },
          }),
      });
    });

    const result = await completeTask("mock-token", "task-4");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/tasks/task-4/complete");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("task-4");
    expect(result.status).toBe("COMPLETED");
  });

  it("6. deleteTask: sends DELETE request with URI-encoded taskId", async () => {
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
              id: "task-5",
            },
          }),
      });
    });

    const result = await deleteTask("mock-token", "task-5");
    expect(capturedUrl).toBe("http://localhost:3001/api/v1/tasks/task-5");
    expect(capturedMethod).toBe("DELETE");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(result.id).toBe("task-5");
  });

  it("7. Error handling: throws parsed error message on task API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Task title is required.",
          },
        }),
    });

    await expect(
      createTask("mock-token", { title: "" }),
    ).rejects.toThrow("Task title is required.");
  });
});

describe("Document Semantic Search API Client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("1. searchDocumentChunks: sends POST request with Bearer auth, trimmed query and limit", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || "GET";
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                id: "chunk-101",
                documentId: "doc-1",
                documentTitle: "Architecture Specs",
                sourceType: "UPLOAD",
                source: "specs.pdf",
                chunkIndex: 0,
                content: "BrainOS uses a layered service-repository architecture.",
                similarity: 0.93,
              },
            ],
          }),
      });
    });

    const results = await searchDocumentChunks("mock-token", "  layered architecture  ", 5);

    expect(capturedUrl).toBe("http://localhost:3001/api/v1/documents/search");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders["Authorization"]).toBe("Bearer mock-token");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
    expect(capturedBody).toEqual({
      query: "layered architecture",
      limit: 5,
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("chunk-101");
    expect(results[0].documentTitle).toBe("Architecture Specs");
    expect(results[0].similarity).toBe(0.93);
    expect(results[0].content).toContain("layered service-repository");
  });

  it("2. searchDocumentChunks: omits limit from payload when undefined", async () => {
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      });
    });

    const results = await searchDocumentChunks("mock-token", "testing default limit");

    expect(capturedBody).toEqual({
      query: "testing default limit",
    });
    expect(capturedBody.limit).toBeUndefined();
    expect(results).toEqual([]);
  });

  it("3. searchDocumentChunks: throws parsed error message on 400 validation error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "INVALID_QUERY",
            message: "Search query is required.",
          },
        }),
    });

    await expect(
      searchDocumentChunks("mock-token", ""),
    ).rejects.toThrow("Search query is required.");
  });

  it("4. searchDocumentChunks: throws parsed error message on 401 unauthorized", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () =>
        Promise.resolve({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication token is invalid or expired.",
          },
        }),
    });

    await expect(
      searchDocumentChunks("expired-token", "query"),
    ).rejects.toThrow("Authentication token is invalid or expired.");
  });
});

describe("Voice API Client (Mission 69)", () => {
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

  describe("Session Lifecycle", () => {
    it("1. createVoiceSession: sends POST with conversationId and parses response", async () => {
      let capturedUrl = "";
      let capturedHeaders: any = {};
      let capturedBody: any = {};

      globalThis.fetch = vi.fn().mockImplementation((url, init) => {
        capturedUrl = url.toString();
        capturedHeaders = init?.headers;
        capturedBody = JSON.parse(init?.body as string);

        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: "voice-sess-1",
                userId: "user-123",
                conversationId: "conv-abc",
                status: "IDLE",
                createdAt: "2026-09-08T00:00:00.000Z",
                updatedAt: "2026-09-08T00:00:00.000Z",
              },
            }),
        });
      });

      const session = await createVoiceSession("test-token", "conv-abc");

      expect(capturedUrl).toBe("http://localhost:3001/api/v1/voice/sessions");
      expect(capturedHeaders["Authorization"]).toBe("Bearer test-token");
      expect(capturedBody).toEqual({ conversationId: "conv-abc" });
      expect(session.id).toBe("voice-sess-1");
      expect(session.status).toBe("IDLE");
    });

    it("2. getVoiceSession: sends GET with sessionId param", async () => {
      let capturedUrl = "";
      let capturedHeaders: any = {};

      globalThis.fetch = vi.fn().mockImplementation((url, init) => {
        capturedUrl = url.toString();
        capturedHeaders = init?.headers;

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: "voice-sess-1",
                userId: "user-123",
                status: "IDLE",
                createdAt: "2026-09-08T00:00:00.000Z",
                updatedAt: "2026-09-08T00:00:00.000Z",
              },
            }),
        });
      });

      const session = await getVoiceSession("test-token", "voice-sess-1");

      expect(capturedUrl).toBe("http://localhost:3001/api/v1/voice/sessions/voice-sess-1");
      expect(capturedHeaders["Authorization"]).toBe("Bearer test-token");
      expect(session.id).toBe("voice-sess-1");
    });

    it("3. interruptVoiceSession: sends POST to /interrupt", async () => {
      let capturedUrl = "";

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        capturedUrl = url.toString();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { interrupted: true },
            }),
        });
      });

      const res = await interruptVoiceSession("test-token", "voice-sess-1");
      expect(capturedUrl).toBe("http://localhost:3001/api/v1/voice/sessions/voice-sess-1/interrupt");
      expect(res.interrupted).toBe(true);
    });

    it("4. endVoiceSession: sends POST to /end", async () => {
      let capturedUrl = "";

      globalThis.fetch = vi.fn().mockImplementation((url) => {
        capturedUrl = url.toString();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ended: true },
            }),
        });
      });

      const res = await endVoiceSession("test-token", "voice-sess-1");
      expect(capturedUrl).toBe("http://localhost:3001/api/v1/voice/sessions/voice-sess-1/end");
      expect(res.ended).toBe(true);
    });
  });

  describe("processVoiceTurn", () => {
    it("sends POST to /turn with audio and synthesizeSpeech", async () => {
      let capturedUrl = "";
      let capturedBody: any = {};

      globalThis.fetch = vi.fn().mockImplementation((url, init) => {
        capturedUrl = url.toString();
        capturedBody = JSON.parse(init?.body as string);

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                sessionId: "sess-1",
                transcript: "Hello BrainOS",
                assistantResponse: {
                  text: "Hello! How can I help?",
                  model: "omniroute/gpt-4o",
                  provider: "omniroute",
                  retrievedMemories: [],
                },
                audioResponse: {
                  audioBase64: "UklGRg==",
                  mimeType: "audio/wav",
                },
                status: "IDLE",
              },
            }),
        });
      });

      const result = await processVoiceTurn("test-token", {
        conversationId: "conv-1",
        audio: {
          data: "UklGRg==",
          mimeType: "audio/wav",
        },
        synthesizeSpeech: true,
      });

      expect(capturedUrl).toBe("http://localhost:3001/api/v1/voice/turn");
      expect(capturedBody.conversationId).toBe("conv-1");
      expect(capturedBody.synthesizeSpeech).toBe(true);
      expect(result.transcript).toBe("Hello BrainOS");
      expect(result.audioResponse?.audioBase64).toBe("UklGRg==");
    });
  });

  describe("streamVoiceTurn (SSE Client)", () => {
    it("streams events and parses voice_result properly", async () => {
      const mockSseStream = [
        "event: state_changed\ndata: {\"state\":\"LISTENING\",\"activeTaskId\":null}\n\n",
        "event: state_changed\ndata: {\"state\":\"THINKING\",\"activeTaskId\":null}\n\n",
        "event: text_delta\ndata: {\"delta\":\"Hello \"}\n\n",
        "event: text_delta\ndata: {\"delta\":\"world!\"}\n\n",
        "event: voice_result\ndata: {\"sessionId\":\"sess-1\",\"transcript\":\"Say hello\",\"assistantResponse\":{\"text\":\"Hello world!\",\"model\":\"gpt-4o\",\"provider\":\"omniroute\",\"retrievedMemories\":[]},\"audioResponse\":{\"audioBase64\":\"QVdBVg==\",\"mimeType\":\"audio/wav\"},\"status\":\"IDLE\"}\n\n",
        "event: done\ndata: {}\n\n",
      ];

      const emittedEvents: VoiceStreamEvent[] = [];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
        body: createMockReadableStream(mockSseStream),
      });

      const result = await streamVoiceTurn("test-token", {
        transcript: "Say hello",
        synthesizeSpeech: true,
        onEvent: (event) => {
          emittedEvents.push(event);
        },
      });

      expect(result.transcript).toBe("Say hello");
      expect(result.assistantResponse.text).toBe("Hello world!");
      expect(result.audioResponse?.audioBase64).toBe("QVdBVg==");

      expect(emittedEvents).toHaveLength(6);
      expect(emittedEvents[0].type).toBe("state_changed");
      expect(emittedEvents[2].type).toBe("text_delta");
      expect(emittedEvents[4].type).toBe("voice_result");
      expect(emittedEvents[5].type).toBe("done");
    });

    it("throws error when stream emits an error event", async () => {
      const mockSseStream = [
        "event: error\ndata: {\"message\":\"Voice provider timeout occurred.\"}\n\n",
        "event: done\ndata: {}\n\n",
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "text/event-stream" }),
        body: createMockReadableStream(mockSseStream),
      });

      await expect(
        streamVoiceTurn("test-token", { transcript: "Failing query" }),
      ).rejects.toThrow("Voice provider timeout occurred.");
    });
  });
});

describe("Voice Audio Utilities (Mission 69)", () => {
  it("blobToBase64: converts Blob to base64 string", async () => {
    const { blobToBase64 } = await import("./voice-audio");

    const testBlob = new Blob(["test audio content"], { type: "text/plain" });
    const base64 = await blobToBase64(testBlob);

    expect(typeof base64).toBe("string");
    expect(base64.length).toBeGreaterThan(0);
    expect(atob(base64)).toBe("test audio content");
  });

  it("isAudioRecordingSupported: returns boolean in environment", async () => {
    const { isAudioRecordingSupported } = await import("./voice-audio");
    const supported = isAudioRecordingSupported();
    expect(typeof supported).toBe("boolean");
  });
});

describe("Computer Agent API (Mission 72)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("listComputerAgents", () => {
    it("fetches computer agents with authentication and query params", async () => {
      const mockAgents = [
        {
          id: "agent-1",
          userId: "user-1",
          name: "Work PC",
          status: "ACTIVE",
          lastAuthenticatedAt: null,
          revokedAt: null,
          createdAt: "2026-09-08T00:00:00.000Z",
          updatedAt: "2026-09-08T00:00:00.000Z",
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockAgents,
        }),
      });

      const result = await listComputerAgents("mock-token", {
        status: "ACTIVE",
        limit: 10,
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents?status=ACTIVE&limit=10",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        }),
      );
      expect(result).toEqual(mockAgents);
    });

    it("handles API errors gracefully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          success: false,
          error: { message: "Authentication required." },
        }),
      });

      await expect(listComputerAgents("invalid-token")).rejects.toThrow(
        "Authentication required.",
      );
    });
  });

  describe("getComputerAgent", () => {
    it("fetches a single computer agent by ID", async () => {
      const mockAgent = {
        id: "agent-1",
        userId: "user-1",
        name: "Work PC",
        status: "ACTIVE",
        lastAuthenticatedAt: null,
        revokedAt: null,
        createdAt: "2026-09-08T00:00:00.000Z",
        updatedAt: "2026-09-08T00:00:00.000Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockAgent,
        }),
      });

      const result = await getComputerAgent("mock-token", "agent-1");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents/agent-1",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        }),
      );
      expect(result).toEqual(mockAgent);
    });
  });

  describe("createComputerAgent", () => {
    it("creates a new computer agent and returns credential", async () => {
      const mockResponse = {
        agent: {
          id: "agent-new",
          userId: "user-1",
          name: "Home Laptop",
          status: "ACTIVE",
          lastAuthenticatedAt: null,
          revokedAt: null,
          createdAt: "2026-09-08T00:00:00.000Z",
          updatedAt: "2026-09-08T00:00:00.000Z",
        },
        credential: "plain-secret-credential-token",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockResponse,
        }),
      });

      const result = await createComputerAgent("mock-token", {
        name: "Home Laptop",
        id: "agent-new",
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({
            name: "Home Laptop",
            id: "agent-new",
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe("revokeComputerAgent", () => {
    it("revokes an active computer agent", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "agent-1",
            status: "REVOKED",
          },
        }),
      });

      const result = await revokeComputerAgent("mock-token", "agent-1");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents/agent-1/revoke",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        }),
      );
      expect(result).toEqual({ id: "agent-1", status: "REVOKED" });
    });
  });

  describe("deleteComputerAgent", () => {
    it("deletes a computer agent by ID", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "agent-1",
            deleted: true,
          },
        }),
      });

      const result = await deleteComputerAgent("mock-token", "agent-1");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents/agent-1",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        }),
      );
      expect(result).toEqual({ id: "agent-1", deleted: true });
    });
  });

  describe("listComputerAgentPermissions", () => {
    it("lists permissions for a computer agent", async () => {
      const mockPermissions = [
        {
          id: "perm-1",
          agentId: "agent-1",
          action: "computer_launch_application",
          createdAt: "2026-09-08T00:00:00.000Z",
          updatedAt: "2026-09-08T00:00:00.000Z",
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockPermissions,
        }),
      });

      const result = await listComputerAgentPermissions("mock-token", "agent-1");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents/agent-1/permissions",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        }),
      );
      expect(result).toEqual(mockPermissions);
    });
  });

  describe("grantComputerAgentPermission", () => {
    it("grants a permission action to a computer agent", async () => {
      const mockPermission = {
        id: "perm-1",
        agentId: "agent-1",
        action: "computer_write_file",
        createdAt: "2026-09-08T00:00:00.000Z",
        updatedAt: "2026-09-08T00:00:00.000Z",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: mockPermission,
        }),
      });

      const result = await grantComputerAgentPermission(
        "mock-token",
        "agent-1",
        "computer_write_file",
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents/agent-1/permissions",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
          body: JSON.stringify({ action: "computer_write_file" }),
        }),
      );
      expect(result).toEqual(mockPermission);
    });
  });

  describe("revokeComputerAgentPermission", () => {
    it("revokes a permission action from a computer agent", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            agentId: "agent-1",
            action: "computer_write_file",
            revoked: true,
          },
        }),
      });

      const result = await revokeComputerAgentPermission(
        "mock-token",
        "agent-1",
        "computer_write_file",
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/computer-agents/agent-1/permissions/computer_write_file",
        expect.objectContaining({
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-token",
          },
        }),
      );
      expect(result).toEqual({
        agentId: "agent-1",
        action: "computer_write_file",
        revoked: true,
      });
    });
  });

  describe("Post-Stream Follow-Up Calls (Authentication & Fresh Token)", () => {
    it("listMessages uses the refreshed follow-up token after a stream turn", async () => {
      let capturedAuthHeader = "";
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        capturedAuthHeader = headers["Authorization"] ?? "";
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: [
                {
                  id: "msg-1",
                  conversationId: "conv-1",
                  role: "USER",
                  content: "whatsapp open karo",
                  createdAt: "2026-09-11T00:00:00.000Z",
                  updatedAt: "2026-09-11T00:00:00.000Z",
                },
                {
                  id: "msg-2",
                  conversationId: "conv-1",
                  role: "ASSISTANT",
                  content: "WhatsApp opened.",
                  createdAt: "2026-09-11T00:00:05.000Z",
                  updatedAt: "2026-09-11T00:00:05.000Z",
                },
              ],
            }),
        });
      });

      const freshToken = "refreshed-clerk-token-after-action";
      const messages = await listMessages(freshToken, "conv-1");

      expect(capturedAuthHeader).toBe(`Bearer ${freshToken}`);
      expect(messages).toHaveLength(2);
      expect(messages[1].content).toBe("WhatsApp opened.");
    });

    it("getConversation uses the refreshed follow-up token after a stream turn", async () => {
      let capturedAuthHeader = "";
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        capturedAuthHeader = headers["Authorization"] ?? "";
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                id: "conv-1",
                userId: "user-1",
                title: "whatsapp open karo",
                createdAt: "2026-09-11T00:00:00.000Z",
                updatedAt: "2026-09-11T00:00:05.000Z",
              },
            }),
        });
      });

      const freshToken = "refreshed-clerk-token-after-action";
      const conversation = await getConversation(freshToken, "conv-1");

      expect(capturedAuthHeader).toBe(`Bearer ${freshToken}`);
      expect(conversation.title).toBe("whatsapp open karo");
    });
  });

  describe("Calendar API (Mission 89)", () => {
    const mockEvent = {
      id: "evt-123",
      userId: "user-1",
      title: "Team Sync",
      description: "Weekly sync meeting",
      location: "Room 101",
      startTime: "2026-10-01T10:00:00.000Z",
      endTime: "2026-10-01T11:00:00.000Z",
      isAllDay: false,
      timezone: "UTC",
      status: "CONFIRMED",
      recurrenceRule: null,
      metadata: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    };

    it("listCalendarEvents fetches events and constructs correct query params", async () => {
      let capturedUrl = "";
      let capturedAuth = "";

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        const headers = (init?.headers as Headers | undefined);
        capturedAuth = headers?.get("Authorization") ?? "";

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: [mockEvent],
            }),
        });
      });

      const events = await listCalendarEvents("test-token", {
        rangeStart: "2026-10-01T00:00:00.000Z",
        rangeEnd: "2026-10-02T00:00:00.000Z",
        status: "CONFIRMED",
        limit: 10,
      });

      expect(capturedUrl).toBe(
        "http://localhost:3001/api/v1/calendar/events?limit=10&status=CONFIRMED&rangeStart=2026-10-01T00%3A00%3A00.000Z&rangeEnd=2026-10-02T00%3A00%3A00.000Z",
      );
      expect(capturedAuth).toBe("Bearer test-token");
      expect(events).toEqual([mockEvent]);
    });

    it("listCalendarEvents validates that rangeStart is before rangeEnd", async () => {
      await expect(
        listCalendarEvents("test-token", {
          rangeStart: "2026-10-02T00:00:00.000Z",
          rangeEnd: "2026-10-01T00:00:00.000Z",
        }),
      ).rejects.toThrow("rangeStart must be before rangeEnd");
    });

    it("listCalendarEvents retries with fresh token on 401", async () => {
      let callCount = 0;
      let lastAuth = "";

      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        callCount++;
        const headers = (init?.headers as Headers | undefined);
        lastAuth = headers?.get("Authorization") ?? "";

        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: () => Promise.resolve({ success: false, error: { message: "Token expired" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: [mockEvent] }),
        });
      });

      const getFreshToken = vi.fn().mockResolvedValue("fresh-token-xyz");

      const events = await listCalendarEvents("expired-token", { getFreshToken });

      expect(callCount).toBe(2);
      expect(getFreshToken).toHaveBeenCalledTimes(1);
      expect(lastAuth).toBe("Bearer fresh-token-xyz");
      expect(events).toHaveLength(1);
    });

    it("createCalendarEvent sends POST with serialized payload and auth header", async () => {
      let capturedMethod = "";
      let capturedBody = "";
      let capturedAuth = "";

      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        capturedMethod = init?.method ?? "";
        capturedBody = init?.body as string;
        const headers = (init?.headers as Headers | undefined);
        capturedAuth = headers?.get("Authorization") ?? "";

        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ success: true, data: mockEvent }),
        });
      });

      const event = await createCalendarEvent("test-token", {
        title: "  Sprint Review  ",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
        location: "Room 101",
        timezone: "America/New_York",
      });

      expect(capturedMethod).toBe("POST");
      expect(capturedAuth).toBe("Bearer test-token");
      const parsed = JSON.parse(capturedBody);
      expect(parsed.title).toBe("Sprint Review");
      expect(parsed.startTime).toBe("2026-10-01T10:00:00.000Z");
      expect(parsed.endTime).toBe("2026-10-01T11:00:00.000Z");
      expect(parsed.timezone).toBe("America/New_York");
      expect(event).toEqual(mockEvent);
    });

    it("createCalendarEvent validates that title is non-empty", async () => {
      await expect(
        createCalendarEvent("token", {
          title: "   ",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
        }),
      ).rejects.toThrow("Title is required.");
    });

    it("createCalendarEvent validates that startTime is before endTime", async () => {
      await expect(
        createCalendarEvent("token", {
          title: "Event",
          startTime: "2026-10-01T12:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
        }),
      ).rejects.toThrow("Start time must be before end time.");
    });

    it("createCalendarEvent handles backend API error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () =>
          Promise.resolve({
            success: false,
            error: { message: "Invalid timezone" },
          }),
      });

      await expect(
        createCalendarEvent("token", {
          title: "Test",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
          timezone: "Invalid/Zone",
        }),
      ).rejects.toThrow("Invalid timezone");
    });

    it("getCalendarEvent fetches single event by ID", async () => {
      let capturedUrl = "";

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockEvent }),
        });
      });

      const event = await getCalendarEvent("token", "evt-123");

      expect(capturedUrl).toBe("http://localhost:3001/api/v1/calendar/events/evt-123");
      expect(event).toEqual(mockEvent);
    });

    it("updateCalendarEvent sends PATCH and validates date order when both dates provided", async () => {
      let capturedMethod = "";
      let capturedBody = "";

      globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        capturedMethod = init?.method ?? "";
        capturedBody = init?.body as string;

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...mockEvent, title: "Updated Title" },
            }),
        });
      });

      const updated = await updateCalendarEvent("token", "evt-123", {
        title: "Updated Title",
        status: "TENTATIVE",
      });

      expect(capturedMethod).toBe("PATCH");
      const parsed = JSON.parse(capturedBody);
      expect(parsed.title).toBe("Updated Title");
      expect(parsed.status).toBe("TENTATIVE");
      expect(updated.title).toBe("Updated Title");
    });

    it("updateCalendarEvent rejects when updated startTime is after endTime", async () => {
      await expect(
        updateCalendarEvent("token", "evt-123", {
          startTime: "2026-10-01T15:00:00.000Z",
          endTime: "2026-10-01T14:00:00.000Z",
        }),
      ).rejects.toThrow("Start time must be before end time.");
    });

    it("deleteCalendarEvent sends DELETE request and returns id", async () => {
      let capturedMethod = "";
      let capturedUrl = "";

      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method ?? "";

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: { id: "evt-123" } }),
        });
      });

      const result = await deleteCalendarEvent("token", "evt-123");

      expect(capturedMethod).toBe("DELETE");
      expect(capturedUrl).toBe("http://localhost:3001/api/v1/calendar/events/evt-123");
      expect(result).toEqual({ id: "evt-123" });
    });
  });
});
