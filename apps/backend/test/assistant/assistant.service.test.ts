import { describe, expect, it, vi } from "vitest";

import { AssistantService } from "../../src/services/assistant/assistant.service";

describe("AssistantService", () => {
  it("retrieves memory and passes assembled context to the LLM", async () => {
    const retrievedMemories = [
      {
        id: "memory-1",
        content: "User is building BrainOS.",
        similarity: 0.92,
      },
    ];

    const memoryService = {
      searchMemories: vi.fn().mockResolvedValue(
        retrievedMemories,
      ),
    };

    const llmService = {
      generate: vi.fn().mockResolvedValue({
        text: "BrainOS is your AI assistant project.",
        model: "test-model",
        provider: "test",
      }),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
    );

    const result = await assistantService.ask({
      userId: "user-a",
      message: "What is BrainOS?",
      enableMemoryRetrieval: true,
      memorySearchLimit: 5,
    });

    expect(
      memoryService.searchMemories,
    ).toHaveBeenCalledWith({
      userId: "user-a",
      query: "What is BrainOS?",
      limit: 5,
    });

    expect(llmService.generate).toHaveBeenCalledTimes(1);

    const llmInput =
      llmService.generate.mock.calls[0][0];

    expect(llmInput.prompt).toBe(
      "What is BrainOS?",
    );

    expect(llmInput.systemPrompt).toContain(
      "User is building BrainOS.",
    );

    expect(result).toEqual({
      text: "BrainOS is your AI assistant project.",
      model: "test-model",
      provider: "test",
      retrievedMemories,
    });
  });

  it("skips memory retrieval when disabled", async () => {
    const memoryService = {
      searchMemories: vi.fn(),
    };

    const llmService = {
      generate: vi.fn().mockResolvedValue({
        text: "Hello.",
        model: "test-model",
        provider: "test",
      }),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
    );

    await assistantService.ask({
      userId: "user-a",
      message: "Hello",
      enableMemoryRetrieval: false,
    });

    expect(
      memoryService.searchMemories,
    ).not.toHaveBeenCalled();

    expect(llmService.generate).toHaveBeenCalledTimes(1);
  });
});