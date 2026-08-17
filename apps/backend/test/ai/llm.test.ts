import { describe, expect, it, vi } from "vitest";

import {
  GenerateTextInput,
  LLMProvider,
  LLMResponse,
  LLMService,
  OllamaClient,
  OllamaLLMProvider,
} from "../../src/services/ai";

describe("LLMService", () => {
  it("delegates generation to the injected LLMProvider", async () => {
    const mockProvider: LLMProvider = {
      generate: vi.fn().mockResolvedValue({
        text: "Hello, I am BrainOS.",
        model: "test-model",
        provider: "mock",
      }),
    };

    const service = new LLMService(mockProvider);
    const input: GenerateTextInput = {
      prompt: "Introduce yourself",
      systemPrompt: "You are a helpful assistant",
    };

    const result = await service.generate(input);

    expect(mockProvider.generate).toHaveBeenCalledWith(input);
    expect(result).toEqual({
      text: "Hello, I am BrainOS.",
      model: "test-model",
      provider: "mock",
    });
  });

  it("propagates provider errors when generation fails", async () => {
    const mockProvider: LLMProvider = {
      generate: vi.fn().mockRejectedValue(new Error("Provider generation error")),
    };

    const service = new LLMService(mockProvider);

    await expect(
      service.generate({ prompt: "Test failure" }),
    ).rejects.toThrow("Provider generation error");
  });
});

describe("OllamaLLMProvider", () => {
  it("translates user prompt into Ollama chat request with default model", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "qwen2.5:3b",
        created_at: "2026-08-18T00:00:00Z",
        message: {
          role: "assistant",
          content: "Paris is the capital of France.",
        },
        done: true,
      }),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    const result = await provider.generate({
      prompt: "What is the capital of France?",
    });

    expect(mockClient.post).toHaveBeenCalledWith("/api/chat", {
      model: "qwen2.5:3b",
      messages: [
        {
          role: "user",
          content: "What is the capital of France?",
        },
      ],
      stream: false,
    });

    expect(result).toEqual({
      text: "Paris is the capital of France.",
      model: "qwen2.5:3b",
      provider: "ollama",
    });
  });

  it("includes systemPrompt and user prompt in the chat request", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "qwen2.5:3b",
        created_at: "2026-08-18T00:00:00Z",
        message: {
          role: "assistant",
          content: "I am ready to assist you.",
        },
        done: true,
      }),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    const result = await provider.generate({
      systemPrompt: "You are a concise assistant.",
      prompt: "Hello",
    });

    expect(mockClient.post).toHaveBeenCalledWith("/api/chat", {
      model: "qwen2.5:3b",
      messages: [
        {
          role: "system",
          content: "You are a concise assistant.",
        },
        {
          role: "user",
          content: "Hello",
        },
      ],
      stream: false,
    });

    expect(result.text).toBe("I am ready to assist you.");
  });

  it("handles conversational message history and custom model override", async () => {
    const mockClient = {
      post: vi.fn().mockResolvedValue({
        model: "custom-model:latest",
        created_at: "2026-08-18T00:00:00Z",
        message: {
          role: "assistant",
          content: "You said your name is Tayyab.",
        },
        done: true,
      }),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    const result = await provider.generate({
      model: "custom-model:latest",
      systemPrompt: "You remember user names.",
      messages: [
        { role: "user", content: "My name is Tayyab." },
        { role: "assistant", content: "Nice to meet you, Tayyab." },
      ],
      prompt: "What is my name?",
    });

    expect(mockClient.post).toHaveBeenCalledWith("/api/chat", {
      model: "custom-model:latest",
      messages: [
        { role: "system", content: "You remember user names." },
        { role: "user", content: "My name is Tayyab." },
        { role: "assistant", content: "Nice to meet you, Tayyab." },
        { role: "user", content: "What is my name?" },
      ],
      stream: false,
    });

    expect(result).toEqual({
      text: "You said your name is Tayyab.",
      model: "custom-model:latest",
      provider: "ollama",
    });
  });

  it("throws an error if no prompt, systemPrompt, or messages are provided", async () => {
    const mockClient = {
      post: vi.fn(),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    await expect(provider.generate({})).rejects.toThrow(
      "Cannot generate text without a prompt or messages.",
    );
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("propagates network or client failure from OllamaClient", async () => {
    const mockClient = {
      post: vi.fn().mockRejectedValue(new Error("Ollama request failed (500)")),
    } as unknown as OllamaClient;

    const provider = new OllamaLLMProvider(mockClient);

    await expect(
      provider.generate({ prompt: "Generate error" }),
    ).rejects.toThrow("Ollama request failed (500)");
  });
});
