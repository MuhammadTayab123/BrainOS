import { EmbeddingResult } from "../memory.types";

/**
 * ============================================================================
 * BrainOS Embedding Provider Contract
 * ============================================================================
 */

export interface EmbeddingProvider {
  embed(text: string): Promise<EmbeddingResult>;
}