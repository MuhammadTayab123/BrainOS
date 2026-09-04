import { env } from "../../../config/env";
import { OmniRouteClient } from "../clients/omniroute.client";
import {
  GenerateTextInput,
  LLMProvider,
  LLMResponse,
  LLMToolCall,
} from "./llm.provider";

interface OmniRouteToolDefinition {
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

interface OmniRouteMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OmniRouteChatRequest {
  model: string;
  messages: OmniRouteMessage[];
  tools?: OmniRouteToolDefinition[];
  stream: boolean;
}

interface OmniRouteChatResponse {
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

export class OmniRouteLLMProvider implements LLMProvider {
  constructor(
    private readonly client = new OmniRouteClient(),
  ) {}

  async generate(
    input: GenerateTextInput,
  ): Promise<LLMResponse> {
    const model = input.model ?? env.OMNIROUTE_MODEL;

    const messages: OmniRouteMessage[] = [];

    if (input.systemPrompt) {
      messages.push({
        role: "system",
        content: input.systemPrompt,
      });
    }

    if (input.messages && input.messages.length > 0) {
      for (const message of input.messages) {
        messages.push({
          role: message.role,
          content: message.content,
          tool_call_id: message.toolCallId,
          tool_calls: message.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          })),
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

    const tools: OmniRouteToolDefinition[] | undefined =
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

    const payload: OmniRouteChatRequest = {
      model,
      messages,
      tools,
      stream: false,
    };

    const response =
      await this.client.post<OmniRouteChatResponse>(
        "/v1/chat/completions",
        payload,
      );

    const responseMessage = response.choices?.[0]?.message;

    const toolCalls: LLMToolCall[] | undefined =
      responseMessage?.tool_calls &&
      responseMessage.tool_calls.length > 0
        ? responseMessage.tool_calls
            .filter(
              (toolCall) =>
                toolCall.function?.name &&
                toolCall.function.arguments !== undefined,
            )
            .map((toolCall, index) => ({
              id:
                toolCall.id ??
                `omniroute-tool-call-${index + 1}`,
              name: toolCall.function!.name!,
              arguments: JSON.parse(
                toolCall.function!.arguments!,
              ),
            }))
        : undefined;

    return {
      text: responseMessage?.content ?? "",
      model: response.model || model,
      provider: "omniroute",
      toolCalls,
    };
  }
}