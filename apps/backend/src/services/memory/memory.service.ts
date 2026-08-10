import { MemoryRepository } from "./repositories/memory.repository";
import { CreateMemoryInput } from "./memory.types";

export class MemoryService {
  constructor(
    private readonly memoryRepository = new MemoryRepository()
  ) {}

  async createMemory(data: CreateMemoryInput) {
    return this.memoryRepository.create(data);
  }
}