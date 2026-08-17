import { env } from "../../../config/env";
import { OllamaClient } from "../clients/ollama.client";
import {
  GenerateTextInput,
  LLMProvider,
  LLMResponse,
} from "./llm.provider";

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaLLMProvider implements LLMProvider {
  constructor(
    private readonly client = new OllamaClient()
  ) {}

  async generate(
    input: GenerateTextInput,
  ): Promise<LLMResponse> {
    const model =
      input.model ?? env.OLLAMA_CHAT_MODEL;

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
      throw new Error(
        "Cannot generate text without a prompt or messages.",
      );
    }

    const payload: OllamaChatRequest = {
      model,
      messages,
      stream: false,
    };

    const response =
      await this.client.post<OllamaChatResponse>(
        "/api/chat",
        payload,
      );

    return {
      text: response.message?.content ?? "",
      model: response.model || model,
      provider: "ollama",
    };
  }
}
