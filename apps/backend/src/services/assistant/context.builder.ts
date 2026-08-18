import { LLMMessage } from "../ai";
import { MemorySearchResult } from "../memory/memory.types";
import { AssembledContext } from "./assistant.types";

export const DEFAULT_SYSTEM_PROMPT =
  "You are BrainOS, a private personal AI assistant and second brain. Answer the user's questions accurately, concisely, and helpfully.";

export function formatMemoriesForContext(
  memories: MemorySearchResult[],
): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  const formatted = memories
    .map((memory, index) => `${index + 1}. ${memory.content}`)
    .join("\n");

  return `\n\n[Relevant Context from Memory]\n${formatted}`;
}

export function assembleAssistantContext(params: {
  message: string;
  systemPrompt?: string;
  conversationHistory?: LLMMessage[];
  retrievedMemories: MemorySearchResult[];
}): AssembledContext {
  const basePrompt =
    params.systemPrompt && params.systemPrompt.trim().length > 0
      ? params.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;

  const memoryContext = formatMemoriesForContext(
    params.retrievedMemories,
  );

  const finalSystemPrompt = `${basePrompt}${memoryContext}`;

  return {
    systemPrompt: finalSystemPrompt,
    messages: params.conversationHistory ?? [],
    prompt: params.message,
    retrievedMemories: params.retrievedMemories,
  };
}
