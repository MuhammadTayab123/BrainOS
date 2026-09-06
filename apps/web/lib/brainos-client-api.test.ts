import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest";

let streamAssistant: typeof import("./brainos-client-api").streamAssistant;
type AssistantStreamEvent = import("./brainos-client-api").AssistantStreamEvent;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_BRAINOS_API_URL = "http://localhost:3001";
  const mod = await import("./brainos-client-api");
  streamAssistant = mod.streamAssistant;
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
