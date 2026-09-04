import { LLMMessage } from "../ai";
import { MemorySearchResult } from "../memory/memory.types";
import { SearchDocumentChunkResult } from "../documents/retrieval/document-retrieval.service";
import { AssembledContext } from "./assistant.types";

export const DEFAULT_SYSTEM_PROMPT =
  "You are BrainOS, a private personal AI assistant and second brain. Answer the user's questions accurately, concisely, and helpfully.";

const DOCUMENT_SOURCE_INSTRUCTION =
  "When answering from document context, cite the relevant document sources using their exact [Source N] reference. Do not invent source references. If the answer is not supported by the provided document context, say so.";

export function formatMemoriesForContext(
  memories: MemorySearchResult[],
): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  const formatted = memories
    .map(
      (memory, index) =>
        `${index + 1}. ${memory.content}`,
    )
    .join("\n");

  return `\n\n[Relevant Context from Memory]\n${formatted}`;
}

export function formatDocumentsForContext(
  documents: SearchDocumentChunkResult[],
): string {
  if (
    !documents ||
    documents.length === 0
  ) {
    return "";
  }

  const formatted = documents
    .map(
      (document, index) =>
        [
          `[Source ${index + 1}]`,
          `Title: ${document.documentTitle}`,
          `Source Type: ${document.sourceType}`,
          `Source: ${document.source ?? "unknown"}`,
          `Chunk: ${document.chunkIndex}`,
          `Similarity: ${document.similarity.toFixed(2)}`,
          `Content: ${document.content}`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    `\n\n[Relevant Context from Documents]`,
    formatted,
    `\n[Document Source Instructions]`,
    DOCUMENT_SOURCE_INSTRUCTION,
  ].join("\n");
}

export function assembleAssistantContext(
  params: {
    message: string;
    systemPrompt?: string;
    conversationHistory?: LLMMessage[];
    retrievedMemories: MemorySearchResult[];
    retrievedDocuments: SearchDocumentChunkResult[];
    now?: Date;
    timezone?: string;
  },
): AssembledContext {
  const basePrompt =
    params.systemPrompt &&
    params.systemPrompt.trim().length > 0
      ? params.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;

  const now = params.now ?? new Date();

  let userLocalTime: string | undefined;
  if (params.timezone) {
    try {
      userLocalTime = new Intl.DateTimeFormat("en-US", {
        timeZone: params.timezone,
        dateStyle: "full",
        timeStyle: "long",
      }).format(now);
    } catch {
      // Ignore invalid timezone string and proceed without localized string
    }
  }

  const timezoneLines = [
    `Current UTC Time: ${now.toISOString()}`,
    params.timezone
      ? `User Timezone: ${params.timezone}${userLocalTime ? ` (Local: ${userLocalTime})` : ""}`
      : undefined,
    `Instructions for Date & Time Handling:`,
    `- Interpret all relative dates and times (such as "today", "tomorrow", "next Monday", "at 7 PM") in the user's local timezone${params.timezone ? ` (${params.timezone})` : ""}.`,
    `- When invoking tools that require an ISO 8601 timestamp (such as dueAt in create_task), compute the exact moment in time based on the user's local timezone and output a valid ISO 8601 string (in UTC or with the proper timezone offset).`,
  ]
    .filter(Boolean)
    .join("\n");

  const timeContext = `[Date and Time Context]\n${timezoneLines}`;

  const memoryContext =
    formatMemoriesForContext(
      params.retrievedMemories,
    );

  const documentContext =
    formatDocumentsForContext(
      params.retrievedDocuments,
    );

  const finalSystemPrompt =
  `${basePrompt}

${timeContext}

When answering the user's question, use the retrieved document context below when it is relevant.

IMPORTANT DOCUMENT RULES:
- Treat retrieved document context as authoritative context for the user's question.
- If the answer is explicitly present in the retrieved documents, answer directly from that information.
- Do not claim that information is unavailable when it is present in the retrieved documents.
- Do not ignore retrieved document context.
- If the retrieved documents do not contain the answer, say that the available documents do not contain enough information.

${memoryContext}

${documentContext}`;

  return {
    systemPrompt: finalSystemPrompt,
    messages:
      params.conversationHistory ?? [],
    prompt: params.message,
    retrievedMemories:
      params.retrievedMemories,
    retrievedDocuments:
      params.retrievedDocuments,
  };
}