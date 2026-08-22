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

    const toolExecutor = {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn(),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
      toolExecutor as any,
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

    const toolExecutor = {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn(),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
      toolExecutor as any,
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

  it("executes an LLM tool call and sends the tool result back to the LLM", async () => {
    const memoryService = {
      searchMemories: vi.fn().mockResolvedValue([]),
    };

    const llmService = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          text: "",
          model: "test-model",
          provider: "test",
          toolCalls: [
            {
              id: "call-1",
              name: "test_tool",
              arguments: {
                message: "Hello from BrainOS",
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          text: "The test tool executed successfully.",
          model: "test-model",
          provider: "test",
        }),
    };

    const toolExecutor = {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn().mockResolvedValue({
        success: true,
        message:
          "BrainOS tool execution is working.",
        input: {
          message: "Hello from BrainOS",
        },
        userId: "user-a",
      }),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
      toolExecutor as any,
    );

    const result = await assistantService.ask({
      userId: "user-a",
      message: "Use the test tool.",
      enableMemoryRetrieval: false,
    });

    expect(
      toolExecutor.execute,
    ).toHaveBeenCalledTimes(1);

    expect(
      toolExecutor.execute,
    ).toHaveBeenCalledWith(
      "test_tool",
      {
        message: "Hello from BrainOS",
      },
      {
        userId: "user-a",
      },
    );

    expect(llmService.generate).toHaveBeenCalledTimes(2);

    const secondLlmInput =
      llmService.generate.mock.calls[1][0];

    expect(secondLlmInput.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          toolCalls: [
            {
              id: "call-1",
              name: "test_tool",
              arguments: {
                message: "Hello from BrainOS",
              },
            },
          ],
        }),
        expect.objectContaining({
          role: "tool",
          toolCallId: "call-1",
          toolName: "test_tool",
        }),
      ]),
    );

    expect(result).toEqual({
      text: "The test tool executed successfully.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
    });
  });

  it("loads persistent conversation history and saves user and assistant messages", async () => {
    const memoryService = {
      searchMemories: vi.fn().mockResolvedValue([]),
    };

    const llmService = {
      generate: vi.fn().mockResolvedValue({
        text: "Welcome back to BrainOS.",
        model: "test-model",
        provider: "test",
      }),
    };

    const toolExecutor = {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn(),
    };

    const conversationRepository = {
      findByIdForUser: vi.fn().mockResolvedValue({
        id: "conversation-a",
        title: "BrainOS conversation",
        createdAt: new Date(
          "2026-01-01T00:00:00.000Z",
        ),
        updatedAt: new Date(
          "2026-01-01T00:00:00.000Z",
        ),
      }),
    };

    const messageRepository = {
      listByConversation: vi.fn().mockResolvedValue([
        {
          id: "message-1",
          conversationId: "conversation-a",
          role: "USER",
          content: "Hello BrainOS",
          createdAt: new Date(
            "2026-01-01T00:00:00.000Z",
          ),
          updatedAt: new Date(
            "2026-01-01T00:00:00.000Z",
          ),
        },
        {
          id: "message-2",
          conversationId: "conversation-a",
          role: "ASSISTANT",
          content: "Hello! How can I help?",
          createdAt: new Date(
            "2026-01-01T00:01:00.000Z",
          ),
          updatedAt: new Date(
            "2026-01-01T00:01:00.000Z",
          ),
        },
      ]),

      create: vi.fn().mockImplementation(
        async (data) => ({
          id: "new-message",
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
      toolExecutor as any,
      conversationRepository as any,
      messageRepository as any,
    );

    const result = await assistantService.ask({
      userId: "user-a",
      conversationId: "conversation-a",
      message: "What can you help me with?",
      enableMemoryRetrieval: false,
    });

    expect(
      conversationRepository.findByIdForUser,
    ).toHaveBeenCalledWith(
      "conversation-a",
      "user-a",
    );

    expect(
      messageRepository.listByConversation,
    ).toHaveBeenCalledWith(
      "conversation-a",
    );

    expect(
      messageRepository.create,
    ).toHaveBeenNthCalledWith(
      1,
      {
        conversationId: "conversation-a",
        role: "USER",
        content:
          "What can you help me with?",
      },
    );

    expect(
      llmService.generate,
    ).toHaveBeenCalledTimes(1);

    const llmInput =
      llmService.generate.mock.calls[0][0];

    expect(llmInput.messages).toEqual([
      {
        role: "user",
        content: "Hello BrainOS",
      },
      {
        role: "assistant",
        content:
          "Hello! How can I help?",
      },
    ]);

    expect(llmInput.prompt).toBe(
      "What can you help me with?",
    );

    expect(
      messageRepository.create,
    ).toHaveBeenNthCalledWith(
      2,
      {
        conversationId: "conversation-a",
        role: "ASSISTANT",
        content:
          "Welcome back to BrainOS.",
      },
    );

    expect(result).toEqual({
      text: "Welcome back to BrainOS.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
    });
  });

  it("rejects a conversation that does not belong to the authenticated user", async () => {
    const memoryService = {
      searchMemories: vi.fn().mockResolvedValue([]),
    };

    const llmService = {
      generate: vi.fn(),
    };

    const toolExecutor = {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn(),
    };

    const conversationRepository = {
      findByIdForUser: vi.fn().mockResolvedValue(null),
    };

    const messageRepository = {
      listByConversation: vi.fn(),
      create: vi.fn(),
    };

    const assistantService = new AssistantService(
      llmService as any,
      memoryService as any,
      toolExecutor as any,
      conversationRepository as any,
      messageRepository as any,
    );

    await expect(
      assistantService.ask({
        userId: "user-a",
        conversationId: "conversation-b",
        message: "This should not work.",
        enableMemoryRetrieval: false,
      }),
    ).rejects.toThrow(
      "Conversation not found for the authenticated user.",
    );

    expect(
      messageRepository.listByConversation,
    ).not.toHaveBeenCalled();

    expect(
      messageRepository.create,
    ).not.toHaveBeenCalled();

    expect(
      llmService.generate,
    ).not.toHaveBeenCalled();
  });
});