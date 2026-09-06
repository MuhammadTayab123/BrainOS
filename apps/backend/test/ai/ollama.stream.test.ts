import { describe, expect, it, vi } from "vitest";
import { OllamaClient } from "../../src/services/ai/clients/ollama.client";
import { OllamaLLMProvider } from "../../src/services/ai/providers/ollama.provider";

function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

describe("OllamaLLMProvider - Streaming & Cancellation", () => {
  it("streams NDJSON lines and emits tokens via onToken", async () => {
    const chunks = [
      JSON.stringify({ message: { content: "Hello" }, done: false }) + "\n",
      JSON.stringify({ message: { content: " world" }, done: false }) + "\n",
      JSON.stringify({ message: { content: "!" }, done: true }) + "\n",
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);
    const tokens: string[] = [];

    const result = await provider.generate({
      prompt: "Say hello",
      onToken: (token) => tokens.push(token),
    });

    expect(mockClient.postStream).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        messages: [{ role: "user", content: "Say hello" }],
        stream: true,
      }),
    );

    expect(tokens).toEqual(["Hello", " world", "!"]);
    expect(result.text).toBe("Hello world!");
    expect(result.provider).toBe("ollama");
  });

  it("handles NDJSON lines split across chunk boundaries", async () => {
    const chunk1 = '{"message":{"content":"Hel';
    const chunk2 = 'lo"},"done":false}\n{"message":{"content":" split"},"done":true}\n';

    const mockResponse = createMockStreamResponse([chunk1, chunk2]);
    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);
    const tokens: string[] = [];

    const result = await provider.generate({
      prompt: "Split test",
      onToken: (token) => tokens.push(token),
    });

    expect(tokens).toEqual(["Hello", " split"]);
    expect(result.text).toBe("Hello split");
  });

  it("handles multi-byte UTF-8 characters split across chunks safely", async () => {
    // UTF-8 for '🚀' is 0xF0 0x9F 0x99 0x80 (4 bytes)
    const rocketJson = JSON.stringify({ message: { content: "🚀" }, done: true }) + "\n";
    const rawBytes = new TextEncoder().encode(rocketJson);

    // Split right in the middle of the 4-byte rocket emoji
    const splitIndex = rawBytes.findIndex((b) => b === 0xf0) + 2;
    const part1 = rawBytes.subarray(0, splitIndex);
    const part2 = rawBytes.subarray(splitIndex);

    let step = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (step === 0) {
          controller.enqueue(part1);
          step++;
        } else if (step === 1) {
          controller.enqueue(part2);
          step++;
        } else {
          controller.close();
        }
      },
    });

    const mockResponse = new Response(stream, { status: 200 });
    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);
    const tokens: string[] = [];

    const result = await provider.generate({
      prompt: "Rocket emoji",
      onToken: (token) => tokens.push(token),
    });

    expect(tokens).toEqual(["🚀"]);
    expect(result.text).toBe("🚀");
  });

  it("forwards AbortSignal to postStream", async () => {
    const abortController = new AbortController();
    const mockResponse = createMockStreamResponse([
      JSON.stringify({ message: { content: "Aborted?" }, done: true }) + "\n",
    ]);

    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    await provider.generate({
      prompt: "Test signal",
      signal: abortController.signal,
      onToken: () => {},
    });

    expect(mockClient.postStream).toHaveBeenCalledWith(
      "/api/chat",
      expect.anything(),
      abortController.signal,
    );
  });

  it("falls back to non-streaming post() when onToken is not provided", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        message: {
          role: "assistant",
          content: "Non-streaming text",
        },
        model: "llama3.2",
      }),
      postStream: vi.fn(),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    const result = await provider.generate({
      prompt: "Non streaming",
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        stream: false,
      }),
    );
    expect(mockClient.postStream).not.toHaveBeenCalled();
    expect(result.text).toBe("Non-streaming text");
  });
});
