import { NotFoundError } from "../../errors";

import { TaskRepository } from "./repositories/task.repository";
import {
  CreateTaskInput,
  ListTasksOptions,
  UpdateTaskData,
} from "./task.types";

const MAX_TASK_LIST_LIMIT = 50;

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
  ) {}

  async createTask(input: CreateTaskInput) {
    this.validateUserId(input.userId);
    this.validateTitle(input.title);

    return this.taskRepository.create({
      userId: input.userId,
      title: input.title.trim(),
      description: input.description?.trim(),
      priority: input.priority,
      dueAt: input.dueAt,
    });
  }

  async listTasks(options: ListTasksOptions) {
    this.validateUserId(options.userId);

    const limit = options.limit ?? MAX_TASK_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_TASK_LIST_LIMIT
    ) {
      throw new Error(
        `Task list limit must be an integer between 1 and ${MAX_TASK_LIST_LIMIT}.`,
      );
    }

    return this.taskRepository.listByUser({
      ...options,
      limit,
    });
  }

  async getTask(
    taskId: string,
    userId: string,
  ) {
    this.validateUserId(userId);
    this.validateId(taskId, "Task ID");

    const task =
      await this.taskRepository.findByIdForUser(
        taskId,
        userId,
      );

    if (!task) {
      throw new NotFoundError(
        "Task not found for the authenticated user.",
      );
    }

    return task;
  }

  async updateTask(
    taskId: string,
    userId: string,
    data: UpdateTaskData,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(taskId, "Task ID");

    if (
      data.title !== undefined
    ) {
      this.validateTitle(data.title);
    }

    if (data.description !== undefined) {
      data = {
        ...data,
        description:
          data.description === null
            ? null
            : data.description.trim(),
      };
    }

    await this.taskRepository.updateByIdForUser(
      taskId,
      userId,
      {
        ...data,
        title:
          data.title !== undefined
            ? data.title.trim()
            : undefined,
      },
    );
  }

  async completeTask(
    taskId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(taskId, "Task ID");

    await this.taskRepository.completeByIdForUser(
      taskId,
      userId,
    );
  }

  async deleteTask(
    taskId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(taskId, "Task ID");

    await this.taskRepository.softDeleteByIdForUser(
      taskId,
      userId,
    );
  }

  private validateUserId(userId: string): void {
    if (
      !userId ||
      userId.trim().length === 0
    ) {
      throw new Error("User ID is required.");
    }
  }

  private validateId(
    value: string,
    fieldName: string,
  ): void {
    if (
      !value ||
      value.trim().length === 0
    ) {
      throw new Error(`${fieldName} is required.`);
    }
  }

  private validateTitle(title: string): void {
    if (
      !title ||
      title.trim().length === 0
    ) {
      throw new Error("Task title is required.");
    }
  }
}