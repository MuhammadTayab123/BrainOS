import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  findByIdForUser: vi.fn(),
  updateByIdForUser: vi.fn(),
  updateEmbedding: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock(
  "../src/services/memory/repositories/memory.repository",
  () => ({
    MemoryRepository: class {
      constructor() {
        return repository;
      }
    },
  }),
);

import { NotFoundError } from "../src/errors";
import { EmbeddingsService } from "../src/services/memory/embeddings.service";
import { MemoryService } from "../src/services/memory/memory.service";
import { prisma } from "../src/lib/prisma";
import { MemoryListResult } from "../src/services/memory/memory.types";

const userId = "user-1";
const memoryId = "memory-1";
const validEmbedding = Array.from({ length: 768 }, (_, index) =>
  index === 0 ? 1 : 0,
);

const currentMemory: MemoryListResult = {
  id: memoryId,
  content: "original memory",
  importance: 0.5,
  lastAccessedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("MemoryService.updateMemory", () => {
  const generate = vi.fn();
  const transaction = vi.mocked(prisma.$transaction);

  function createService(): MemoryService {
    return new MemoryService({ generate } as EmbeddingsService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callback) =>
      callback({} as never),
    );
  });

  it("updates content and its embedding together inside the repository transaction", async () => {
    const updatedMemory: MemoryListResult = {
      ...currentMemory,
      content: "updated memory",
      importance: 0.8,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    repository.findByIdForUser
      .mockResolvedValueOnce(currentMemory)
      .mockResolvedValueOnce(updatedMemory);
    generate.mockResolvedValue({
      vector: validEmbedding,
      dimensions: 768,
      provider: "test",
      model: "test-model",
    });

    const result = await createService().updateMemory({
      userId,
      memoryId,
      content: "updated memory",
      importance: 0.8,
    });

    expect(result).toBe(updatedMemory);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith("updated memory");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(repository.updateByIdForUser).toHaveBeenCalledWith(
      memoryId,
      userId,
      { content: "updated memory", importance: 0.8 },
    );
    expect(repository.updateEmbedding).toHaveBeenCalledWith(
      memoryId,
      userId,
      validEmbedding,
    );
    expect(repository.updateByIdForUser.mock.invocationCallOrder[0])
      .toBeLessThan(
        repository.updateEmbedding.mock.invocationCallOrder[0],
      );
  });

  it("updates importance without generating an embedding", async () => {
    const updatedMemory: MemoryListResult = {
      ...currentMemory,
      importance: 0.9,
    };
    repository.findByIdForUser
      .mockResolvedValueOnce(currentMemory)
      .mockResolvedValueOnce(updatedMemory);

    const result = await createService().updateMemory({
      userId,
      memoryId,
      importance: 0.9,
    });

    expect(result).toBe(updatedMemory);
    expect(generate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(repository.updateByIdForUser).toHaveBeenCalledWith(
      memoryId,
      userId,
      { importance: 0.9 },
    );
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
  });

  it("does not re-embed content that is unchanged", async () => {
    repository.findByIdForUser
      .mockResolvedValueOnce(currentMemory)
      .mockResolvedValueOnce(currentMemory);

    const result = await createService().updateMemory({
      userId,
      memoryId,
      content: currentMemory.content,
    });

    expect(result).toBe(currentMemory);
    expect(generate).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(repository.updateByIdForUser).toHaveBeenCalledWith(
      memoryId,
      userId,
      { content: currentMemory.content },
    );
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
  });

  it("propagates embedding failures before mutating the repository", async () => {
    const embeddingFailure = new Error("embedding unavailable");
    repository.findByIdForUser.mockResolvedValueOnce(currentMemory);
    generate.mockRejectedValueOnce(embeddingFailure);

    await expect(
      createService().updateMemory({
        userId,
        memoryId,
        content: "updated memory",
      }),
    ).rejects.toBe(embeddingFailure);

    expect(repository.updateByIdForUser).not.toHaveBeenCalled();
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid embedding dimension before mutating the repository", async () => {
    repository.findByIdForUser.mockResolvedValueOnce(currentMemory);
    generate.mockResolvedValueOnce({
      vector: validEmbedding.slice(0, 767),
      dimensions: 767,
      provider: "test",
      model: "test-model",
    });

    await expect(
      createService().updateMemory({
        userId,
        memoryId,
        content: "updated memory",
      }),
    ).rejects.toThrow(
      "Invalid embedding dimensions. Expected 768, received 767.",
    );

    expect(repository.updateByIdForUser).not.toHaveBeenCalled();
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing owner-scoped memory without generating an embedding", async () => {
    repository.findByIdForUser.mockResolvedValueOnce(null);

    await expect(
      createService().updateMemory({
        userId,
        memoryId,
        content: "updated memory",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(generate).not.toHaveBeenCalled();
    expect(repository.updateByIdForUser).not.toHaveBeenCalled();
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
  });

  it("propagates a repository not-found error without generating an embedding", async () => {
    const notFoundError = new NotFoundError(
      "Memory not found for the authenticated user.",
    );
    repository.findByIdForUser.mockRejectedValueOnce(notFoundError);

    await expect(
      createService().updateMemory({
        userId,
        memoryId,
        content: "updated memory",
      }),
    ).rejects.toBe(notFoundError);

    expect(generate).not.toHaveBeenCalled();
    expect(repository.updateByIdForUser).not.toHaveBeenCalled();
    expect(repository.updateEmbedding).not.toHaveBeenCalled();
  });
});
