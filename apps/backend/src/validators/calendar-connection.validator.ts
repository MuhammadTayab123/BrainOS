import { z } from "zod";

export const calendarConnectionStatusSchema = z.enum([
  "CONNECTED",
  "NEEDS_REAUTH",
  "DISCONNECTED",
  "ERROR",
]);

export const calendarConnectionIdParamSchema = z.object({
  id: z.string().trim().min(1, "Calendar connection ID is required"),
});

export const updateCalendarConnectionBodySchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Display name cannot be empty")
      .max(100, "Display name cannot exceed 100 characters")
      .optional()
      .nullable(),
    accountEmail: z
      .string()
      .trim()
      .email("Invalid email format")
      .optional()
      .nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
    status: calendarConnectionStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one update field must be provided",
  });

// Full request schemas for validation middleware / tests
export const getCalendarConnectionSchema = z.object({
  params: calendarConnectionIdParamSchema,
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const updateCalendarConnectionSchema = z.object({
  params: calendarConnectionIdParamSchema,
  body: updateCalendarConnectionBodySchema,
  query: z.object({}).optional(),
});

export const deleteCalendarConnectionSchema = z.object({
  params: calendarConnectionIdParamSchema,
  query: z.object({}).optional(),
  body: z.object({}).optional(),
});

export const listCalendarConnectionsSchema = z.object({
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});
