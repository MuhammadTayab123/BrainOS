/**
 * ============================================================================
 * BrainOS Memory Types
 * ============================================================================
 *
 * Shared domain contracts for the Memory Engine.
 *
 * This file must remain framework-independent.
 * Do NOT import Prisma, OpenAI, Express, or pgvector here.
 * ============================================================================
 */

export interface CreateMemoryInput {
  userId: string;
  content: string;
  importance?: number;
}

export interface SearchMemoryInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface ListMemoriesInput {
  userId: string;
  limit?: number;
}

export interface GetMemoryByIdInput {
  memoryId: string;
  userId: string;
}

export interface DeleteMemoryInput {
  memoryId: string;
  userId: string;
}

export interface UpdateMemoryInput {
  memoryId: string;
  userId: string;
  content?: string;
  importance?: number;
}

export interface UpdateMemoryData {
  content?: string;
  importance?: number;
}

export interface MemoryListResult {
  id: string;
  content: string;
  importance: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  similarity: number;
  importance: number;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  provider: string;
  model: string;
}