import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  CreateTaskInput,
  ListTasksOptions,
  UpdateTaskData,
} from "../task.types";

export class TaskRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(data: CreateTaskInput) {
    return this.db.task.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueAt: data.dueAt,
      },
    });
  }

  async listByUser(options: ListTasksOptions) {
    const {
      userId,
      status,
      priority,
      dueBefore,
      dueAfter,
      limit = 50,
    } = options;

    return this.db.task.findMany({
      where: {
        userId,
        deletedAt: null,
        status,
        priority,
        dueAt: {
          gte: dueAfter,
          lte: dueBefore,
        },
      },
      orderBy: [
        {
          dueAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: limit,
    });
  }

  async findByIdForUser(
    taskId: string,
    userId: string,
  ) {
    return this.db.task.findFirst({
      where: {
        id: taskId,
        userId,
        deletedAt: null,
      },
    });
  }

  async updateByIdForUser(
    taskId: string,
    userId: string,
    data: UpdateTaskData,
  ): Promise<void> {
    const result = await this.db.task.updateMany({
      where: {
        id: taskId,
        userId,
        deletedAt: null,
      },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Task not found for the authenticated user.",
      );
    }
  }

  async completeByIdForUser(
    taskId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.task.updateMany({
      where: {
        id: taskId,
        userId,
        deletedAt: null,
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Task not found for the authenticated user.",
      );
    }
  }

  async softDeleteByIdForUser(
    taskId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.task.updateMany({
      where: {
        id: taskId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Task not found for the authenticated user.",
      );
    }
  }
}