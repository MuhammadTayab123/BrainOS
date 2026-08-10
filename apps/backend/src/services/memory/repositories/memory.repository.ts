import { prisma } from "../../../lib/prisma";
import { CreateMemoryInput } from "../memory.types";

export class MemoryRepository {
  constructor(private readonly db = prisma) {}

  async create(data: CreateMemoryInput) {
    return this.db.memory.create({
      data: {
        userId: data.userId,
        content: data.content,
        importance: data.importance ?? 0.5,
      },
    });
  }
}