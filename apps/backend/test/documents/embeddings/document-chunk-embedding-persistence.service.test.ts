import { describe, expect, it, vi } from "vitest";

import { DocumentChunkRepository } from "../../../src/services/documents/repositories/chunks/document-chunk.repository";
import { DocumentChunkEmbeddingPersistenceService } from "../../../src/services/documents/embeddings/document-chunk-embedding-persistence.service";

describe("DocumentChunkEmbeddingPersistenceService", () => {
  it("persists each chunk embedding", async () => {
    const repository = {
      updateEmbedding: vi.fn().mockResolvedValue(undefined),
    };

    const service =
      new DocumentChunkEmbeddingPersistenceService(
        repository as unknown as DocumentChunkRepository,
      );

    await service.persist({
      documentId: "document-1",
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
    });

    expect(
      repository.updateEmbedding,
    ).toHaveBeenNthCalledWith(
      1,
      "document-1",
      0,
      [1, 0, 0],
    );

    expect(
      repository.updateEmbedding,
    ).toHaveBeenNthCalledWith(
      2,
      "document-1",
      1,
      [0, 1, 0],
    );
  });
});
