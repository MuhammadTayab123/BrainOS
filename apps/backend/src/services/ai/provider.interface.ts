/**
 * ============================================================================
 * BrainOS LLM Provider Abstraction
 * ============================================================================
 */

export type LLMMessageRole = "system" | "user" | "assistant" | "tool";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerateTextInput {
  prompt?: string;
  systemPrompt?: string;
  messages?: LLMMessage[];
  model?: string;
  tools?: LLMToolDefinition[];
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMProvider {
  generate(input: GenerateTextInput): Promise<LLMResponse>;
}
