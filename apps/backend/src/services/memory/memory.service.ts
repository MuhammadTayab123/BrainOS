import { prisma } from "../../lib/prisma";

import {
  DEFAULT_MEMORY_LIST_LIMIT,
  MAX_MEMORY_LIST_LIMIT,
  DEFAULT_MEMORY_SEARCH_LIMIT,
  MAX_MEMORY_SEARCH_LIMIT,
  MEMORY_EMBEDDING_DIMENSIONS,
} from "./constants/memory.constants";

import { EmbeddingsService } from "./embeddings.service";
import { MemoryRepository } from "./repositories/memory.repository";
import { NotFoundError } from "../../errors";
import {
  CreateMemoryInput,
  DeleteMemoryInput,
  GetMemoryByIdInput,
  ListMemoriesInput,
  MemoryListResult,
  MemorySearchResult,
  SearchMemoryInput,
  UpdateMemoryInput,
  UpdateMemoryData,
} from "./memory.types";

export class MemoryService {
  private readonly memoryRepository: MemoryRepository;

  constructor(
    private readonly embeddingsService: EmbeddingsService,
  ) {
    this.memoryRepository = new MemoryRepository();
  }

  async createMemory(data: CreateMemoryInput) {
    // Generate the embedding before opening the database transaction.
    const embeddingResult =
      await this.embeddingsService.generate(data.content);

    if (
      embeddingResult.dimensions !==
      MEMORY_EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Invalid embedding dimensions. Expected ${MEMORY_EMBEDDING_DIMENSIONS}, received ${embeddingResult.dimensions}.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const memoryRepository = new MemoryRepository(tx);

      const memory = await memoryRepository.create(data);

      await memoryRepository.updateEmbedding(
        memory.id,
        data.userId,
        embeddingResult.vector,
      );

      return memory;
    });
  }

  async searchMemories(
    data: SearchMemoryInput,
  ): Promise<MemorySearchResult[]> {
    const query = data.query.trim();

    if (query.length === 0) {
      throw new Error("Search query cannot be empty.");
    }

    const limit =
      data.limit ?? DEFAULT_MEMORY_SEARCH_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_MEMORY_SEARCH_LIMIT
    ) {
      throw new Error(
        `Search limit must be an integer between 1 and ${MAX_MEMORY_SEARCH_LIMIT}.`,
      );
    }

    const embeddingResult =
      await this.embeddingsService.generate(query);

    if (
      embeddingResult.dimensions !==
      MEMORY_EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Invalid embedding dimensions. Expected ${MEMORY_EMBEDDING_DIMENSIONS}, received ${embeddingResult.dimensions}.`,
      );
    }

    return this.memoryRepository.search(
      data.userId,
      embeddingResult.vector,
      limit,
    );
  }

  async listMemories(
    data: ListMemoriesInput,
  ): Promise<MemoryListResult[]> {
    const limit =
      data.limit ?? DEFAULT_MEMORY_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_MEMORY_LIST_LIMIT
    ) {
      throw new Error(
        `List limit must be an integer between 1 and ${MAX_MEMORY_LIST_LIMIT}.`,
      );
    }

    return this.memoryRepository.listByUser(
      data.userId,
      limit,
    );
  }

  async getMemoryById(
    data: GetMemoryByIdInput,
  ): Promise<MemoryListResult> {
    const memory =
      await this.memoryRepository.findByIdForUser(
        data.memoryId,
        data.userId,
      );

    if (!memory) {
      throw new NotFoundError(
        "Memory not found for the authenticated user.",
      );
    }

    return memory;
  }

  async deleteMemory(
    data: DeleteMemoryInput,
  ): Promise<void> {
    await this.memoryRepository.softDeleteByIdForUser(
      data.memoryId,
      data.userId,
    );
  }

  async updateMemory(
    data: UpdateMemoryInput,
  ): Promise<MemoryListResult> {
    const currentMemory =
      await this.memoryRepository.findByIdForUser(
        data.memoryId,
        data.userId,
      );

    if (!currentMemory) {
      throw new NotFoundError(
        "Memory not found for the authenticated user.",
      );
    }

    const updateData: UpdateMemoryData = {};

    if (data.importance !== undefined) {
      updateData.importance = data.importance;
    }

    const contentChanged =
      data.content !== undefined &&
      data.content !== currentMemory.content;

    if (contentChanged && data.content !== undefined) {
      updateData.content = data.content;

      const embeddingResult =
        await this.embeddingsService.generate(
          data.content,
        );

      if (
        embeddingResult.dimensions !==
        MEMORY_EMBEDDING_DIMENSIONS
      ) {
        throw new Error(
          `Invalid embedding dimensions. Expected ${MEMORY_EMBEDDING_DIMENSIONS}, received ${embeddingResult.dimensions}.`,
        );
      }

      return prisma.$transaction(async (tx) => {
        const memoryRepository =
          new MemoryRepository(tx);

        await memoryRepository.updateByIdForUser(
          data.memoryId,
          data.userId,
          updateData,
        );

        await memoryRepository.updateEmbedding(
          data.memoryId,
          data.userId,
          embeddingResult.vector,
        );

        const updatedMemory =
          await memoryRepository.findByIdForUser(
            data.memoryId,
            data.userId,
          );

        if (!updatedMemory) {
          throw new NotFoundError(
            "Memory not found for the authenticated user.",
          );
        }

        return updatedMemory;
      });
    }

    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    const hasChanges =
      updateData.content !== undefined ||
      updateData.importance !== undefined;

    if (!hasChanges) {
      return currentMemory;
    }

    await this.memoryRepository.updateByIdForUser(
      data.memoryId,
      data.userId,
      updateData,
    );

    const updatedMemory =
      await this.memoryRepository.findByIdForUser(
        data.memoryId,
        data.userId,
      );

    if (!updatedMemory) {
      throw new NotFoundError(
        "Memory not found for the authenticated user.",
      );
    }

    return updatedMemory;
  }
}