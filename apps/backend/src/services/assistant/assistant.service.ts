import { LLMMessage, LLMService } from "../ai";
import { LLMToolCall } from "../ai/providers/llm.provider";

import { MemoryService } from "../memory/memory.service";
import { MemorySearchResult } from "../memory/memory.types";

import { ToolExecutor } from "../tools/tool.executor";

import { DocumentRetrievalService } from "../documents/retrieval/document-retrieval.service";
import { SearchDocumentChunkResult } from "../documents/retrieval/document-retrieval.service";

import {
  AssistantMessageInput,
  AssistantResponse,
} from "./assistant.types";

import { assembleAssistantContext } from "./context.builder";

import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { decideAssistantRetrieval } from "./assistant.retrieval.policy";
import { MessageRepository } from "../conversation/repositories/message.repository";
import { AssistantRuntime } from "./assistant.runtime";

const MAX_TOOL_ROUNDS = 5;

export class AssistantService {
  constructor(
    private readonly llmService: LLMService,
    private readonly memoryService: MemoryService,
    private readonly toolExecutor: ToolExecutor,
    private readonly conversationRepository?: ConversationRepository,
    private readonly messageRepository?: MessageRepository,
    private readonly documentRetrievalService?: DocumentRetrievalService,
    private readonly runtime: AssistantRuntime = new AssistantRuntime(),
  ) {}

  async ask(
    input: AssistantMessageInput,
  ): Promise<AssistantResponse> {
    if (
      !input.userId ||
      input.userId.trim().length === 0
    ) {
      throw new Error(
        "User ID is required for assistant orchestration.",
      );
    }

    if (
      !input.message ||
      input.message.trim().length === 0
    ) {
      throw new Error(
        "Message cannot be empty.",
      );
    }

    const userId = input.userId.trim();
    const trimmedMessage = input.message.trim();

    this.runtime.setState("THINKING");

    const retrievedMemories: MemorySearchResult[] = [];
    const retrievedDocuments: SearchDocumentChunkResult[] = [];

    const retrievalPolicy =
      decideAssistantRetrieval(input);

    if (retrievalPolicy.memory) {
      const memories =
        await this.memoryService.searchMemories({
          userId,
          query: trimmedMessage,
          limit: input.memorySearchLimit,
        });

      retrievedMemories.push(...memories);
    }

    if (
      retrievalPolicy.documents &&
      this.documentRetrievalService
    ) {
      const documents =
        await this.documentRetrievalService.search({
          userId,
          query: trimmedMessage,
          limit: input.documentSearchLimit,
        });

      retrievedDocuments.push(...documents);
    }

    let conversationHistory: LLMMessage[] =
      input.conversationHistory ?? [];

    if (input.conversationId) {
      if (
        !this.conversationRepository ||
        !this.messageRepository
      ) {
        throw new Error(
          "Conversation persistence dependencies are required.",
        );
      }

      const conversationId =
        input.conversationId.trim();

      if (!conversationId) {
        throw new Error(
          "Conversation ID is required.",
        );
      }

      const conversation =
        await this.conversationRepository.findByIdForUser(
          conversationId,
          userId,
        );

      if (!conversation) {
        throw new Error(
          "Conversation not found for the authenticated user.",
        );
      }

      const storedMessages =
        await this.messageRepository.listByConversation(
          conversationId,
        );

      conversationHistory =
        storedMessages.map((message) => ({
          role: message.role.toLowerCase() as
            | "system"
            | "user"
            | "assistant",
          content: message.content,
        }));

      await this.messageRepository.create({
        conversationId,
        role: "USER",
        content: trimmedMessage,
      });
    }

    const assembledContext =
      assembleAssistantContext({
        message: trimmedMessage,
        systemPrompt: input.systemPrompt,
        conversationHistory,
        retrievedMemories,
        retrievedDocuments,
      });

    let messages: LLMMessage[] = [
      ...assembledContext.messages,
    ];

    let prompt:
      | string
      | undefined =
      assembledContext.prompt;

    const tools =
      this.toolExecutor.getToolDefinitions();

    let llmResponse =
      await this.llmService.generate({
        systemPrompt:
          assembledContext.systemPrompt,
        messages,
        prompt,
        model: input.model,
        tools,
      });

    for (
      let round = 0;
      round < MAX_TOOL_ROUNDS;
      round++
    ) {
      const toolCalls: LLMToolCall[] =
        llmResponse.toolCalls ?? [];

      if (toolCalls.length === 0) {
        break;
      }

      if (prompt !== undefined) {
        messages.push({
          role: "user",
          content: prompt,
        });
      }

      messages.push({
        role: "assistant",
        content:
          llmResponse.text ?? "",
        toolCalls,
      });

      for (const toolCall of toolCalls) {
        const taskId =
          `task-${toolCall.id}`;

        this.runtime.startTask(taskId);

        this.runtime.progressTask(
          taskId,
          `Executing ${toolCall.name}.`,
        );

        try {
          const toolResult =
            await this.toolExecutor.execute(
              toolCall.name,
              toolCall.arguments,
              {
  userId,
  authorizedComputerActions:
    input.authorizedComputerActions,
},
            );

          this.runtime.completeTask(
            taskId,
            `${toolCall.name} completed.`,
          );

          messages.push({
            role: "tool",
            content:
              JSON.stringify(toolResult),
            toolCallId: toolCall.id,
            toolName: toolCall.name,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Tool execution failed.";

          this.runtime.failTask(
            taskId,
            errorMessage,
          );

          messages.push({
            role: "tool",
            content: JSON.stringify({
              error: errorMessage,
            }),
            toolCallId: toolCall.id,
            toolName: toolCall.name,
          });
        }
      }

      llmResponse =
        await this.llmService.generate({
          systemPrompt:
            assembledContext.systemPrompt,
          messages,
          model: input.model,
          tools,
        });

      prompt = undefined;
    }

    if (
      input.conversationId &&
      this.messageRepository
    ) {
      await this.messageRepository.create({
        conversationId:
          input.conversationId.trim(),
        role: "ASSISTANT",
        content: llmResponse.text,
      });
    }

    this.runtime.setState("SPEAKING");

    const response: AssistantResponse = {
      text: llmResponse.text,
      model: llmResponse.model,
      provider: llmResponse.provider,
      retrievedMemories,
      retrievedDocuments,
    };

    this.runtime.setState("IDLE");

    return response;
  }
}