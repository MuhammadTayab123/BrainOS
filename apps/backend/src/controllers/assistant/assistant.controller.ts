
import { ConversationRepository } from "../../services/conversation/repositories/conversation.repository";
import { MessageRepository } from "../../services/conversation/repositories/message.repository";
import { Request, Response } from "express";
import { DocumentRetrievalService } from "../../services/documents/retrieval/document-retrieval.service";
import { DocumentChunkRepository } from "../../services/documents/repositories/chunks/document-chunk.repository";
import {
  createLLMProvider,
  LLMService,
} from "../../services/ai";
import { EmbeddingsService } from "../../services/memory/embeddings.service";
import { MemoryService } from "../../services/memory/memory.service";
import { OllamaProvider } from "../../services/memory/providers";
import { AssistantService } from "../../services/assistant/assistant.service";
import { ToolExecutor } from "../../services/tools/tool.executor";
import { createToolRegistry } from "../../services/tools/tool.container";
import { AssistantRuntime } from "../../services/assistant/assistant.runtime";

const llmService = new LLMService(
  createLLMProvider(),
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

interface ValidatedAssistantRequest {
  message: string;
  conversationId?: string;
  systemPrompt?: string;
  conversationHistory?: unknown[];
  enableMemoryRetrieval?: boolean;
  memorySearchLimit?: number;
  enableDocumentRetrieval?: boolean;
  documentSearchLimit?: number;
  model?: string;
  authorizedComputerActions?: string[];
  timezone?: string;
}

type ValidationResult =
  | { success: true; data: ValidatedAssistantRequest }
  | { success: false; status: number; code: string; message: string };

function validateAssistantRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      success: false,
      status: 400,
      code: "INVALID_MESSAGE",
      message: "Message is required.",
    };
  }

  const raw = body as Record<string, unknown>;

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
    authorizedComputerActions,
    timezone,
  } = raw;

  if (typeof message !== "string" || message.trim().length === 0) {
    return {
      success: false,
      status: 400,
      code: "INVALID_MESSAGE",
      message: "Message is required.",
    };
  }

  if (
    conversationId !== undefined &&
    (typeof conversationId !== "string" || conversationId.trim().length === 0)
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_CONVERSATION_ID",
      message: "conversationId must be a non-empty string.",
    };
  }

  if (systemPrompt !== undefined && typeof systemPrompt !== "string") {
    return {
      success: false,
      status: 400,
      code: "INVALID_SYSTEM_PROMPT",
      message: "systemPrompt must be a string.",
    };
  }

  if (
    enableMemoryRetrieval !== undefined &&
    typeof enableMemoryRetrieval !== "boolean"
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_MEMORY_RETRIEVAL",
      message: "enableMemoryRetrieval must be a boolean.",
    };
  }

  if (
    memorySearchLimit !== undefined &&
    (!Number.isInteger(memorySearchLimit) ||
      (memorySearchLimit as number) < 1 ||
      (memorySearchLimit as number) > 50)
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_MEMORY_SEARCH_LIMIT",
      message: "memorySearchLimit must be an integer between 1 and 50.",
    };
  }

  if (model !== undefined && typeof model !== "string") {
    return {
      success: false,
      status: 400,
      code: "INVALID_MODEL",
      message: "model must be a string.",
    };
  }

  if (
    enableDocumentRetrieval !== undefined &&
    typeof enableDocumentRetrieval !== "boolean"
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_DOCUMENT_RETRIEVAL",
      message: "enableDocumentRetrieval must be a boolean.",
    };
  }

  if (
    documentSearchLimit !== undefined &&
    (!Number.isInteger(documentSearchLimit) ||
      (documentSearchLimit as number) < 1 ||
      (documentSearchLimit as number) > 20)
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_DOCUMENT_SEARCH_LIMIT",
      message: "documentSearchLimit must be an integer between 1 and 20.",
    };
  }

  if (
    authorizedComputerActions !== undefined &&
    (!Array.isArray(authorizedComputerActions) ||
      authorizedComputerActions.some(
        (action) => typeof action !== "string" || action.trim().length === 0,
      ))
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_AUTHORIZED_COMPUTER_ACTIONS",
      message:
        "authorizedComputerActions must be an array of non-empty strings.",
    };
  }

  if (
    timezone !== undefined &&
    (typeof timezone !== "string" || timezone.trim().length === 0)
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_TIMEZONE",
      message: "timezone must be a non-empty string.",
    };
  }

  const sanitizedAuthorizedComputerActions =
    authorizedComputerActions !== undefined
      ? (authorizedComputerActions as string[]).map((action: string) => action.trim())
      : undefined;

  const sanitizedTimezone =
    typeof timezone === "string" ? timezone.trim() : undefined;

  return {
    success: true,
    data: {
      message: message as string,
      conversationId:
        typeof conversationId === "string" ? conversationId.trim() : undefined,
      systemPrompt: systemPrompt as string | undefined,
      conversationHistory: conversationHistory as unknown[] | undefined,
      enableMemoryRetrieval: enableMemoryRetrieval as boolean | undefined,
      memorySearchLimit: memorySearchLimit as number | undefined,
      enableDocumentRetrieval: enableDocumentRetrieval as boolean | undefined,
      documentSearchLimit: documentSearchLimit as number | undefined,
      model: model as string | undefined,
      authorizedComputerActions: sanitizedAuthorizedComputerActions,
      timezone: sanitizedTimezone,
    },
  };
}

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (
      msg.includes("DATABASE_URL") ||
      msg.includes("PrismaClient") ||
      msg.includes("password") ||
      msg.includes("secret")
    ) {
      return "An internal server error occurred.";
    }
    return msg;
  }
  return "Assistant orchestration failed.";
}

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

  const validation = validateAssistantRequest(req.body);
  if (!validation.success) {
    return res.status(validation.status).json({
      success: false,
      error: {
        code: validation.code,
        message: validation.message,
      },
    });
  }

  const result = await assistantService.ask({
    userId: req.user.id,
    message: validation.data.message,
    conversationId: validation.data.conversationId,
    systemPrompt: validation.data.systemPrompt,
    conversationHistory: validation.data.conversationHistory as any,
    enableMemoryRetrieval: validation.data.enableMemoryRetrieval,
    memorySearchLimit: validation.data.memorySearchLimit,
    enableDocumentRetrieval: validation.data.enableDocumentRetrieval,
    documentSearchLimit: validation.data.documentSearchLimit,
    model: validation.data.model,
    authorizedComputerActions: validation.data.authorizedComputerActions,
    timezone: validation.data.timezone,
  });

  return res.status(200).json({
    success: true,
    data: result,
  });
}

export async function streamAssistant(
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

  const validation = validateAssistantRequest(req.body);
  if (!validation.success) {
    return res.status(validation.status).json({
      success: false,
      error: {
        code: validation.code,
        message: validation.message,
      },
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const runtime = new AssistantRuntime();
  let isClosed = false;

  const unsubscribe = runtime.subscribe((event) => {
    if (isClosed || res.writableEnded) {
      return;
    }

    if (event.type === "STATE_CHANGED") {
      res.write(formatSseEvent("state_changed", event.snapshot));
    } else if (event.type === "TASK_EVENT") {
      res.write(formatSseEvent("task_event", event.event));
    }
  });

  const cleanup = () => {
    if (!isClosed) {
      isClosed = true;
      unsubscribe();
    }
  };

  req.on("close", cleanup);

  try {
    const result = await assistantService.ask({
      userId: req.user.id,
      message: validation.data.message,
      conversationId: validation.data.conversationId,
      systemPrompt: validation.data.systemPrompt,
      conversationHistory: validation.data.conversationHistory as any,
      enableMemoryRetrieval: validation.data.enableMemoryRetrieval,
      memorySearchLimit: validation.data.memorySearchLimit,
      enableDocumentRetrieval: validation.data.enableDocumentRetrieval,
      documentSearchLimit: validation.data.documentSearchLimit,
      model: validation.data.model,
      authorizedComputerActions: validation.data.authorizedComputerActions,
      timezone: validation.data.timezone,
      runtime,
    });

    if (!isClosed && !res.writableEnded) {
      res.write(formatSseEvent("response", result));
      res.write(formatSseEvent("done", {}));
      res.end();
    }
  } catch (error) {
    if (!isClosed && !res.writableEnded) {
      const sanitized = sanitizeErrorMessage(error);
      res.write(formatSseEvent("error", { message: sanitized }));
      res.write(formatSseEvent("done", {}));
      res.end();
    }
  } finally {
    cleanup();
  }
}
