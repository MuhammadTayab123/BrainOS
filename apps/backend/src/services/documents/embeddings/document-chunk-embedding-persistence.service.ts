import {
  DocumentChunkEmbedding,
} from "./document-chunk-embedding.service";
import { DocumentChunkRepository } from "../repositories/chunks/document-chunk.repository";

export interface PersistDocumentChunkEmbeddingsInput {
  documentId: string;
  chunks: DocumentChunkEmbedding[];
}

export class DocumentChunkEmbeddingPersistenceService {
  constructor(
    private readonly documentChunkRepository: DocumentChunkRepository,
  ) {}

  async persist(
    input: PersistDocumentChunkEmbeddingsInput,
  ): Promise<void> {
    await Promise.all(
      input.chunks.map((chunk) =>
        this.documentChunkRepository.updateEmbedding(
          input.documentId,
          chunk.index,
          chunk.embedding.vector,
        ),
      ),
    );
  }
}
