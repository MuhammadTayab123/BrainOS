import { EmbeddingsService } from "../../memory/embeddings.service";
import { DocumentSourceReference } from "../document.types";
import { DocumentChunkRepository } from "../repositories/chunks/document-chunk.repository";

export interface SearchDocumentChunksInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface SearchDocumentChunkResult
  extends DocumentSourceReference {
  id: string;
  content: string;
  similarity: number;
}

const DEFAULT_SEARCH_LIMIT = 5;

export class DocumentRetrievalService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
    private readonly documentChunkRepository: DocumentChunkRepository,
  ) {}

  async search(
    input: SearchDocumentChunksInput,
  ): Promise<SearchDocumentChunkResult[]> {
    if (
      !input.userId ||
      input.userId.trim().length === 0
    ) {
      throw new Error("User ID is required.");
    }

    if (
      !input.query ||
      input.query.trim().length === 0
    ) {
      throw new Error("Search query is required.");
    }

    const limit =
      input.limit ?? DEFAULT_SEARCH_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 20
    ) {
      throw new Error(
        "Search limit must be an integer between 1 and 20.",
      );
    }

    const embedding =
      await this.embeddingsService.generate(
        input.query.trim(),
      );

    return this.documentChunkRepository.searchSimilar(
      input.userId,
      embedding.vector,
      limit,
    );
  }
}
