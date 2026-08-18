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

const MAX_TOOL_ROUNDS = 5;

export class AssistantService {
 constructor(
  private readonly llmService: LLMService,
  private readonly memoryService: MemoryService,
  private readonly toolExecutor: ToolExecutor,
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

    const trimmedMessage = input.message.trim();

    let retrievedMemories: MemorySearchResult[] = [];

    const shouldRetrieveMemories =
      input.enableMemoryRetrieval ?? true;

    if (shouldRetrieveMemories) {
      retrievedMemories =
        await this.memoryService.searchMemories({
          userId: input.userId,
          query: trimmedMessage,
          limit: input.memorySearchLimit,
        });
    }

    const assembledContext =
      assembleAssistantContext({
        message: trimmedMessage,
        systemPrompt: input.systemPrompt,
        conversationHistory: input.conversationHistory,
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
              userId: input.userId,
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

    return {
      text: llmResponse.text,
      model: llmResponse.model,
      provider: llmResponse.provider,
      retrievedMemories,
    };
  }
}