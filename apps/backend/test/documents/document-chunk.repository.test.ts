import { describe, expect, it, vi } from "vitest";

import { DocumentChunkRepository } from "../../src/services/documents/repositories/chunks/document-chunk.repository";

describe("DocumentChunkRepository", () => {
  function createDbMock() {
    return {
      documentChunk: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
    };
  }

  it("replaces existing chunks", async () => {
    const db = createDbMock();

    db.documentChunk.deleteMany.mockResolvedValue({
      count: 2,
    });

    db.documentChunk.createMany.mockResolvedValue({
      count: 3,
    });

    const repository = new DocumentChunkRepository(
      db as any,
    );

    await repository.replaceChunks(
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
        {
          documentId: "document-1",
          chunkIndex: 2,
          content: "Third chunk",
        },
      ],
    );

    expect(
      db.documentChunk.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        documentId: "document-1",
      },
    });

    expect(
      db.documentChunk.createMany,
    ).toHaveBeenCalledWith({
      data: [
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
        {
          documentId: "document-1",
          chunkIndex: 2,
          content: "Third chunk",
        },
      ],
    });
  });

  it("does not create rows when chunks are empty", async () => {
    const db = createDbMock();

    db.documentChunk.deleteMany.mockResolvedValue({
      count: 2,
    });

    const repository = new DocumentChunkRepository(
      db as any,
    );

    await repository.replaceChunks(
      "document-1",
      [],
    );

    expect(
      db.documentChunk.deleteMany,
    ).toHaveBeenCalledWith({
      where: {
        documentId: "document-1",
      },
    });

    expect(
      db.documentChunk.createMany,
    ).not.toHaveBeenCalled();
  });

  it("lists chunks in chunk index order", async () => {
    const db = createDbMock();

    const chunks = [
      {
        id: "chunk-1",
        documentId: "document-1",
        chunkIndex: 0,
        content: "First",
      },
      {
        id: "chunk-2",
        documentId: "document-1",
        chunkIndex: 1,
        content: "Second",
      },
    ];

    db.documentChunk.findMany.mockResolvedValue(
      chunks,
    );

    const repository = new DocumentChunkRepository(
      db as any,
    );

    const result =
      await repository.listByDocument(
        "document-1",
      );

    expect(
      db.documentChunk.findMany,
    ).toHaveBeenCalledWith({
      where: {
        documentId: "document-1",
      },
      orderBy: {
        chunkIndex: "asc",
      },
    });

    expect(result).toEqual(chunks);
  });

  it("updates a chunk embedding with a valid 768-dimension vector", async () => {
    const db = createDbMock();

    db.$executeRaw.mockResolvedValue(1);

    const repository = new DocumentChunkRepository(
      db as any,
    );

    const embedding = Array.from(
      { length: 768 },
      (_, index) =>
        index === 0 ? 1 : 0,
    );

    await repository.updateEmbedding(
      "document-1",
      0,
      embedding,
    );

    expect(
      db.$executeRaw,
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid embedding dimensions", async () => {
    const db = createDbMock();

    const repository = new DocumentChunkRepository(
      db as any,
    );

    await expect(
      repository.updateEmbedding(
        "document-1",
        0,
        [1, 0, 0],
      ),
    ).rejects.toThrow(
      "Invalid embedding dimensions. Expected 768, received 3.",
    );

    expect(
      db.$executeRaw,
    ).not.toHaveBeenCalled();
  });

  it("rejects invalid embedding values", async () => {
    const db = createDbMock();

    const repository = new DocumentChunkRepository(
      db as any,
    );

    const embedding = Array.from(
      { length: 768 },
      () => 0,
    );

    embedding[10] = Number.NaN;

    await expect(
      repository.updateEmbedding(
        "document-1",
        0,
        embedding,
      ),
    ).rejects.toThrow(
      "Embedding contains invalid numeric values.",
    );

    expect(
      db.$executeRaw,
    ).not.toHaveBeenCalled();
  });

  it("searches similar document chunks for the authenticated user", async () => {
    const db = createDbMock();

    db.$queryRaw.mockResolvedValue([
      {
        id: "chunk-1",
        documentId: "document-1",
        chunkIndex: 0,
        content: "First chunk",
        similarity: 0.91,
      },
    ]);

    const repository = new DocumentChunkRepository(
      db as any,
    );

    const embedding = Array.from(
      { length: 768 },
      (_, index) =>
        index === 0 ? 1 : 0,
    );

    const result =
      await repository.searchSimilar(
        "user-1",
        embedding,
        5,
      );

    expect(
      db.$queryRaw,
    ).toHaveBeenCalledTimes(1);

    expect(result).toEqual([
      {
        id: "chunk-1",
        documentId: "document-1",
        chunkIndex: 0,
        content: "First chunk",
        similarity: 0.91,
      },
    ]);
  });
  it("uses the minimum similarity threshold for document retrieval", async () => {
  const db = createDbMock();

  db.$queryRaw.mockResolvedValue([]);

  const repository = new DocumentChunkRepository(
    db as any,
  );

  const embedding = Array.from(
    { length: 768 },
    (_, index) =>
      index === 0 ? 1 : 0,
  );

  await repository.searchSimilar(
    "user-1",
    embedding,
    5,
  );

  expect(db.$queryRaw).toHaveBeenCalledTimes(1);
});
  it("rejects invalid search embedding dimensions", async () => {
    const db = createDbMock();

    const repository = new DocumentChunkRepository(
      db as any,
    );

    await expect(
      repository.searchSimilar(
        "user-1",
        [1, 0, 0],
        5,
      ),
    ).rejects.toThrow(
      "Invalid embedding dimensions. Expected 768, received 3.",
    );

    expect(
      db.$queryRaw,
    ).not.toHaveBeenCalled();
  });

  it("rejects an invalid search limit", async () => {
    const db = createDbMock();

    const repository = new DocumentChunkRepository(
      db as any,
    );

    const embedding = Array.from(
      { length: 768 },
      () => 0,
    );

    await expect(
      repository.searchSimilar(
        "user-1",
        embedding,
        21,
      ),
    ).rejects.toThrow(
      "Search limit must be an integer between 1 and 20.",
    );

    expect(
      db.$queryRaw,
    ).not.toHaveBeenCalled();
  });
});