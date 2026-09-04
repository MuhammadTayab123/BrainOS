import { Request, Response } from "express";
import { ReminderStatus } from "@prisma/client";

import { ReminderService } from "../../services/reminders/reminder.service";
import { ReminderRepository } from "../../services/reminders/repositories/reminder.repository";

const reminderService = new ReminderService(new ReminderRepository());

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

export async function createReminder(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { message, scheduledFor, taskId } = req.body ?? {};

  if (typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MESSAGE",
        message: "Reminder message is required.",
      },
    });
  }

  if (scheduledFor === undefined || scheduledFor === null) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SCHEDULED_FOR",
        message: "Reminder scheduled time is required.",
      },
    });
  }

  let parsedScheduledFor: Date;

  try {
    const parsed = parseDate(scheduledFor, "Reminder scheduled time");
    if (!parsed) {
      throw new Error("Reminder scheduled time is required.");
    }
    parsedScheduledFor = parsed;
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SCHEDULED_FOR",
        message:
          error instanceof Error
            ? error.message
            : "Reminder scheduled time must be a valid date.",
      },
    });
  }

  if (
    taskId !== undefined &&
    taskId !== null &&
    (typeof taskId !== "string" || taskId.trim().length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TASK_ID",
        message: "Task ID must be a non-empty string.",
      },
    });
  }

  const reminder = await reminderService.createReminder({
    userId: req.user.id,
    message: message.trim(),
    scheduledFor: parsedScheduledFor,
    taskId: typeof taskId === "string" ? taskId.trim() : undefined,
  });

  return res.status(201).json({
    success: true,
    data: reminder,
  });
}

export async function listReminders(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { status, dueBefore, limit } = req.query;

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

  let parsedStatus: ReminderStatus | undefined;

  if (status !== undefined) {
    if (
      typeof status !== "string" ||
      !Object.values(ReminderStatus).includes(status as ReminderStatus)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Invalid reminder status.",
        },
      });
    }

    parsedStatus = status as ReminderStatus;
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

  const reminders = await reminderService.listReminders({
    userId: req.user.id,
    status: parsedStatus,
    dueBefore: parsedDueBefore,
    limit: parsedLimit,
  });

  return res.status(200).json({
    success: true,
    data: reminders,
  });
}

export async function getReminderById(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const reminderId = getId(req);

  if (!reminderId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REMINDER_ID",
        message: "Reminder ID is required.",
      },
    });
  }

  const reminder = await reminderService.getReminder(reminderId, req.user.id);

  return res.status(200).json({
    success: true,
    data: reminder,
  });
}

export async function cancelReminder(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const reminderId = getId(req);

  if (!reminderId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REMINDER_ID",
        message: "Reminder ID is required.",
      },
    });
  }

  await reminderService.cancelReminder(reminderId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: reminderId,
      status: ReminderStatus.CANCELLED,
    },
  });
}

export async function deleteReminder(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const reminderId = getId(req);

  if (!reminderId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_REMINDER_ID",
        message: "Reminder ID is required.",
      },
    });
  }

  await reminderService.deleteReminder(reminderId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: reminderId,
    },
  });
}
