import { describe, expect, it, vi } from "vitest";

import { EmbeddingsService } from "../../../src/services/memory/embeddings.service";
import { DocumentChunkEmbeddingService } from "../../../src/services/documents/embeddings/document-chunk-embedding.service";

describe("DocumentChunkEmbeddingService", () => {
  it("generates embeddings for each chunk", async () => {
    const embeddingsService = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          vector: [1, 0, 0],
          dimensions: 3,
          provider: "test",
          model: "test-model",
        })
        .mockResolvedValueOnce({
          vector: [0, 1, 0],
          dimensions: 3,
          provider: "test",
          model: "test-model",
        }),
    };

    const service =
      new DocumentChunkEmbeddingService(
        embeddingsService as unknown as EmbeddingsService,
      );

    const result =
      await service.embedChunks({
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
      embeddingsService.generate,
    ).toHaveBeenNthCalledWith(
      1,
      "First chunk",
    );

    expect(
      embeddingsService.generate,
    ).toHaveBeenNthCalledWith(
      2,
      "Second chunk",
    );

    expect(result).toEqual({
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
  });
});
