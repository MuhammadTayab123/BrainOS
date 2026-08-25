import { describe, expect, it, vi } from "vitest";
import { DocumentStatus } from "@prisma/client";

import { DocumentRepository } from "../../../src/services/documents/repositories/document.repository";
import { DocumentChunkRepository } from "../../../src/services/documents/repositories/chunks/document-chunk.repository";
import { DocumentProcessingService } from "../../../src/services/documents/processing/document.processing.service";
import { DocumentChunkEmbeddingService } from "../../../src/services/documents/embeddings/document-chunk-embedding.service";
import { DocumentChunkEmbeddingPersistenceService } from "../../../src/services/documents/embeddings/document-chunk-embedding-persistence.service";
import { DocumentProcessingPipelineService } from "../../../src/services/documents/pipeline/document.processing.pipeline.service";

describe("DocumentProcessingPipelineService", () => {
  it("chunks, embeds, persists, and marks a document READY", async () => {
    const documentRepository = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    const documentChunkRepository = {
      replaceChunks: vi.fn().mockResolvedValue(undefined),
    };

    const documentProcessingService = {
      process: vi.fn().mockReturnValue({
        chunks: [
          {
            index: 0,
            content: "First chunk",
          },
          {
            index: 1,
            content: "Second chunk",
          },
        ],
      }),
    };

    const documentChunkEmbeddingService = {
      embedChunks: vi.fn().mockResolvedValue({
        chunks: [
          {
            index: 0,
            content: "First chunk",
            embedding: {
              vector: [1, 0, 0],
              dimensions: 3,
              provider: "test",
              model: "test-model",
            },
          },
          {
            index: 1,
            content: "Second chunk",
            embedding: {
              vector: [0, 1, 0],
              dimensions: 3,
              provider: "test",
              model: "test-model",
            },
          },
        ],
      }),
    };

    const documentChunkEmbeddingPersistenceService = {
      persist: vi.fn().mockResolvedValue(undefined),
    };

    const service =
      new DocumentProcessingPipelineService(
        documentRepository as unknown as DocumentRepository,
        documentChunkRepository as unknown as DocumentChunkRepository,
        documentProcessingService as unknown as DocumentProcessingService,
        documentChunkEmbeddingService as unknown as DocumentChunkEmbeddingService,
        documentChunkEmbeddingPersistenceService as unknown as DocumentChunkEmbeddingPersistenceService,
      );

    await service.process({
      documentId: "document-1",
      userId: "user-1",
      content: "Document content",
    });

    expect(
      documentProcessingService.process,
    ).toHaveBeenCalledWith({
      content: "Document content",
    });

    expect(
      documentChunkRepository.replaceChunks,
    ).toHaveBeenCalledWith(
      "document-1",
      [
        {
          documentId: "document-1",
          chunkIndex: 0,
          content: "First chunk",
        },
        {
          documentId: "document-1",
          chunkIndex: 1,
          content: "Second chunk",
        },
      ],
    );

    expect(
      documentChunkEmbeddingService.embedChunks,
    ).toHaveBeenCalledWith({
      chunks: [
        {
          index: 0,
          content: "First chunk",
        },
        {
          index: 1,
          content: "Second chunk",
        },
      ],
    });

    expect(
      documentChunkEmbeddingPersistenceService.persist,
    ).toHaveBeenCalled();

    expect(
      documentRepository.updateStatus,
    ).toHaveBeenCalledWith(
      "document-1",
      "user-1",
      DocumentStatus.READY,
    );
  });

  it("marks a document FAILED when processing fails", async () => {
    const documentRepository = {
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    const documentChunkRepository = {
      replaceChunks: vi.fn().mockRejectedValue(
        new Error("Chunk persistence failed."),
      ),
    };

    const documentProcessingService = {
      process: vi.fn().mockReturnValue({
        chunks: [
          {
            index: 0,
            content: "First chunk",
          },
        ],
      }),
    };

    const documentChunkEmbeddingService = {
      embedChunks: vi.fn(),
    };

    const documentChunkEmbeddingPersistenceService = {
      persist: vi.fn(),
    };

    const service =
      new DocumentProcessingPipelineService(
        documentRepository as unknown as DocumentRepository,
        documentChunkRepository as unknown as DocumentChunkRepository,
        documentProcessingService as unknown as DocumentProcessingService,
        documentChunkEmbeddingService as unknown as DocumentChunkEmbeddingService,
        documentChunkEmbeddingPersistenceService as unknown as DocumentChunkEmbeddingPersistenceService,
      );

    await expect(
      service.process({
        documentId: "document-1",
        userId: "user-1",
        content: "Document content",
      }),
    ).rejects.toThrow(
      "Chunk persistence failed.",
    );

    expect(
      documentRepository.updateStatus,
    ).toHaveBeenCalledWith(
      "document-1",
      "user-1",
      DocumentStatus.FAILED,
    );
  });
});
