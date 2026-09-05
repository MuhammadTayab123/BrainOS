import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
} from "@prisma/client";

import { AutomationRepository } from "../automation/repositories/automation.repository";
import { AutomationService } from "../automation/automation.service";
import {
  AutomationConfig,
  CreateAutomationInput,
  ListAutomationsOptions,
  UpdateAutomationInput,
} from "../automation/automation.types";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const defaultAutomationService = new AutomationService(
  new AutomationRepository(),
);

export const ALL_AUTOMATION_TRIGGER_TYPES: readonly AutomationTriggerType[] = [
  AutomationTriggerType.SCHEDULE,
  AutomationTriggerType.TASK_DUE,
  AutomationTriggerType.REMINDER_DUE,
];

export const ALL_AUTOMATION_ACTION_TYPES: readonly AutomationActionType[] = [
  AutomationActionType.CREATE_TASK,
  AutomationActionType.CREATE_REMINDER,
];

export const ALL_AUTOMATION_STATUSES: readonly AutomationStatus[] = [
  AutomationStatus.ACTIVE,
  AutomationStatus.PAUSED,
  AutomationStatus.COMPLETED,
  AutomationStatus.FAILED,
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

function requireEnum<T extends string>(
  input: Record<string, unknown>,
  field: string,
  values: readonly T[],
): T {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(
      `${field} is required.`,
    );
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

function requireConfigObject(
  input: Record<string, unknown>,
  field: string,
): AutomationConfig {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(
      `${field} is required.`,
    );
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${field} must be an object.`,
    );
  }

  return value as AutomationConfig;
}

function optionalConfigObject(
  input: Record<string, unknown>,
  field: string,
): AutomationConfig | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      `${field} must be an object.`,
    );
  }

  return value as AutomationConfig;
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

function optionalPositiveIntegerInRange(
  input: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${field} must be an integer between ${min} and ${max}.`,
    );
  }

  return value;
}

function assertContextUser(context: ToolContext): string {
  if (
    !context ||
    typeof context !== "object" ||
    !context.userId ||
    context.userId.trim().length === 0
  ) {
    throw new Error("User ID is required.");
  }
  return context.userId.trim();
}

export function createCreateAutomationTool(
  service: AutomationService = defaultAutomationService,
): ToolDefinition {
  return {
    name: "create_automation",

    description:
      "Create a new automated workflow triggered on a schedule, when a task is due, or when a reminder is due.",

    parameters: {
      type: "object",

      properties: {
        name: {
          type: "string",
          description:
            "Descriptive name for the automation rule.",
        },

        triggerType: {
          type: "string",
          enum: ALL_AUTOMATION_TRIGGER_TYPES as unknown as string[],
          description:
            "The trigger type that starts this automation: 'SCHEDULE', 'TASK_DUE', or 'REMINDER_DUE'.",
        },

        actionType: {
          type: "string",
          enum: ALL_AUTOMATION_ACTION_TYPES as unknown as string[],
          description:
            "The action executed when triggered: 'CREATE_TASK' or 'CREATE_REMINDER'.",
        },

        config: {
          type: "object",
          description:
            "Configuration object containing action parameters (e.g. title/message) and optional recurrence rules for schedules.",
        },

        nextRunAt: {
          type: "string",
          description:
            "Optional ISO 8601 timestamp for the initial execution run (e.g. '2026-09-06T09:00:00Z').",
        },
      },

      required: ["name", "triggerType", "actionType", "config"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const automationInput: CreateAutomationInput = {
        userId,
        name: requireString(object, "name"),
        triggerType: requireEnum(
          object,
          "triggerType",
          ALL_AUTOMATION_TRIGGER_TYPES,
        ),
        actionType: requireEnum(
          object,
          "actionType",
          ALL_AUTOMATION_ACTION_TYPES,
        ),
        config: requireConfigObject(object, "config"),
        nextRunAt: optionalDate(object, "nextRunAt"),
      };

      const result = await service.createAutomation(automationInput);

      return {
        id: result.id,
        name: result.name,
        status: result.status,
        triggerType: result.triggerType,
        actionType: result.actionType,
        config: result.config,
        nextRunAt: result.nextRunAt,
        createdAt: result.createdAt,
      };
    },
  };
}

export function createListAutomationsTool(
  service: AutomationService = defaultAutomationService,
): ToolDefinition {
  return {
    name: "list_automations",

    description:
      "List all automations configured for the authenticated user, optionally filtered by status.",

    parameters: {
      type: "object",

      properties: {
        status: {
          type: "string",
          enum: ALL_AUTOMATION_STATUSES as unknown as string[],
          description:
            "Optional status filter: 'ACTIVE', 'PAUSED', 'COMPLETED', or 'FAILED'.",
        },

        limit: {
          type: "integer",
          description:
            "Optional maximum number of automations to return (1-50, default 50).",
        },
      },
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const listOptions: ListAutomationsOptions = {
        userId,
        status: optionalEnum(
          object,
          "status",
          ALL_AUTOMATION_STATUSES,
        ),
        limit: optionalPositiveIntegerInRange(
          object,
          "limit",
          1,
          50,
        ),
      };

      return service.listAutomations(listOptions);
    },
  };
}

export function createGetAutomationTool(
  service: AutomationService = defaultAutomationService,
): ToolDefinition {
  return {
    name: "get_automation",

    description:
      "Retrieve details of a specific automation by its unique automationId.",

    parameters: {
      type: "object",

      properties: {
        automationId: {
          type: "string",
          description:
            "The unique ID of the automation to retrieve.",
        },
      },

      required: ["automationId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const automationId = requireString(object, "automationId");

      return service.getAutomation(automationId, userId);
    },
  };
}

export function createUpdateAutomationTool(
  service: AutomationService = defaultAutomationService,
): ToolDefinition {
  return {
    name: "update_automation",

    description:
      "Update an existing automation (e.g. rename, change status to 'ACTIVE' or 'PAUSED', update config, or update next run time).",

    parameters: {
      type: "object",

      properties: {
        automationId: {
          type: "string",
          description:
            "The unique ID of the automation to update.",
        },

        name: {
          type: "string",
          description:
            "Optional updated name for the automation.",
        },

        status: {
          type: "string",
          enum: ALL_AUTOMATION_STATUSES as unknown as string[],
          description:
            "Optional updated status (e.g. 'ACTIVE' to resume, 'PAUSED' to pause).",
        },

        config: {
          type: "object",
          description:
            "Optional updated configuration object.",
        },

        nextRunAt: {
          type: "string",
          description:
            "Optional updated ISO 8601 next run timestamp.",
        },
      },

      required: ["automationId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const automationId = requireString(object, "automationId");

      const updateData: UpdateAutomationInput = {
        name: optionalString(object, "name"),
        status: optionalEnum(
          object,
          "status",
          ALL_AUTOMATION_STATUSES,
        ),
        config: optionalConfigObject(object, "config"),
        nextRunAt: optionalDate(object, "nextRunAt"),
      };

      await service.updateAutomation(automationId, userId, updateData);

      return {
        success: true,
        automationId,
        status: updateData.status,
        name: updateData.name,
      };
    },
  };
}

export function createDeleteAutomationTool(
  service: AutomationService = defaultAutomationService,
): ToolDefinition {
  return {
    name: "delete_automation",

    description:
      "Delete an automation rule by its unique automationId.",

    parameters: {
      type: "object",

      properties: {
        automationId: {
          type: "string",
          description:
            "The unique ID of the automation to delete.",
        },
      },

      required: ["automationId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const automationId = requireString(object, "automationId");

      await service.deleteAutomation(automationId, userId);

      return {
        success: true,
        automationId,
      };
    },
  };
}

export function createAutomationTools(
  service: AutomationService = defaultAutomationService,
): ToolDefinition[] {
  return [
    createCreateAutomationTool(service),
    createListAutomationsTool(service),
    createGetAutomationTool(service),
    createUpdateAutomationTool(service),
    createDeleteAutomationTool(service),
  ];
}

export const createAutomationTool = createCreateAutomationTool();
export const listAutomationsTool = createListAutomationsTool();
export const getAutomationTool = createGetAutomationTool();
export const updateAutomationTool = createUpdateAutomationTool();
export const deleteAutomationTool = createDeleteAutomationTool();
