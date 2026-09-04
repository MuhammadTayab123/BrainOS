import { describe, expect, it, vi } from "vitest";

import { OmniRouteClient } from "../../src/services/ai/clients/omniroute.client";
import { OmniRouteLLMProvider } from "../../src/services/ai/providers/omniroute.provider";

describe("OmniRouteLLMProvider", () => {
  it("translates a prompt into an OmniRoute chat completion request", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "BrainOS-Coding",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hello from OmniRoute.",
            },
          },
        ],
      }),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    const result = await provider.generate({
      prompt: "Hello",
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.objectContaining({
        model: "BrainOS-Coding",
        stream: false,
        messages: [
          {
            role: "user",
            content: "Hello",
          },
        ],
      }),
    );

    expect(result).toEqual({
      text: "Hello from OmniRoute.",
      model: "BrainOS-Coding",
      provider: "omniroute",
      toolCalls: undefined,
    });
  });

  it("includes system prompt and conversation messages", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "custom-model",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Response",
            },
          },
        ],
      }),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    await provider.generate({
      systemPrompt: "You are BrainOS.",
      messages: [
        {
          role: "user",
          content: "Previous question",
        },
        {
          role: "assistant",
          content: "Previous answer",
        },
      ],
      prompt: "New question",
      model: "custom-model",
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.objectContaining({
        model: "custom-model",
        messages: [
          {
            role: "system",
            content: "You are BrainOS.",
          },
          {
            role: "user",
            content: "Previous question",
            tool_call_id: undefined,
            tool_calls: undefined,
          },
          {
            role: "assistant",
            content: "Previous answer",
            tool_call_id: undefined,
            tool_calls: undefined,
          },
          {
            role: "user",
            content: "New question",
          },
        ],
      }),
    );
  });

  it("translates tools and returned tool calls", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "BrainOS-Coding",
        choices: [
          {
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "search_documents",
                    arguments: '{"query":"BrainOS"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    const result = await provider.generate({
      prompt: "Search my documents.",
      tools: [
        {
          name: "search_documents",
          description: "Search documents",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
              },
            },
            required: ["query"],
          },
        },
      ],
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/v1/chat/completions",
      expect.objectContaining({
        tools: [
          {
            type: "function",
            function: {
              name: "search_documents",
              description: "Search documents",
              parameters: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                  },
                },
                required: ["query"],
              },
            },
          },
        ],
      }),
    );

    expect(result.toolCalls).toEqual([
      {
        id: "call-1",
        name: "search_documents",
        arguments: {
          query: "BrainOS",
        },
      },
    ]);
  });

  it("rejects empty input", async () => {
    const mockClient = {
      post: vi.fn(),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    await expect(
      provider.generate({}),
    ).rejects.toThrow(
      "Cannot generate text without a prompt or messages.",
    );

    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("propagates client failures", async () => {
    const mockClient = {
      post: vi.fn().mockRejectedValue(
        new Error("OmniRoute request failed (500)"),
      ),
    } as unknown as OmniRouteClient;

    const provider = new OmniRouteLLMProvider(mockClient);

    await expect(
      provider.generate({
        prompt: "Generate error",
      }),
    ).rejects.toThrow("OmniRoute request failed (500)");
  });
});