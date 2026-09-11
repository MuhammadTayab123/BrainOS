import { z } from "zod";
import { isValidIanaTimezone } from "../services/calendar/calendar.types";

export const calendarEventStatusSchema = z.enum([
  "CONFIRMED",
  "TENTATIVE",
  "CANCELLED",
]);

export const createCalendarEventBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional().nullable(),
    location: z.string().trim().optional().nullable(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    isAllDay: z.boolean().optional().default(false),
    timezone: z
      .string()
      .trim()
      .refine(isValidIanaTimezone, {
        message: "Invalid IANA timezone",
      })
      .optional()
      .default("UTC"),
    status: calendarEventStatusSchema.optional().default("CONFIRMED"),
    recurrenceRule: z.string().trim().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine((data) => data.startTime.getTime() < data.endTime.getTime(), {
    message: "Start time must be before end time",
    path: ["endTime"],
  });

export const updateCalendarEventBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").optional(),
    description: z.string().trim().optional().nullable(),
    location: z.string().trim().optional().nullable(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    isAllDay: z.boolean().optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidIanaTimezone, {
        message: "Invalid IANA timezone",
      })
      .optional(),
    status: calendarEventStatusSchema.optional(),
    recurrenceRule: z.string().trim().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.startTime.getTime() < data.endTime.getTime();
      }
      return true;
    },
    {
      message: "Start time must be before end time",
      path: ["endTime"],
    },
  );

export const listCalendarEventsQuerySchema = z
  .object({
    rangeStart: z.coerce.date().optional(),
    rangeEnd: z.coerce.date().optional(),
    status: calendarEventStatusSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine(
    (data) => {
      if (data.rangeStart && data.rangeEnd) {
        return data.rangeStart.getTime() < data.rangeEnd.getTime();
      }
      return true;
    },
    {
      message: "rangeStart must be before rangeEnd",
      path: ["rangeEnd"],
    },
  );

export const calendarEventIdParamSchema = z.object({
  id: z.string().trim().min(1, "Calendar event ID is required"),
});

// Full request schemas for Express validation middleware
export const createCalendarEventSchema = z.object({
  body: createCalendarEventBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateCalendarEventSchema = z.object({
  params: calendarEventIdParamSchema,
  body: updateCalendarEventBodySchema,
  query: z.object({}).optional(),
});

export const getCalendarEventSchema = z.object({
  params: calendarEventIdParamSchema,
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const listCalendarEventsSchema = z.object({
  query: listCalendarEventsQuerySchema.optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const deleteCalendarEventSchema = z.object({
  params: calendarEventIdParamSchema,
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});
