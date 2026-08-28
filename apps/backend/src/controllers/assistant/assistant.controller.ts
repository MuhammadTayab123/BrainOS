
import { ConversationRepository } from "../../services/conversation/repositories/conversation.repository";
import { MessageRepository } from "../../services/conversation/repositories/message.repository";
import { Request, Response } from "express";
import { DocumentRetrievalService } from "../../services/documents/retrieval/document-retrieval.service";
import { DocumentChunkRepository } from "../../services/documents/repositories/chunks/document-chunk.repository";
import { LLMService } from "../../services/ai";
import { OllamaLLMProvider } from "../../services/ai/providers/ollama.provider";
import { EmbeddingsService } from "../../services/memory/embeddings.service";
import { MemoryService } from "../../services/memory/memory.service";
import { OllamaProvider } from "../../services/memory/providers";
import { AssistantService } from "../../services/assistant/assistant.service";
import { ToolExecutor } from "../../services/tools/tool.executor";
import { createToolRegistry } from "../../services/tools/tool.container";
const llmService = new LLMService(
  new OllamaLLMProvider(),
);

const embeddingsService = new EmbeddingsService(
  new OllamaProvider(),
);

const memoryService = new MemoryService(
  embeddingsService,
);

const toolRegistry = createToolRegistry();

const toolExecutor = new ToolExecutor(
  toolRegistry,
);

const conversationRepository =
  new ConversationRepository();

const messageRepository =
  new MessageRepository();
const documentChunkRepository =
  new DocumentChunkRepository();

const documentRetrievalService =
  new DocumentRetrievalService(
    embeddingsService,
    documentChunkRepository,
  );
const assistantService = new AssistantService(
  llmService,
  memoryService,
  toolExecutor,
  conversationRepository,
  messageRepository,
  documentRetrievalService,
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
  conversationId,
  systemPrompt,
  conversationHistory,
  enableMemoryRetrieval,
  memorySearchLimit,
  enableDocumentRetrieval,
  documentSearchLimit,
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
    conversationId !== undefined &&
    (typeof conversationId !== "string" ||
      conversationId.trim().length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message:
          "conversationId must be a non-empty string.",
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
if (
  enableDocumentRetrieval !== undefined &&
  typeof enableDocumentRetrieval !== "boolean"
) {
  return res.status(400).json({
    success: false,
    error: {
      code: "INVALID_DOCUMENT_RETRIEVAL",
      message:
        "enableDocumentRetrieval must be a boolean.",
    },
  });
}

if (
  documentSearchLimit !== undefined &&
  (!Number.isInteger(documentSearchLimit) ||
    documentSearchLimit < 1 ||
    documentSearchLimit > 20)
) {
  return res.status(400).json({
    success: false,
    error: {
      code: "INVALID_DOCUMENT_SEARCH_LIMIT",
      message:
        "documentSearchLimit must be an integer between 1 and 20.",
    },
  });
}
  const result = await assistantService.ask({
    userId: req.user.id,
    message,
        conversationId:
      typeof conversationId === "string"
        ? conversationId.trim()
        : undefined,
    systemPrompt,
    conversationHistory,
    enableMemoryRetrieval,
    memorySearchLimit,
    enableDocumentRetrieval,
    documentSearchLimit,
    model,
  });

  return res.status(200).json({
    success: true,
    data: result,
  });
}