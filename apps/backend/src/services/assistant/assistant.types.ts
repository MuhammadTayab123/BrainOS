import { LLMMessage } from "../ai";
import { MemorySearchResult } from "../memory/memory.types";

/**
 * ============================================================================
 * BrainOS Assistant / Orchestrator Types
 * ============================================================================
 *
 * Domain contracts for AI Assistant orchestration.
 * Framework-independent: do NOT import Express or Prisma here.
 * ============================================================================
 */

export interface AssistantMessageInput {
  userId: string;
  message: string;
  conversationId?: string;
  systemPrompt?: string;
  conversationHistory?: LLMMessage[];
  enableMemoryRetrieval?: boolean;
  memorySearchLimit?: number;
  model?: string;
}

export interface AssistantResponse {
  text: string;
  model: string;
  provider: string;
  retrievedMemories: MemorySearchResult[];
}

export interface AssembledContext {
  systemPrompt: string;
  messages: LLMMessage[];
  prompt: string;
  retrievedMemories: MemorySearchResult[];
}
