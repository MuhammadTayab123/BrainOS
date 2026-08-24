import { EmbeddingsService } from "../../memory/embeddings.service";
import { EmbeddingResult } from "../../memory/memory.types";

export interface EmbedDocumentChunksInput {
  chunks: Array<{
    index: number;
    content: string;
  }>;
}

export interface DocumentChunkEmbedding {
  index: number;
  content: string;
  embedding: EmbeddingResult;
}

export interface EmbedDocumentChunksResult {
  chunks: DocumentChunkEmbedding[];
}

export class DocumentChunkEmbeddingService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async embedChunks(
    input: EmbedDocumentChunksInput,
  ): Promise<EmbedDocumentChunksResult> {
    const chunks = await Promise.all(
      input.chunks.map(async (chunk) => ({
        index: chunk.index,
        content: chunk.content,
        embedding:
          await this.embeddingsService.generate(
            chunk.content,
          ),
      })),
    );

    return {
      chunks,
    };
  }
}
