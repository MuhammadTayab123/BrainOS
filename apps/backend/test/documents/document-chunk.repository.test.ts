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
});
