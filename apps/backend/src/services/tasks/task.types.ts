import { TaskPriority, TaskStatus } from "@prisma/client";

export {
  TaskPriority,
  TaskStatus,
};

export interface CreateTaskInput {
  userId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: Date;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: Date | null;
}

export interface ListTasksOptions {
  userId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueBefore?: Date;
  dueAfter?: Date;
  limit?: number;
}