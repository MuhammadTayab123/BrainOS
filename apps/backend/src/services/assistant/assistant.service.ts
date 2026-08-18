import { LLMService } from "../ai";
import { MemoryService } from "../memory/memory.service";
import { MemorySearchResult } from "../memory/memory.types";
import {
  AssistantMessageInput,
  AssistantResponse,
} from "./assistant.types";
import { assembleAssistantContext } from "./context.builder";

export class AssistantService {
  constructor(
    private readonly llmService: LLMService,
    private readonly memoryService: MemoryService,
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

    const llmResponse =
      await this.llmService.generate({
        systemPrompt: assembledContext.systemPrompt,
        messages: assembledContext.messages,
        prompt: assembledContext.prompt,
        model: input.model,
      });

    return {
      text: llmResponse.text,
      model: llmResponse.model,
      provider: llmResponse.provider,
      retrievedMemories,
    };
  }
}
