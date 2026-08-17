/**
 * ============================================================================
 * BrainOS LLM Provider Abstraction
 * ============================================================================
 */

export type LLMMessageRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
}

export interface GenerateTextInput {
  prompt?: string;
  systemPrompt?: string;
  messages?: LLMMessage[];
  model?: string;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
}

export interface LLMProvider {
  generate(input: GenerateTextInput): Promise<LLMResponse>;
}
