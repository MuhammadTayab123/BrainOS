import { LLMMessage, LLMService } from "../ai";
import { LLMToolCall } from "../ai/providers/llm.provider";
import { MemoryService } from "../memory/memory.service";
import { MemorySearchResult } from "../memory/memory.types";
import { ToolExecutor } from "../tools/tool.executor";

import {
  AssistantMessageInput,
  AssistantResponse,
} from "./assistant.types";
import { assembleAssistantContext } from "./context.builder";

import { ConversationRepository } from "../conversation/repositories/conversation.repository";
import { MessageRepository } from "../conversation/repositories/message.repository";

const MAX_TOOL_ROUNDS = 5;

export class AssistantService {
  constructor(
    private readonly llmService: LLMService,
    private readonly memoryService: MemoryService,
    private readonly toolExecutor: ToolExecutor,
    private readonly conversationRepository?: ConversationRepository,
    private readonly messageRepository?: MessageRepository,
  ) {}

  async ask(
    input: AssistantMessageInput,
  ): Promise<AssistantResponse> {
    if (!input.userId || input.userId.trim().length === 0) {
      throw new Error(
        "User ID is required for assistant orchestration.",
      );
    }

    if (!input.message || input.message.trim().length === 0) {
      throw new Error("Message cannot be empty.");
    }

    const userId = input.userId.trim();
    const trimmedMessage = input.message.trim();

    let retrievedMemories: MemorySearchResult[] = [];

    const shouldRetrieveMemories =
      input.enableMemoryRetrieval ?? true;

    if (shouldRetrieveMemories) {
      retrievedMemories =
        await this.memoryService.searchMemories({
          userId,
          query: trimmedMessage,
          limit: input.memorySearchLimit,
        });
    }

    let conversationHistory: LLMMessage[] =
      input.conversationHistory ?? [];

    /*
     * Persistent conversation mode.
     *
     * When conversationId is supplied, the conversation must belong
     * to the authenticated user and its stored messages become the
     * source of truth for conversation history.
     */
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
        throw new Error("Conversation ID is required.");
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
      });

    let messages: LLMMessage[] = [
      ...assembledContext.messages,
    ];

    let prompt: string | undefined =
      assembledContext.prompt;

    let llmResponse = await this.llmService.generate({
      systemPrompt: assembledContext.systemPrompt,
      messages,
      prompt,
      model: input.model,
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

      /*
       * Once a tool round begins, the current user message needs to
       * be part of the message history because subsequent LLM calls
       * no longer receive the standalone `prompt`.
       */
      if (prompt !== undefined) {
        messages.push({
          role: "user",
          content: prompt,
        });
      }

      messages.push({
        role: "assistant",
        content: llmResponse.text ?? "",
        toolCalls,
      });

      for (const toolCall of toolCalls) {
        const toolResult =
          await this.toolExecutor.execute(
            toolCall.name,
            toolCall.arguments,
            {
              userId,
            },
          );

        messages.push({
          role: "tool",
          content: JSON.stringify(toolResult),
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
      }

      llmResponse =
        await this.llmService.generate({
          systemPrompt: assembledContext.systemPrompt,
          messages,
          model: input.model,
        });

      prompt = undefined;
    }

    /*
     * Persist the final assistant response only when a persistent
     * conversation is being used.
     */
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

    return {
      text: llmResponse.text,
      model: llmResponse.model,
      provider: llmResponse.provider,
      retrievedMemories,
    };
  }
}