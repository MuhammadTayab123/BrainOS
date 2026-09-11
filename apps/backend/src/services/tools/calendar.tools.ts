import {
  CalendarEventStatus,
  Prisma,
} from "@prisma/client";

import { PrismaCalendarEventRepository } from "../calendar/repositories/calendar.repository";
import { CalendarService } from "../calendar/calendar.service";
import {
  CreateCalendarEventInput,
  FindUpcomingCalendarEventsOptions,
  ListCalendarEventsOptions,
  UpdateCalendarEventData,
} from "../calendar/calendar.types";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const defaultCalendarService = new CalendarService(
  new PrismaCalendarEventRepository(),
);

export const ALL_CALENDAR_EVENT_STATUSES: readonly CalendarEventStatus[] = [
  CalendarEventStatus.CONFIRMED,
  CalendarEventStatus.TENTATIVE,
  CalendarEventStatus.CANCELLED,
];

function requireObject(
  input: unknown,
): Record<string, unknown> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new Error("Tool input must be an object.");
  }

  return input as Record<string, unknown>;
}

function requireString(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(`${field} is required.`);
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  if (value.trim().length === 0) {
    throw new Error(`${field} is required.`);
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
    throw new Error(`${field} must be a string.`);
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalBoolean(
  input: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
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

function requireDate(
  input: Record<string, unknown>,
  field: string,
): Date {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(`${field} is required.`);
  }

  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error(`${field} must be an ISO date string.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid ISO date string.`);
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
    throw new Error(`${field} must be an ISO date string.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid ISO date string.`);
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
    throw new Error(`${field} must be a positive integer.`);
  }

  return value;
}

function optionalMetadata(
  input: Record<string, unknown>,
  field: string,
): Prisma.InputJsonValue | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }

  return value as Prisma.InputJsonValue;
}

function requireEventId(input: Record<string, unknown>): string {
  const eventId = input.eventId ?? input.id;

  if (eventId === undefined || eventId === null) {
    throw new Error("eventId is required.");
  }

  if (typeof eventId !== "string" || eventId.trim().length === 0) {
    throw new Error("eventId is required.");
  }

  return eventId.trim();
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

export function createCreateCalendarEventTool(
  service: CalendarService = defaultCalendarService,
): ToolDefinition {
  return {
    name: "create_calendar_event",

    description:
      "Create a scheduled calendar event for the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        title: {
          type: "string",
          description: "The title or summary of the calendar event.",
        },

        startTime: {
          type: "string",
          description:
            "The event start date and time as an ISO 8601 string (e.g. '2026-10-01T10:00:00Z').",
        },

        endTime: {
          type: "string",
          description:
            "The event end date and time as an ISO 8601 string (e.g. '2026-10-01T11:00:00Z').",
        },

        description: {
          type: "string",
          description: "Optional detailed description of the event.",
        },

        location: {
          type: "string",
          description: "Optional location (e.g. 'Conference Room A' or 'Zoom link').",
        },

        isAllDay: {
          type: "boolean",
          description: "Optional flag indicating whether this is an all-day event.",
        },

        timezone: {
          type: "string",
          description: "Optional IANA timezone name (e.g. 'America/New_York', defaults to 'UTC').",
        },

        status: {
          type: "string",
          enum: [
            CalendarEventStatus.CONFIRMED,
            CalendarEventStatus.TENTATIVE,
            CalendarEventStatus.CANCELLED,
          ],
          description: "Optional event status (defaults to 'CONFIRMED').",
        },

        recurrenceRule: {
          type: "string",
          description: "Optional recurrence rule pattern string.",
        },

        metadata: {
          type: "object",
          description: "Optional custom key-value metadata object.",
        },
      },

      required: ["title", "startTime", "endTime"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const eventInput: CreateCalendarEventInput = {
        userId,
        title: requireString(object, "title"),
        startTime: requireDate(object, "startTime"),
        endTime: requireDate(object, "endTime"),
        description: optionalString(object, "description"),
        location: optionalString(object, "location"),
        isAllDay: optionalBoolean(object, "isAllDay"),
        timezone: optionalString(object, "timezone"),
        status: optionalEnum(
          object,
          "status",
          ALL_CALENDAR_EVENT_STATUSES,
        ),
        recurrenceRule: optionalString(object, "recurrenceRule"),
        metadata: optionalMetadata(object, "metadata"),
      };

      return service.create(eventInput);
    },
  };
}

export function createListCalendarEventsTool(
  service: CalendarService = defaultCalendarService,
): ToolDefinition {
  return {
    name: "list_calendar_events",

    description:
      "List calendar events belonging to the authenticated BrainOS user, with optional date range or upcoming filter.",

    parameters: {
      type: "object",

      properties: {
        rangeStart: {
          type: "string",
          description:
            "Optional ISO 8601 start date of the time window to search for events (must be paired with rangeEnd).",
        },

        rangeEnd: {
          type: "string",
          description:
            "Optional ISO 8601 end date of the time window to search for events (must be paired with rangeStart).",
        },

        from: {
          type: "string",
          description:
            "Optional ISO 8601 date to search for upcoming events starting on or after this time (used when not providing rangeStart/rangeEnd).",
        },

        status: {
          type: "string",
          enum: [
            CalendarEventStatus.CONFIRMED,
            CalendarEventStatus.TENTATIVE,
            CalendarEventStatus.CANCELLED,
          ],
          description: "Optional status filter.",
        },

        limit: {
          type: "integer",
          description:
            "Optional maximum number of events to return.",
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

      const options: ListCalendarEventsOptions = {
        userId,
        rangeStart: optionalDate(object, "rangeStart"),
        rangeEnd: optionalDate(object, "rangeEnd"),
        from: optionalDate(object, "from"),
        status: optionalEnum(
          object,
          "status",
          ALL_CALENDAR_EVENT_STATUSES,
        ),
        limit: optionalPositiveInteger(object, "limit"),
      };

      return service.list(options);
    },
  };
}

export function createGetCalendarEventTool(
  service: CalendarService = defaultCalendarService,
): ToolDefinition {
  return {
    name: "get_calendar_event",

    description:
      "Get details of a specific calendar event owned by the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        eventId: {
          type: "string",
          description: "The exact ID of the calendar event to retrieve.",
        },
      },

      required: ["eventId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);
      const eventId = requireEventId(object);

      return service.get(eventId, userId);
    },
  };
}

export function createUpdateCalendarEventTool(
  service: CalendarService = defaultCalendarService,
): ToolDefinition {
  return {
    name: "update_calendar_event",

    description:
      "Update an owned BrainOS calendar event. Only supplied fields are modified.",

    parameters: {
      type: "object",

      properties: {
        eventId: {
          type: "string",
          description: "The exact ID of the calendar event to update.",
        },

        title: {
          type: "string",
          description: "Optional new event title.",
        },

        description: {
          type: "string",
          description: "Optional new event description.",
        },

        location: {
          type: "string",
          description: "Optional new event location.",
        },

        startTime: {
          type: "string",
          description: "Optional new event start time as an ISO 8601 string.",
        },

        endTime: {
          type: "string",
          description: "Optional new event end time as an ISO 8601 string.",
        },

        isAllDay: {
          type: "boolean",
          description: "Optional new all-day event flag.",
        },

        timezone: {
          type: "string",
          description: "Optional new IANA timezone name.",
        },

        status: {
          type: "string",
          enum: [
            CalendarEventStatus.CONFIRMED,
            CalendarEventStatus.TENTATIVE,
            CalendarEventStatus.CANCELLED,
          ],
          description: "Optional new event status.",
        },

        recurrenceRule: {
          type: "string",
          description: "Optional new recurrence rule string.",
        },

        metadata: {
          type: "object",
          description: "Optional new custom key-value metadata object.",
        },
      },

      required: ["eventId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);
      const eventId = requireEventId(object);

      const updateData: UpdateCalendarEventData = {
        title: optionalString(object, "title"),
        description:
          object.description === null
            ? null
            : optionalString(object, "description"),
        location:
          object.location === null
            ? null
            : optionalString(object, "location"),
        startTime: optionalDate(object, "startTime"),
        endTime: optionalDate(object, "endTime"),
        isAllDay: optionalBoolean(object, "isAllDay"),
        timezone: optionalString(object, "timezone"),
        status: optionalEnum(
          object,
          "status",
          ALL_CALENDAR_EVENT_STATUSES,
        ),
        recurrenceRule:
          object.recurrenceRule === null
            ? null
            : optionalString(object, "recurrenceRule"),
        metadata: optionalMetadata(object, "metadata"),
      };

      return service.update(eventId, userId, updateData);
    },
  };
}

export function createDeleteCalendarEventTool(
  service: CalendarService = defaultCalendarService,
): ToolDefinition {
  return {
    name: "delete_calendar_event",

    description:
      "Delete a calendar event owned by the authenticated BrainOS user.",

    parameters: {
      type: "object",

      properties: {
        eventId: {
          type: "string",
          description: "The exact ID of the calendar event to delete.",
        },
      },

      required: ["eventId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);
      const eventId = requireEventId(object);

      await service.delete(eventId, userId);

      return {
        success: true,
        eventId,
      };
    },
  };
}

export function createCalendarTools(
  service: CalendarService = defaultCalendarService,
): ToolDefinition[] {
  return [
    createCreateCalendarEventTool(service),
    createListCalendarEventsTool(service),
    createGetCalendarEventTool(service),
    createUpdateCalendarEventTool(service),
    createDeleteCalendarEventTool(service),
  ];
}

export const createCalendarEventTool: ToolDefinition =
  createCreateCalendarEventTool();

export const listCalendarEventsTool: ToolDefinition =
  createListCalendarEventsTool();

export const getCalendarEventTool: ToolDefinition =
  createGetCalendarEventTool();

export const updateCalendarEventTool: ToolDefinition =
  createUpdateCalendarEventTool();

export const deleteCalendarEventTool: ToolDefinition =
  createDeleteCalendarEventTool();
