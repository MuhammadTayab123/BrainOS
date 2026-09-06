import { describe, expect, it, vi } from "vitest";
import { OmniRouteClient } from "../../src/services/ai/clients/omniroute.client";
import { OmniRouteLLMProvider } from "../../src/services/ai/providers/omniroute.provider";

function createMockSseResponse(chunks: string[]): Response {
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
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("OmniRouteLLMProvider - Streaming & Cancellation", () => {
  it("streams SSE data chunks and extracts delta.content", async () => {
    const sseLines = [
      `data: ${JSON.stringify({ model: "BrainOS-Coding", choices: [{ delta: { content: "Thinking " } }] })}\n\n`,
      `data: ${JSON.stringify({ model: "BrainOS-Coding", choices: [{ delta: { content: "deeply..." } }] })}\n\n`,
      "data: [DONE]\n\n",
    ];

    const mockResponse = createMockSseResponse(sseLines);
    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);
    const tokens: string[] = [];

    const result = await provider.generate({
      prompt: "Solve problem",
      onToken: (token) => tokens.push(token),
    });

    expect(mockClient.postStream).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.objectContaining({
        model: "BrainOS-Coding",
        stream: true,
      }),
    );

    expect(tokens).toEqual(["Thinking ", "deeply..."]);
    expect(result.text).toBe("Thinking deeply...");
    expect(result.model).toBe("BrainOS-Coding");
    expect(result.provider).toBe("omniroute");
  });

  it("handles SSE events split across chunk boundaries", async () => {
    const chunk1 = 'data: {"model":"m","choices":[{"delta":{"con';
    const chunk2 = 'tent":"Split "}}]}\n\ndata: {"choices":[{"delta":{"content":"token"}}]}\n\ndata: [DONE]\n\n';

    const mockResponse = createMockSseResponse([chunk1, chunk2]);
    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);
    const tokens: string[] = [];

    const result = await provider.generate({
      prompt: "Boundary test",
      onToken: (token) => tokens.push(token),
    });

    expect(tokens).toEqual(["Split ", "token"]);
    expect(result.text).toBe("Split token");
  });

  it("handles multi-byte UTF-8 split across SSE chunks safely", async () => {
    const rocketPayload = `data: ${JSON.stringify({
      choices: [{ delta: { content: "🌟" } }],
    })}\n\ndata: [DONE]\n\n`;

    const rawBytes = new TextEncoder().encode(rocketPayload);
    // Find index of star emoji UTF-8 bytes and split in half
    const splitIndex = rawBytes.findIndex((b) => b >= 0xf0) + 2;
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
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);
    const tokens: string[] = [];

    const result = await provider.generate({
      prompt: "Star emoji",
      onToken: (token) => tokens.push(token),
    });

    expect(tokens).toEqual(["🌟"]);
    expect(result.text).toBe("🌟");
  });

  it("forwards AbortSignal to postStream", async () => {
    const abortController = new AbortController();
    const mockResponse = createMockSseResponse(["data: [DONE]\n\n"]);

    const mockClient = {
      post: vi.fn(),
      postStream: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    await provider.generate({
      prompt: "Cancel test",
      signal: abortController.signal,
      onToken: () => {},
    });

    expect(mockClient.postStream).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.anything(),
      abortController.signal,
    );
  });

  it("falls back to non-streaming post() when onToken is not provided", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "BrainOS-Coding",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Non-streaming answer",
            },
          },
        ],
      }),
      postStream: vi.fn(),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    const result = await provider.generate({
      prompt: "Non-streaming OmniRoute",
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.objectContaining({
        stream: false,
      }),
    );
    expect(mockClient.postStream).not.toHaveBeenCalled();
    expect(result.text).toBe("Non-streaming answer");
  });
});
