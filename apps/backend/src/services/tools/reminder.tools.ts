import { ReminderStatus } from "@prisma/client";

import { ReminderRepository } from "../reminders/repositories/reminder.repository";
import { ReminderService } from "../reminders/reminder.service";
import {
  CreateReminderInput,
  ListRemindersOptions,
} from "../reminders/reminder.types";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const defaultReminderService = new ReminderService(
  new ReminderRepository(),
);

export const ALL_REMINDER_STATUSES: readonly ReminderStatus[] = [
  ReminderStatus.PENDING,
  ReminderStatus.PROCESSING,
  ReminderStatus.DELIVERED,
  ReminderStatus.FAILED,
  ReminderStatus.CANCELLED,
];

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

  return value.trim();
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

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
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

function requireDate(
  input: Record<string, unknown>,
  field: string,
): Date {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(
      `${field} is required.`,
    );
  }

  if (typeof value !== "string" && !(value instanceof Date)) {
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

function optionalDate(
  input: Record<string, unknown>,
  field: string,
): Date | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" && !(value instanceof Date)) {
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

function assertContextUser(context: ToolContext): string {
  if (!context || typeof context !== "object" || !context.userId || context.userId.trim().length === 0) {
    throw new Error("User ID is required.");
  }
  return context.userId.trim();
}

export function createCreateReminderTool(
  service: ReminderService = defaultReminderService,
): ToolDefinition {
  return {
    name: "create_reminder",

    description:
      "Create a scheduled reminder for the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        message: {
          type: "string",
          description:
            "The reminder message or text content.",
        },

        scheduledFor: {
          type: "string",
          description:
            "The date and time when the reminder should trigger as an ISO 8601 string (e.g. '2026-09-06T09:00:00Z').",
        },

        taskId: {
          type: "string",
          description:
            "Optional associated task ID to link this reminder to.",
        },
      },

      required: ["message", "scheduledFor"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const reminderInput: CreateReminderInput = {
        userId,
        message: requireString(object, "message"),
        scheduledFor: requireDate(object, "scheduledFor"),
        taskId: optionalString(object, "taskId"),
      };

      return service.createReminder(reminderInput);
    },
  };
}

export function createListRemindersTool(
  service: ReminderService = defaultReminderService,
): ToolDefinition {
  return {
    name: "list_reminders",

    description:
      "List scheduled reminders belonging to the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        status: {
          type: "string",
          enum: [
            ReminderStatus.PENDING,
            ReminderStatus.PROCESSING,
            ReminderStatus.DELIVERED,
            ReminderStatus.FAILED,
            ReminderStatus.CANCELLED,
          ],
          description:
            "Optional status filter (e.g. 'PENDING').",
        },

        dueBefore: {
          type: "string",
          description:
            "Optional ISO 8601 date to filter reminders scheduled before this time.",
        },

        limit: {
          type: "integer",
          description:
            "Optional maximum number of reminders to return (1-50, default 50).",
        },
      },
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object =
        input !== undefined && input !== null
          ? requireObject(input)
          : {};

      const options: ListRemindersOptions = {
        userId,
        status: optionalEnum(
          object,
          "status",
          ALL_REMINDER_STATUSES,
        ),
        dueBefore: optionalDate(object, "dueBefore"),
        limit: optionalPositiveInteger(object, "limit"),
      };

      return service.listReminders(options);
    },
  };
}

export function createGetReminderTool(
  service: ReminderService = defaultReminderService,
): ToolDefinition {
  return {
    name: "get_reminder",

    description:
      "Get details of a specific reminder owned by the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        reminderId: {
          type: "string",
          description:
            "The ID of the reminder to retrieve.",
        },
      },

      required: ["reminderId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);
      const reminderId = requireString(object, "reminderId");

      return service.getReminder(reminderId, userId);
    },
  };
}

export function createCancelReminderTool(
  service: ReminderService = defaultReminderService,
): ToolDefinition {
  return {
    name: "cancel_reminder",

    description:
      "Cancel a pending scheduled reminder owned by the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        reminderId: {
          type: "string",
          description:
            "The ID of the reminder to cancel.",
        },
      },

      required: ["reminderId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);
      const reminderId = requireString(object, "reminderId");

      await service.cancelReminder(reminderId, userId);

      return {
        success: true,
        reminderId,
        status: ReminderStatus.CANCELLED,
      };
    },
  };
}

export function createReminderTools(
  service: ReminderService = defaultReminderService,
): ToolDefinition[] {
  return [
    createCreateReminderTool(service),
    createListRemindersTool(service),
    createGetReminderTool(service),
    createCancelReminderTool(service),
  ];
}

export const createReminderTool: ToolDefinition =
  createCreateReminderTool();

export const listRemindersTool: ToolDefinition =
  createListRemindersTool();

export const getReminderTool: ToolDefinition =
  createGetReminderTool();

export const cancelReminderTool: ToolDefinition =
  createCancelReminderTool();
