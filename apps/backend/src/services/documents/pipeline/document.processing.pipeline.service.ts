import { DocumentStatus } from "@prisma/client";

import { DocumentRepository } from "../repositories/document.repository";
import { DocumentChunkRepository } from "../repositories/chunks/document-chunk.repository";
import { DocumentProcessingService } from "../processing/document.processing.service";
import { DocumentChunkEmbeddingService } from "../embeddings/document-chunk-embedding.service";
import { DocumentChunkEmbeddingPersistenceService } from "../embeddings/document-chunk-embedding-persistence.service";

export interface ProcessDocumentPipelineInput {
  documentId: string;
  userId: string;
  content: string;
}

export class DocumentProcessingPipelineService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly documentProcessingService: DocumentProcessingService =
      new DocumentProcessingService(),
    private readonly documentChunkEmbeddingService: DocumentChunkEmbeddingService,
    private readonly documentChunkEmbeddingPersistenceService: DocumentChunkEmbeddingPersistenceService,
  ) {}

  async process(
    input: ProcessDocumentPipelineInput,
  ): Promise<void> {
    if (
      !input.documentId ||
      input.documentId.trim().length === 0
    ) {
      throw new Error(
        "Document ID is required for processing.",
      );
    }

    if (
      !input.userId ||
      input.userId.trim().length === 0
    ) {
      throw new Error(
        "User ID is required for document processing.",
      );
    }

    if (
      !input.content ||
      input.content.trim().length === 0
    ) {
      throw new Error(
        "Document content is required for processing.",
      );
    }

    const documentId = input.documentId.trim();
    const userId = input.userId.trim();

    try {
      const processed =
        this.documentProcessingService.process({
          content: input.content,
        });

      await this.documentChunkRepository.replaceChunks(
        documentId,
        processed.chunks.map((chunk) => ({
          documentId,
          chunkIndex: chunk.index,
          content: chunk.content,
        })),
      );

      const embedded =
        await this.documentChunkEmbeddingService.embedChunks({
          chunks: processed.chunks,
        });

      await this.documentChunkEmbeddingPersistenceService.persist(
        {
          documentId,
          chunks: embedded.chunks,
        },
      );

      await this.documentRepository.updateStatus(
        documentId,
        userId,
        DocumentStatus.READY,
      );
    } catch (error) {
      try {
        await this.documentRepository.updateStatus(
          documentId,
          userId,
          DocumentStatus.FAILED,
        );
      } catch {
        // Preserve the original processing error.
      }

      throw error;
    }
  }
}
