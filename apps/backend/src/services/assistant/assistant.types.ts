import { LLMMessage } from "../ai";
import { MemorySearchResult } from "../memory/memory.types";
import { SearchDocumentChunkResult } from "../documents/retrieval/document-retrieval.service";

export interface AssistantMessageInput {
  userId: string;
  message: string;
  conversationId?: string;
  systemPrompt?: string;
  conversationHistory?: LLMMessage[];

  enableMemoryRetrieval?: boolean;
  memorySearchLimit?: number;

  enableDocumentRetrieval?: boolean;
  documentSearchLimit?: number;

  model?: string;
}

export interface AssistantResponse {
  text: string;
  model: string;
  provider: string;
  retrievedMemories: MemorySearchResult[];
  retrievedDocuments: SearchDocumentChunkResult[];
}

export interface AssembledContext {
  systemPrompt: string;
  messages: LLMMessage[];
  prompt: string;
  retrievedMemories: MemorySearchResult[];
  retrievedDocuments: SearchDocumentChunkResult[];
}