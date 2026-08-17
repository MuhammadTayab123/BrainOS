import { prisma } from "../../lib/prisma";

import {
  DEFAULT_MEMORY_SEARCH_LIMIT,
  MAX_MEMORY_SEARCH_LIMIT,
  MEMORY_EMBEDDING_DIMENSIONS,
} from "./constants/memory.constants";

import { EmbeddingsService } from "./embeddings.service";
import { MemoryRepository } from "./repositories/memory.repository";
import {
  CreateMemoryInput,
  MemorySearchResult,
  SearchMemoryInput,
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
  data.userId,
  memory.id,
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
}