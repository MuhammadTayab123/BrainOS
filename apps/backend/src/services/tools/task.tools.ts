import {
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { TaskRepository } from "../tasks/repositories/task.repository";
import { TaskService } from "../tasks/task.service";
import {
  CreateTaskInput,
  ListTasksOptions,
} from "../tasks/task.types";

import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const taskService = new TaskService(
  new TaskRepository(),
);

function requireObject(
  input: unknown,
): Record<string, unknown> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new Error(
      "Tool input must be an object.",
    );
  }

  return input as Record<string, unknown>;
}

function requireString(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(
      `${field} is required.`,
    );
  }

  if (typeof value !== "string") {
    throw new Error(
      `${field} must be a string.`,
    );
  }

  if (value.trim().length === 0) {
    throw new Error(
      `${field} is required.`,
    );
  }

  return value;
}

function optionalString(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(
      `${field} must be a string.`,
    );
  }

  return value;
}

function optionalEnum<T extends string>(
  input: Record<string, unknown>,
  field: string,
  values: readonly T[],
): T | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !values.includes(value as T)
  ) {
    throw new Error(
      `${field} must be one of: ${values.join(", ")}.`,
    );
  }

  return value as T;
}

function optionalDate(
  input: Record<string, unknown>,
  field: string,
): Date | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(
      `${field} must be an ISO date string.`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${field} must be a valid ISO date string.`,
    );
  }

  return date;
}

function optionalPositiveInteger(
  input: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `${field} must be a positive integer.`,
    );
  }

  return value;
}

function requireTaskId(
  input: unknown,
): string {
  const object = requireObject(input);

  return requireString(object, "taskId");
}

export const createTaskTool: ToolDefinition = {
  name: "create_task",

  description:
    "Create a task for the authenticated BrainOS user.",

  parameters: {
    type: "object",

    properties: {
      title: {
        type: "string",
        description:
          "The task title.",
      },

      description: {
        type: "string",
        description:
          "Optional detailed description of the task.",
      },

      priority: {
        type: "string",
        enum: [
          TaskPriority.LOW,
          TaskPriority.MEDIUM,
          TaskPriority.HIGH,
        ],
        description:
          "Optional task priority.",
      },

      dueAt: {
        type: "string",
        description:
          "Optional task due date/time as an ISO 8601 string.",
      },
    },

    required: ["title"],
  },

  async execute(
    input: unknown,
    context: ToolContext,
  ) {
    const object = requireObject(input);

    const taskInput: CreateTaskInput = {
      userId: context.userId,
      title: requireString(object, "title"),
      description: optionalString(
        object,
        "description",
      ),
      priority: optionalEnum(
        object,
        "priority",
        [
          TaskPriority.LOW,
          TaskPriority.MEDIUM,
          TaskPriority.HIGH,
        ],
      ),
      dueAt: optionalDate(
        object,
        "dueAt",
      ),
    };

    return taskService.createTask(
      taskInput,
    );
  },
};

export const listTasksTool: ToolDefinition = {
  name: "list_tasks",

  description:
    "List active tasks belonging to the authenticated BrainOS user.",

  parameters: {
    type: "object",

    properties: {
      status: {
        type: "string",
        enum: [
          TaskStatus.TODO,
          TaskStatus.COMPLETED,
        ],
        description:
          "Optional task status filter.",
      },

      priority: {
        type: "string",
        enum: [
          TaskPriority.LOW,
          TaskPriority.MEDIUM,
          TaskPriority.HIGH,
        ],
        description:
          "Optional task priority filter.",
      },

      dueBefore: {
        type: "string",
        description:
          "Optional ISO 8601 date/time. Only tasks due before this value are returned.",
      },

      dueAfter: {
        type: "string",
        description:
          "Optional ISO 8601 date/time. Only tasks due after this value are returned.",
      },

      limit: {
        type: "number",
        description:
          "Optional maximum number of tasks to return. Maximum is 50.",
      },
    },
  },

  async execute(
    input: unknown,
    context: ToolContext,
  ) {
    const object = requireObject(input);

    const options: ListTasksOptions = {
      userId: context.userId,

      status: optionalEnum(
        object,
        "status",
        [
          TaskStatus.TODO,
          TaskStatus.COMPLETED,
        ],
      ),

      priority: optionalEnum(
        object,
        "priority",
        [
          TaskPriority.LOW,
          TaskPriority.MEDIUM,
          TaskPriority.HIGH,
        ],
      ),

      dueBefore: optionalDate(
        object,
        "dueBefore",
      ),

      dueAfter: optionalDate(
        object,
        "dueAfter",
      ),

      limit: optionalPositiveInteger(
        object,
        "limit",
      ),
    };

    return taskService.listTasks(
      options,
    );
  },
};

export const completeTaskTool: ToolDefinition = {
  name: "complete_task",

  description:
    "Mark an owned BrainOS task as completed.",

  parameters: {
    type: "object",

    properties: {
      taskId: {
        type: "string",
        description:
          "The ID of the task to complete.",
      },
    },

    required: ["taskId"],
  },

  async execute(
    input: unknown,
    context: ToolContext,
  ) {
    const taskId = requireTaskId(input);

    await taskService.completeTask(
      taskId,
      context.userId,
    );

    return {
      success: true,
      taskId,
      status: TaskStatus.COMPLETED,
    };
  },
};

export const deleteTaskTool: ToolDefinition = {
  name: "delete_task",

  description:
    "Soft-delete an owned BrainOS task.",

  parameters: {
    type: "object",

    properties: {
      taskId: {
        type: "string",
        description:
          "The ID of the task to delete.",
      },
    },

    required: ["taskId"],
  },

  async execute(
    input: unknown,
    context: ToolContext,
  ) {
    const taskId = requireTaskId(input);

    await taskService.deleteTask(
      taskId,
      context.userId,
    );

    return {
      success: true,
      taskId,
      deleted: true,
    };
  },
};