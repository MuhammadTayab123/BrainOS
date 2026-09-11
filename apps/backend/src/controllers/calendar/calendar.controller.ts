import { Request, Response } from "express";
import { Prisma } from "@prisma/client";

import { NotFoundError, ValidationError } from "../../errors";
import { CalendarService } from "../../services/calendar/calendar.service";
import { PrismaCalendarEventRepository } from "../../services/calendar/repositories/calendar.repository";
import {
  calendarEventIdParamSchema,
  createCalendarEventBodySchema,
  listCalendarEventsQuerySchema,
  updateCalendarEventBodySchema,
} from "../../validators/calendar.validator";

let calendarService = new CalendarService(new PrismaCalendarEventRepository());

export function setCalendarService(service: CalendarService): void {
  calendarService = service;
}

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  });
}

export async function createCalendarEvent(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedBody = createCalendarEventBodySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedBody.error.issues[0]?.message ?? "Invalid calendar event data.",
      },
    });
  }

  try {
    const event = await calendarService.create({
      ...parsedBody.data,
      metadata:
        parsedBody.data.metadata === null || parsedBody.data.metadata === undefined
          ? (parsedBody.data.metadata as null | undefined)
          : (parsedBody.data.metadata as Prisma.InputJsonValue),
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

export async function listCalendarEvents(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedQuery = listCalendarEventsQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedQuery.error.issues[0]?.message ??
          "Invalid calendar query parameters.",
      },
    });
  }

  try {
    const events = await calendarService.list({
      ...parsedQuery.data,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: events,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

export async function getCalendarEventById(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedParams = calendarEventIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CALENDAR_EVENT_ID",
        message:
          parsedParams.error.issues[0]?.message ??
          "Calendar event ID is required.",
      },
    });
  }

  try {
    const event = await calendarService.get(
      parsedParams.data.id,
      req.user.id,
    );

    return res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

export async function updateCalendarEvent(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedParams = calendarEventIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CALENDAR_EVENT_ID",
        message:
          parsedParams.error.issues[0]?.message ??
          "Calendar event ID is required.",
      },
    });
  }

  const parsedBody = updateCalendarEventBodySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          parsedBody.error.issues[0]?.message ??
          "Invalid calendar update payload.",
      },
    });
  }

  try {
    const updated = await calendarService.update(
      parsedParams.data.id,
      req.user.id,
      {
        ...parsedBody.data,
        metadata:
          parsedBody.data.metadata === null || parsedBody.data.metadata === undefined
            ? (parsedBody.data.metadata as null | undefined)
            : (parsedBody.data.metadata as Prisma.InputJsonValue),
      },
    );

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    throw error;
  }
}

export async function deleteCalendarEvent(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const parsedParams = calendarEventIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CALENDAR_EVENT_ID",
        message:
          parsedParams.error.issues[0]?.message ??
          "Calendar event ID is required.",
      },
    });
  }

  try {
    await calendarService.delete(parsedParams.data.id, req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        id: parsedParams.data.id,
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: error.message,
        },
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
        },
      });
    }

    throw error;
  }
}
