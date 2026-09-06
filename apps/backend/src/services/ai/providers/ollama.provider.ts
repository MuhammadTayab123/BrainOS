import { env } from "../../../config/env";
import { OllamaClient } from "../clients/ollama.client";
import {
  GenerateTextInput,
  LLMProvider,
  LLMResponse,
  LLMToolCall,
} from "./llm.provider";

interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OllamaToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  tools?: OllamaToolDefinition[];
  stream: boolean;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
}
export class OllamaLLMProvider implements LLMProvider {
  constructor(private readonly client = new OllamaClient()) {}

  async generate(input: GenerateTextInput): Promise<LLMResponse> {
    const model = input.model ?? env.OLLAMA_CHAT_MODEL;

    const messages: OllamaChatMessage[] = [];

    if (input.systemPrompt) {
      messages.push({
        role: "system",
        content: input.systemPrompt,
      });
    }

    if (input.messages && input.messages.length > 0) {
      for (const msg of input.messages) {
        messages.push({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            function: {
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
          })),
          tool_name: msg.toolName,
        });
      }
    }

    if (input.prompt) {
      messages.push({
        role: "user",
        content: input.prompt,
      });
    }

    if (messages.length === 0) {
      throw new Error("Cannot generate text without a prompt or messages.");
    }

    const tools: OllamaToolDefinition[] | undefined =
      input.tools && input.tools.length > 0
        ? input.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          }))
        : undefined;

    if (input.onToken) {
      const payload: OllamaChatRequest = {
        model,
        messages,
        tools,
        stream: true,
      };

      const response = await this.client.postStream(
        "/api/chat",
        payload,
        ...(input.signal ? [input.signal] : []),
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      let responseModel = model;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              continue;
            }

            try {
              const chunk = JSON.parse(trimmed) as OllamaChatResponse;
              if (chunk.model) {
                responseModel = chunk.model;
              }
              const content = chunk.message?.content;
              if (content) {
                accumulatedText += content;
                input.onToken(content);
              }
            } catch {
              // Ignore malformed chunk lines safely
            }
          }
        }

        buffer += decoder.decode();
        const trimmed = buffer.trim();
        if (trimmed) {
          try {
            const chunk = JSON.parse(trimmed) as OllamaChatResponse;
            if (chunk.model) {
              responseModel = chunk.model;
            }
            const content = chunk.message?.content;
            if (content) {
              accumulatedText += content;
              input.onToken(content);
            }
          } catch {
            // Ignore malformed chunk safely
          }
        }
      } finally {
        reader.releaseLock();
      }

      return {
        text: accumulatedText,
        model: responseModel,
        provider: "ollama",
        toolCalls: undefined,
      };
    }

    const payload: OllamaChatRequest = {
      model,
      messages,
      tools,
      stream: false,
    };
    const response = await this.client.post<OllamaChatResponse>(
      "/api/chat",
      payload,
      ...(input.signal ? [input.signal] : []),
    );

    const toolCalls: LLMToolCall[] | undefined =
      response.message?.tool_calls && response.message.tool_calls.length > 0
        ? response.message.tool_calls.map((toolCall, index) => ({
            id: toolCall.id ?? `ollama-tool-call-${index + 1}`,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          }))
        : undefined;

    return {
      text: response.message?.content ?? "",
      model: response.model || model,
      provider: "ollama",
      toolCalls,
    };
  }
}
