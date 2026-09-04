import { describe, expect, it, vi } from "vitest";
import { AssistantRuntime } from "../../src/services/assistant/assistant.runtime";
import { AssistantService } from "../../src/services/assistant/assistant.service";
import { DocumentRetrievalService } from "../../src/services/documents/retrieval/document-retrieval.service";
import { MemoryService } from "../../src/services/memory/memory.service";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ConversationRepository } from "../../src/services/conversation/repositories/conversation.repository";
import { MessageRepository } from "../../src/services/conversation/repositories/message.repository";
import { LLMService } from "../../src/services/ai";
import { ToolRegistry } from "../../src/services/tools/tool.registry";
import { createDocumentSearchTool } from "../../src/services/tools/document.tools";

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
      updateTitleForUser: vi.fn(),
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

  it("retrieves document context with source references when document retrieval is enabled", async () => {
  const llmService = createLlmServiceMock();
  const memoryService = createMemoryServiceMock();
  const toolExecutor = createToolExecutorMock();
  const documentRetrievalService =
    createDocumentRetrievalServiceMock();

  memoryService.searchMemories.mockResolvedValue([]);

  const retrievedDocuments = [
    {
      id: "chunk-1",
      documentId: "document-1",
      documentTitle: "BrainOS Notes",
      sourceType: "TEXT",
      source: "brainos-notes",
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
    "Title: BrainOS Notes",
  );

  expect(
    generationInput.systemPrompt,
  ).toContain(
    "Source Type: TEXT",
  );

  expect(
    generationInput.systemPrompt,
  ).toContain(
    "Source: brainos-notes",
  );

  expect(
    generationInput.systemPrompt,
  ).toContain(
    "Chunk: 0",
  );

  expect(
    generationInput.systemPrompt,
  ).toContain(
    "Similarity: 0.94",
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

  it("automatically titles a conversation from its first user message", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const conversationRepository =
      createConversationRepositoryMock();
    const messageRepository =
      createMessageRepositoryMock();

    memoryService.searchMemories.mockResolvedValue([]);

    conversationRepository.findByIdForUser.mockResolvedValue({
      id: "conversation-1",
      userId: "user-1",
      title: null,
    });

    messageRepository.listByConversation.mockResolvedValue([]);
    messageRepository.create.mockResolvedValue(undefined);

    llmService.generate.mockResolvedValue({
      text: "Hello! How can I help?",
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

    await service.ask({
      userId: "user-1",
      message: "  Help me plan my BrainOS project.  ",
      conversationId: "conversation-1",
    });

    expect(
      messageRepository.create,
    ).toHaveBeenNthCalledWith(
      1,
      {
        conversationId: "conversation-1",
        role: "USER",
        content: "Help me plan my BrainOS project.",
      },
    );

    expect(
      conversationRepository.updateTitleForUser,
    ).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
      "Help me plan my BrainOS project.",
    );
  });

    it("truncates long conversation titles to 60 characters", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const conversationRepository =
      createConversationRepositoryMock();
    const messageRepository =
      createMessageRepositoryMock();

    memoryService.searchMemories.mockResolvedValue([]);

    conversationRepository.findByIdForUser.mockResolvedValue({
      id: "conversation-1",
      userId: "user-1",
      title: null,
    });

    messageRepository.listByConversation.mockResolvedValue([]);
    messageRepository.create.mockResolvedValue(undefined);

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
      conversationRepository as unknown as ConversationRepository,
      messageRepository as unknown as MessageRepository,
    );

    const longMessage =
      "This is a very long BrainOS conversation message that should be truncated when used as a title.";

    await service.ask({
      userId: "user-1",
      message: longMessage,
      conversationId: "conversation-1",
    });

    expect(
      conversationRepository.updateTitleForUser,
    ).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
      `${longMessage.slice(0, 57)}...`,
    );
  });

  it("preserves an existing conversation title", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const toolExecutor = createToolExecutorMock();
    const conversationRepository =
      createConversationRepositoryMock();
    const messageRepository =
      createMessageRepositoryMock();

    memoryService.searchMemories.mockResolvedValue([]);

    conversationRepository.findByIdForUser.mockResolvedValue({
      id: "conversation-1",
      userId: "user-1",
      title: "Existing conversation",
    });

    messageRepository.listByConversation.mockResolvedValue([]);
    messageRepository.create.mockResolvedValue(undefined);

    llmService.generate.mockResolvedValue({
      text: "Welcome back.",
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

    await service.ask({
      userId: "user-1",
      message: "Continue working on BrainOS.",
      conversationId: "conversation-1",
    });

    expect(
      conversationRepository.updateTitleForUser,
    ).not.toHaveBeenCalled();
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
        title: "Existing conversation",
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
    it("executes a registered task tool through the assistant loop", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();

    memoryService.searchMemories.mockResolvedValue(
      [],
    );

    const toolExecutor = new ToolExecutor({
      get: vi.fn((name: string) => {
        if (name !== "create_task") {
          return undefined;
        }

        return {
          name: "create_task",
          description:
            "Create a task for the authenticated BrainOS user.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
              },
            },
            required: ["title"],
          },
          execute: vi.fn().mockResolvedValue({
            id: "task-1",
            title: "Finish BrainOS RAG",
            status: "TODO",
          }),
        };
      }),
      getAll: vi.fn().mockReturnValue([
        {
          name: "create_task",
          description:
            "Create a task for the authenticated BrainOS user.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
              },
            },
            required: ["title"],
          },
        },
      ]),
    } as any);

    llmService.generate
      .mockResolvedValueOnce({
        text: "",
        model: "test-model",
        provider: "test",
        toolCalls: [
          {
            id: "call-create-task",
            name: "create_task",
            arguments: {
              title: "Finish BrainOS RAG",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "I created the task for you.",
        model: "test-model",
        provider: "test",
        toolCalls: [],
      });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor,
    );

    const result = await service.ask({
      userId: "user-1",
      message:
        "Create a task called Finish BrainOS RAG.",
    });

    expect(
      llmService.generate,
    ).toHaveBeenCalledTimes(2);

    const secondCall =
      llmService.generate.mock.calls[1][0];

    expect(secondCall.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          toolCallId:
            "call-create-task",
          toolName: "create_task",
          content: JSON.stringify({
            id: "task-1",
            title: "Finish BrainOS RAG",
            status: "TODO",
          }),
        }),
      ]),
    );

    expect(result).toEqual({
      text: "I created the task for you.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });
  it("updates runtime state during assistant execution", async () => {
  const llmService = createLlmServiceMock();
  const memoryService = createMemoryServiceMock();
  const toolExecutor = createToolExecutorMock();
  const runtime = new AssistantRuntime();

  memoryService.searchMemories.mockResolvedValue([]);

  llmService.generate.mockResolvedValue({
    text: "Hello from BrainOS.",
    model: "test-model",
    provider: "test",
    toolCalls: [],
  });

  const states: string[] = [];

  runtime.subscribe((event) => {
    if (event.type === "STATE_CHANGED") {
      states.push(event.snapshot.state);
    }
  });

  const service = new AssistantService(
    llmService as unknown as LLMService,
    memoryService as unknown as MemoryService,
    toolExecutor as unknown as ToolExecutor,
    undefined,
    undefined,
    undefined,
    runtime,
  );

  await service.ask({
    userId: "user-1",
    message: "Hello",
  });

  expect(states).toEqual([
  "IDLE",
  "THINKING",
  "SPEAKING",
  "IDLE",
]);
});

  it("executes document_search tool call and returns retrieval results to the LLM", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const documentRetrievalService =
      createDocumentRetrievalServiceMock();

    memoryService.searchMemories.mockResolvedValue([]);

    const sampleChunks = [
      {
        id: "chunk-1",
        documentId: "doc-1",
        documentTitle: "BrainOS Architecture",
        sourceType: "TEXT",
        source: null,
        chunkIndex: 0,
        content:
          "BrainOS provides personal companion intelligence.",
        similarity: 0.92,
      },
    ];

    documentRetrievalService.search.mockResolvedValue(
      sampleChunks,
    );

    const registry = new ToolRegistry();
    const documentTool = createDocumentSearchTool(
      documentRetrievalService as unknown as DocumentRetrievalService,
    );
    registry.register(documentTool);

    const toolExecutor = new ToolExecutor(registry);

    llmService.generate
      .mockResolvedValueOnce({
        text: "",
        model: "test-model",
        provider: "test",
        toolCalls: [
          {
            id: "call-doc-search",
            name: "document_search",
            arguments: {
              query: "BrainOS architecture",
              limit: 3,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Based on the documents, BrainOS provides personal companion intelligence.",
        model: "test-model",
        provider: "test",
        toolCalls: [],
      });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor,
      undefined,
      undefined,
      documentRetrievalService as unknown as DocumentRetrievalService,
    );

    const result = await service.ask({
      userId: "user-1",
      message:
        "Search documents for BrainOS architecture.",
    });

    expect(
      documentRetrievalService.search,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      query: "BrainOS architecture",
      limit: 3,
    });

    expect(
      llmService.generate,
    ).toHaveBeenCalledTimes(2);

    const secondCall =
      llmService.generate.mock.calls[1][0];

    expect(secondCall.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          toolCallId: "call-doc-search",
          toolName: "document_search",
          content: JSON.stringify(sampleChunks),
        }),
      ]),
    );

    expect(result).toEqual({
      text: "Based on the documents, BrainOS provides personal companion intelligence.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });

  it("handles unauthorized tool errors gracefully and passes error to LLM for next round", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const runtime = new AssistantRuntime();

    memoryService.searchMemories.mockResolvedValue([]);

    const registry = new ToolRegistry();
    registry.register({
      name: "computer_write_file",
      description: "Write to a file.",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: vi.fn(),
    });

    const toolExecutor = new ToolExecutor(registry);

    llmService.generate
      .mockResolvedValueOnce({
        text: "",
        model: "test-model",
        provider: "test",
        toolCalls: [
          {
            id: "call-write-file",
            name: "computer_write_file",
            arguments: {
              path: "notes.txt",
              content: "hello",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "I need your authorization before I can write to files.",
        model: "test-model",
        provider: "test",
        toolCalls: [],
      });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor,
      undefined,
      undefined,
      undefined,
      runtime,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "Write hello to notes.txt",
    });

    expect(llmService.generate).toHaveBeenCalledTimes(2);

    const secondCall =
      llmService.generate.mock.calls[1][0];

    expect(secondCall.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          toolCallId: "call-write-file",
          toolName: "computer_write_file",
          content: JSON.stringify({
            error:
              'Computer action "computer_write_file" requires authorization.',
          }),
        }),
      ]),
    );

    expect(result).toEqual({
      text: "I need your authorization before I can write to files.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });

  it("handles tool validation/execution errors gracefully and passes error to LLM for next round", async () => {
    const llmService = createLlmServiceMock();
    const memoryService = createMemoryServiceMock();
    const runtime = new AssistantRuntime();

    memoryService.searchMemories.mockResolvedValue([]);

    const registry = new ToolRegistry();
    registry.register({
      name: "create_task",
      description: "Create a task.",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: vi.fn().mockRejectedValue(
        new Error("title is required."),
      ),
    });

    const toolExecutor = new ToolExecutor(registry);

    llmService.generate
      .mockResolvedValueOnce({
        text: "",
        model: "test-model",
        provider: "test",
        toolCalls: [
          {
            id: "call-bad-task",
            name: "create_task",
            arguments: {},
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Please specify a title for the task.",
        model: "test-model",
        provider: "test",
        toolCalls: [],
      });

    const service = new AssistantService(
      llmService as unknown as LLMService,
      memoryService as unknown as MemoryService,
      toolExecutor,
      undefined,
      undefined,
      undefined,
      runtime,
    );

    const result = await service.ask({
      userId: "user-1",
      message: "Create an empty task",
    });

    expect(llmService.generate).toHaveBeenCalledTimes(2);

    const secondCall =
      llmService.generate.mock.calls[1][0];

    expect(secondCall.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "tool",
          toolCallId: "call-bad-task",
          toolName: "create_task",
          content: JSON.stringify({
            error: "title is required.",
          }),
        }),
      ]),
    );

    expect(result).toEqual({
      text: "Please specify a title for the task.",
      model: "test-model",
      provider: "test",
      retrievedMemories: [],
      retrievedDocuments: [],
    });
  });
});
