import { describe, expect, it, vi } from "vitest";

import { AssistantService } from "../../src/services/assistant/assistant.service";
import { DocumentRetrievalService } from "../../src/services/documents/retrieval/document-retrieval.service";
import { MemoryService } from "../../src/services/memory/memory.service";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ConversationRepository } from "../../src/services/conversation/repositories/conversation.repository";
import { MessageRepository } from "../../src/services/conversation/repositories/message.repository";
import { LLMService } from "../../src/services/ai";

describe("AssistantService", () => {
  function createLlmServiceMock() {
    return {
      generate: vi.fn(),
    };
  }

  function createMemoryServiceMock() {
    return {
      searchMemories: vi.fn(),
    };
  }

  function createToolExecutorMock() {
    return {
      getToolDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn(),
    };
  }

  function createConversationRepositoryMock() {
    return {
      findByIdForUser: vi.fn(),
    };
  }

  function createMessageRepositoryMock() {
    return {
      listByConversation: vi.fn(),
      create: vi.fn(),
    };
  }

  function createDocumentRetrievalServiceMock() {
    return {
      search: vi.fn(),
    };
  }

  it("retrieves memory and passes assembled context to the LLM", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const documentRetrievalService =
      createDocumentRetrievalServiceMock();

    const retrievedMemories = [
      {
        id: "memory-1",
        content: "User is building BrainOS.",
        similarity: 0.92,
        importance: 0.8,
      },
    ];

    memoryService.searchMemories.mockResolvedValue(
      retrievedMemories,
    );

    llmService.generate.mockResolvedValue({
      text: "BrainOS is your AI assistant project.",
      model: "test-model",
      provider: "test",
      toolCalls: [],
    });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor as unknown as ToolExecutor,
      undefined,
      undefined,
      documentRetrievalService as unknown as DocumentRetrievalService,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "What am I building?",
    });

    expect(
      memoryService.searchMemories,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      query: "What am I building?",
      limit: undefined,
    });

    expect(
      llmService.generate,
    ).toHaveBeenCalledTimes(1);

    const generationInput =
      llmService.generate.mock.calls[0][0];

    expect(
      generationInput.systemPrompt,
    ).toContain(
      "[Relevant Context from Memory]",
    );

    expect(
      generationInput.systemPrompt,
    ).toContain(
      "User is building BrainOS.",
    );

    expect(result).toEqual({
      text: "BrainOS is your AI assistant project.",
      model: "test-model",
      provider: "test",
      retrievedMemories,
      retrievedDocuments: [],
    });
  });

  it("retrieves document context when document retrieval is enabled", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const documentRetrievalService =
      createDocumentRetrievalServiceMock();

    memoryService.searchMemories.mockResolvedValue(
      [],
    );

    const retrievedDocuments = [
      {
        id: "chunk-1",
        documentId: "document-1",
        chunkIndex: 0,
        content:
          "BrainOS uses semantic document retrieval.",
        similarity: 0.94,
      },
    ];

    documentRetrievalService.search.mockResolvedValue(
      retrievedDocuments,
    );

    llmService.generate.mockResolvedValue({
      text: "BrainOS uses semantic document retrieval.",
      model: "test-model",
      provider: "test",
      toolCalls: [],
    });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor as unknown as ToolExecutor,
      undefined,
      undefined,
      documentRetrievalService as unknown as DocumentRetrievalService,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "How does BrainOS retrieve documents?",
      enableDocumentRetrieval: true,
      documentSearchLimit: 5,
    });

    expect(
      documentRetrievalService.search,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      query:
        "How does BrainOS retrieve documents?",
      limit: 5,
    });

    const generationInput =
      llmService.generate.mock.calls[0][0];

    expect(
      generationInput.systemPrompt,
    ).toContain(
      "[Relevant Context from Documents]",
    );

    expect(
      generationInput.systemPrompt,
    ).toContain(
      "BrainOS uses semantic document retrieval.",
    );

    expect(result.retrievedDocuments).toEqual(
      retrievedDocuments,
    );
  });

  it("skips memory retrieval when disabled", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();

    memoryService.searchMemories.mockResolvedValue(
      [],
    );

    llmService.generate.mockResolvedValue({
      text: "Done.",
      model: "test-model",
      provider: "test",
      toolCalls: [],
    });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor as unknown as ToolExecutor,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "Hello",
      enableMemoryRetrieval: false,
    });

    expect(
      memoryService.searchMemories,
    ).not.toHaveBeenCalled();

    expect(result).toEqual({
      text: "Done.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });

  it("executes an LLM tool call and sends the tool result back to the LLM", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();

    memoryService.searchMemories.mockResolvedValue(
      [],
    );

    toolExecutor.getToolDefinitions.mockReturnValue(
      [
        {
          name: "test_tool",
          description: "Test tool",
          inputSchema: {},
        },
      ],
    );

    toolExecutor.execute.mockResolvedValue({
      success: true,
      message: "Tool executed successfully.",
    });

    llmService.generate
      .mockResolvedValueOnce({
        text: "",
        model: "test-model",
        provider: "test",
        toolCalls: [
          {
            id: "call-1",
            name: "test_tool",
            arguments: {
              value: "BrainOS",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "The test tool executed successfully.",
        model: "test-model",
        provider: "test",
        toolCalls: [],
      });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor as unknown as ToolExecutor,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "Run the test tool.",
    });

    expect(
      toolExecutor.execute,
    ).toHaveBeenCalledWith(
      "test_tool",
      {
        value: "BrainOS",
      },
      {
        userId: "user-1",
      },
    );

    expect(
      llmService.generate,
    ).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      text: "The test tool executed successfully.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });

  it("loads persistent conversation history and saves user and assistant messages", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const conversationRepository =
      createConversationRepositoryMock();
    const messageRepository =
      createMessageRepositoryMock();

    memoryService.searchMemories.mockResolvedValue(
      [],
    );

    conversationRepository.findByIdForUser.mockResolvedValue(
      {
        id: "conversation-1",
        userId: "user-1",
      },
    );

    messageRepository.listByConversation.mockResolvedValue(
      [
        {
          role: "USER",
          content: "Hello",
        },
        {
          role: "ASSISTANT",
          content: "Hi there.",
        },
      ],
    );

    messageRepository.create.mockResolvedValue(
      undefined,
    );

    llmService.generate.mockResolvedValue({
      text: "Welcome back to BrainOS.",
      model: "test-model",
      provider: "test",
      toolCalls: [],
    });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor as unknown as ToolExecutor,
      conversationRepository as unknown as ConversationRepository,
      messageRepository as unknown as MessageRepository,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "Continue our conversation.",
      conversationId: "conversation-1",
    });

    expect(
      conversationRepository.findByIdForUser,
    ).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
    );

    expect(
      messageRepository.listByConversation,
    ).toHaveBeenCalledWith(
      "conversation-1",
    );

    expect(
      messageRepository.create,
    ).toHaveBeenNthCalledWith(
      1,
      {
        conversationId:
          "conversation-1",
        role: "USER",
        content:
          "Continue our conversation.",
      },
    );

    expect(
      messageRepository.create,
    ).toHaveBeenNthCalledWith(
      2,
      {
        conversationId:
          "conversation-1",
        role: "ASSISTANT",
        content:
          "Welcome back to BrainOS.",
      },
    );

    const generationInput =
      llmService.generate.mock.calls[0][0];

    expect(
      generationInput.messages,
    ).toEqual([
      {
        role: "user",
        content: "Hello",
      },
      {
        role: "assistant",
        content: "Hi there.",
      },
    ]);

    expect(result).toEqual({
      text: "Welcome back to BrainOS.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });

  it("rejects a conversation that does not belong to the authenticated user", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const conversationRepository =
      createConversationRepositoryMock();
    const messageRepository =
      createMessageRepositoryMock();

    memoryService.searchMemories.mockResolvedValue(
      [],
    );

    conversationRepository.findByIdForUser.mockResolvedValue(
      null,
    );

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor as unknown as ToolExecutor,
      conversationRepository as unknown as ConversationRepository,
      messageRepository as unknown as MessageRepository,
    );

    await expect(
      service.ask({
        userId: "user-1",
        message: "Hello",
        conversationId: "conversation-1",
      }),
    ).rejects.toThrow(
      "Conversation not found for the authenticated user.",
    );
  });
});