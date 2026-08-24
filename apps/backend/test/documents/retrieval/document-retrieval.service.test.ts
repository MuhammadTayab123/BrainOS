import { describe, expect, it, vi } from "vitest";

import { EmbeddingsService } from "../../../src/services/memory/embeddings.service";
import { DocumentChunkRepository } from "../../../src/services/documents/repositories/chunks/document-chunk.repository";
import { DocumentRetrievalService } from "../../../src/services/documents/retrieval/document-retrieval.service";

describe("DocumentRetrievalService", () => {
  it("embeds the query and searches document chunks", async () => {
    const embeddingsService = {
      generate: vi.fn().mockResolvedValue({
        vector: Array.from(
          { length: 768 },
          (_, index) =>
            index === 0 ? 1 : 0,
        ),
        dimensions: 768,
        provider: "test",
        model: "test-model",
      }),
    };

    const repository = {
      searchSimilar: vi.fn().mockResolvedValue([
        {
          id: "chunk-1",
          documentId: "document-1",
          chunkIndex: 0,
          content: "BrainOS document content",
          similarity: 0.91,
        },
      ]),
    };

    const service =
      new DocumentRetrievalService(
        embeddingsService as unknown as EmbeddingsService,
        repository as unknown as DocumentChunkRepository,
      );

    const result = await service.search({
      userId: "user-1",
      query: "  BrainOS  ",
      limit: 5,
    });

    expect(
      embeddingsService.generate,
    ).toHaveBeenCalledWith("BrainOS");

    expect(
      repository.searchSimilar,
    ).toHaveBeenCalledWith(
      "user-1",
      expect.any(Array),
      5,
    );

    expect(result).toEqual([
      {
        id: "chunk-1",
        documentId: "document-1",
        chunkIndex: 0,
        content: "BrainOS document content",
        similarity: 0.91,
      },
    ]);
  });

  it("rejects an empty query", async () => {
    const embeddingsService = {
      generate: vi.fn(),
    };

    const repository = {
      searchSimilar: vi.fn(),
    };

    const service =
      new DocumentRetrievalService(
        embeddingsService as unknown as EmbeddingsService,
        repository as unknown as DocumentChunkRepository,
      );

    await expect(
      service.search({
        userId: "user-1",
        query: "   ",
      }),
    ).rejects.toThrow(
      "Search query is required.",
    );
  });

  it("rejects an invalid search limit", async () => {
    const embeddingsService = {
      generate: vi.fn(),
    };

    const repository = {
      searchSimilar: vi.fn(),
    };

    const service =
      new DocumentRetrievalService(
        embeddingsService as unknown as EmbeddingsService,
        repository as unknown as DocumentChunkRepository,
      );

    await expect(
      service.search({
        userId: "user-1",
        query: "BrainOS",
        limit: 21,
      }),
    ).rejects.toThrow(
      "Search limit must be an integer between 1 and 20.",
    );
  });
});
