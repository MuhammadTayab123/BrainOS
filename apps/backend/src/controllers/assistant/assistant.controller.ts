import { Request, Response } from "express";

import { LLMService } from "../../services/ai";
import { OllamaLLMProvider } from "../../services/ai/providers/ollama.provider";
import { EmbeddingsService } from "../../services/memory/embeddings.service";
import { MemoryService } from "../../services/memory/memory.service";
import { OllamaProvider } from "../../services/memory/providers";
import { AssistantService } from "../../services/assistant/assistant.service";

const llmService = new LLMService(
  new OllamaLLMProvider(),
);

const embeddingsService = new EmbeddingsService(
  new OllamaProvider(),
);

const memoryService = new MemoryService(
  embeddingsService,
);

const assistantService = new AssistantService(
  llmService,
  memoryService,
);

export async function askAssistant(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const {
    message,
    systemPrompt,
    conversationHistory,
    enableMemoryRetrieval,
    memorySearchLimit,
    model,
  } = req.body;

  if (
    typeof message !== "string" ||
    message.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MESSAGE",
        message: "Message is required.",
      },
    });
  }

  if (
    systemPrompt !== undefined &&
    typeof systemPrompt !== "string"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SYSTEM_PROMPT",
        message: "systemPrompt must be a string.",
      },
    });
  }

  if (
    enableMemoryRetrieval !== undefined &&
    typeof enableMemoryRetrieval !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_RETRIEVAL",
        message: "enableMemoryRetrieval must be a boolean.",
      },
    });
  }

  if (
    memorySearchLimit !== undefined &&
    (!Number.isInteger(memorySearchLimit) ||
      memorySearchLimit < 1 ||
      memorySearchLimit > 50)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_SEARCH_LIMIT",
        message:
          "memorySearchLimit must be an integer between 1 and 50.",
      },
    });
  }

  if (
    model !== undefined &&
    typeof model !== "string"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MODEL",
        message: "model must be a string.",
      },
    });
  }

  const result = await assistantService.ask({
    userId: req.user.id,
    message,
    systemPrompt,
    conversationHistory,
    enableMemoryRetrieval,
    memorySearchLimit,
    model,
  });

  return res.status(200).json({
    success: true,
    data: result,
  });
}