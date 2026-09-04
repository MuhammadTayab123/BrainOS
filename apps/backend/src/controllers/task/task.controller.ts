import { Request, Response } from "express";
import { TaskPriority, TaskStatus } from "@prisma/client";

import { TaskService } from "../../services/tasks/task.service";
import { TaskRepository } from "../../services/tasks/repositories/task.repository";

const taskService = new TaskService(new TaskRepository());

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  });
}

function getId(req: Request): string | null {
  const rawId = req.params.id;

  if (typeof rawId !== "string") {
    return null;
  }

  const id = rawId.trim();

  return id.length > 0 ? id : null;
}

function parseDate(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

export async function createTask(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { title, description, priority, dueAt } = req.body;

  if (typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TITLE",
        message: "Task title is required.",
      },
    });
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DESCRIPTION",
        message: "Task description must be a string.",
      },
    });
  }

  if (
    priority !== undefined &&
    !Object.values(TaskPriority).includes(priority)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PRIORITY",
        message: "Invalid task priority.",
      },
    });
  }

  let parsedDueAt: Date | undefined;

  if (dueAt !== undefined && dueAt !== null) {
    try {
      parsedDueAt = parseDate(dueAt, "Task due date");
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DUE_DATE",
          message:
            error instanceof Error
              ? error.message
              : "Task due date must be a valid date.",
        },
      });
    }
  }

  const task = await taskService.createTask({
    userId: req.user.id,
    title: title.trim(),
    description:
      typeof description === "string" ? description.trim() : undefined,
    priority,
    dueAt: parsedDueAt,
  });

  return res.status(201).json({
    success: true,
    data: task,
  });
}

export async function listTasks(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { status, priority, dueBefore, dueAfter, limit } = req.query;

  let parsedLimit: number | undefined;

  if (limit !== undefined) {
    if (typeof limit !== "string" || !/^\d+$/.test(limit)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: "Limit must be an integer between 1 and 50.",
        },
      });
    }

    parsedLimit = Number.parseInt(limit, 10);

    if (parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: "Limit must be an integer between 1 and 50.",
        },
      });
    }
  }

  let parsedStatus: TaskStatus | undefined;

  if (status !== undefined) {
    if (
      typeof status !== "string" ||
      !Object.values(TaskStatus).includes(status as TaskStatus)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Invalid task status.",
        },
      });
    }

    parsedStatus = status as TaskStatus;
  }

  let parsedPriority: TaskPriority | undefined;

  if (priority !== undefined) {
    if (
      typeof priority !== "string" ||
      !Object.values(TaskPriority).includes(priority as TaskPriority)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PRIORITY",
          message: "Invalid task priority.",
        },
      });
    }

    parsedPriority = priority as TaskPriority;
  }

  let parsedDueBefore: Date | undefined;

  if (dueBefore !== undefined) {
    try {
      parsedDueBefore = parseDate(dueBefore, "Due before date");
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DUE_BEFORE",
          message:
            error instanceof Error
              ? error.message
              : "Due before date must be a valid date.",
        },
      });
    }
  }

  let parsedDueAfter: Date | undefined;

  if (dueAfter !== undefined) {
    try {
      parsedDueAfter = parseDate(dueAfter, "Due after date");
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DUE_AFTER",
          message:
            error instanceof Error
              ? error.message
              : "Due after date must be a valid date.",
        },
      });
    }
  }

  const tasks = await taskService.listTasks({
    userId: req.user.id,
    status: parsedStatus,
    priority: parsedPriority,
    dueBefore: parsedDueBefore,
    dueAfter: parsedDueAfter,
    limit: parsedLimit,
  });

  return res.status(200).json({
    success: true,
    data: tasks,
  });
}

export async function getTaskById(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const taskId = getId(req);

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TASK_ID",
        message: "Task ID is required.",
      },
    });
  }

  const task = await taskService.getTask(taskId, req.user.id);

  return res.status(200).json({
    success: true,
    data: task,
  });
}

export async function updateTask(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const taskId = getId(req);

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TASK_ID",
        message: "Task ID is required.",
      },
    });
  }

  if (
    req.body === null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Request body must be an object.",
      },
    });
  }

  const { title, description, priority, dueAt } = req.body;

  if (
    title !== undefined &&
    (typeof title !== "string" || title.trim().length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TITLE",
        message: "Task title must be a non-empty string.",
      },
    });
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DESCRIPTION",
        message: "Task description must be a string or null.",
      },
    });
  }

  if (
    priority !== undefined &&
    !Object.values(TaskPriority).includes(priority)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PRIORITY",
        message: "Invalid task priority.",
      },
    });
  }

  let parsedDueAt: Date | null | undefined;

  if (dueAt === null) {
    parsedDueAt = null;
  } else if (dueAt !== undefined) {
    try {
      parsedDueAt = parseDate(dueAt, "Task due date");
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DUE_DATE",
          message:
            error instanceof Error
              ? error.message
              : "Task due date must be a valid date.",
        },
      });
    }
  }

  await taskService.updateTask(taskId, req.user.id, {
    title: typeof title === "string" ? title.trim() : undefined,
    description:
      description === null
        ? null
        : typeof description === "string"
          ? description.trim()
          : undefined,
    priority,
    dueAt: parsedDueAt,
  });

  return res.status(200).json({
    success: true,
    data: {
      id: taskId,
    },
  });
}

export async function completeTask(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const taskId = getId(req);

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TASK_ID",
        message: "Task ID is required.",
      },
    });
  }

  await taskService.completeTask(taskId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: taskId,
      status: TaskStatus.COMPLETED,
    },
  });
}

export async function deleteTask(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const taskId = getId(req);

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TASK_ID",
        message: "Task ID is required.",
      },
    });
  }

  await taskService.deleteTask(taskId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: taskId,
    },
  });
}
