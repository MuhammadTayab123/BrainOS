import { LLMMessage } from "../ai";
import { MemorySearchResult } from "../memory/memory.types";
import { SearchDocumentChunkResult } from "../documents/retrieval/document-retrieval.service";
import { AssembledContext } from "./assistant.types";

export const DEFAULT_SYSTEM_PROMPT =
  "You are BrainOS, a private personal AI assistant and second brain. Answer the user's questions accurately, concisely, and helpfully.";

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
          `[Document ${index + 1}]`,
          `Title: ${document.documentTitle}`,
          `Source Type: ${document.sourceType}`,
          `Source: ${document.source ?? "unknown"}`,
          `Chunk: ${document.chunkIndex}`,
          `Similarity: ${document.similarity.toFixed(2)}`,
          `Content: ${document.content}`,
        ].join("\n"),
    )
    .join("\n\n");

  return `\n\n[Relevant Context from Documents]\n${formatted}`;
}

export function assembleAssistantContext(
  params: {
    message: string;
    systemPrompt?: string;
    conversationHistory?: LLMMessage[];
    retrievedMemories: MemorySearchResult[];
    retrievedDocuments: SearchDocumentChunkResult[];
  },
): AssembledContext {
  const basePrompt =
    params.systemPrompt &&
    params.systemPrompt.trim().length > 0
      ? params.systemPrompt.trim()
      : DEFAULT_SYSTEM_PROMPT;

  const memoryContext =
    formatMemoriesForContext(
      params.retrievedMemories,
    );

  const documentContext =
    formatDocumentsForContext(
      params.retrievedDocuments,
    );

  const finalSystemPrompt =
    `${basePrompt}${memoryContext}${documentContext}`;

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