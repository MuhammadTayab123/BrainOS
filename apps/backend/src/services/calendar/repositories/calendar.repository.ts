import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  CalendarEvent,
  CalendarEventRepository,
  CreateCalendarEventInput,
  FindCalendarEventsByDateRangeOptions,
  FindUpcomingCalendarEventsOptions,
  UpdateCalendarEventData,
} from "../calendar.types";

export class PrismaCalendarEventRepository implements CalendarEventRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(data: CreateCalendarEventInput): Promise<CalendarEvent> {
    return this.db.calendarEvent.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description,
        location: data.location,
        startTime: data.startTime,
        endTime: data.endTime,
        isAllDay: data.isAllDay ?? false,
        timezone: data.timezone ?? "UTC",
        status: data.status ?? "CONFIRMED",
        recurrenceRule: data.recurrenceRule,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<CalendarEvent | null> {
    return this.db.calendarEvent.findFirst({
      where: {
        id,
        userId,
      },
    });
  }

  async findByDateRange(
    options: FindCalendarEventsByDateRangeOptions,
  ): Promise<CalendarEvent[]> {
    const {
      userId,
      rangeStart,
      rangeEnd,
      status,
      limit,
    } = options;

    return this.db.calendarEvent.findMany({
      where: {
        userId,
        startTime: {
          lt: rangeEnd,
        },
        endTime: {
          gt: rangeStart,
        },
        status: status ? status : undefined,
      },
      orderBy: {
        startTime: "asc",
      },
      take: limit,
    });
  }

  async findUpcoming(
    options: FindUpcomingCalendarEventsOptions,
  ): Promise<CalendarEvent[]> {
    const {
      userId,
      from = new Date(),
      status,
      limit,
    } = options;

    return this.db.calendarEvent.findMany({
      where: {
        userId,
        startTime: {
          gte: from,
        },
        status: status ? status : undefined,
      },
      orderBy: {
        startTime: "asc",
      },
      take: limit,
    });
  }

  async updateForUser(
    id: string,
    userId: string,
    data: UpdateCalendarEventData,
  ): Promise<CalendarEvent> {
    const result = await this.db.calendarEvent.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startTime: data.startTime,
        endTime: data.endTime,
        isAllDay: data.isAllDay,
        timezone: data.timezone,
        status: data.status,
        recurrenceRule: data.recurrenceRule,
        metadata: data.metadata ?? undefined,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Calendar event not found for the authenticated user.",
      );
    }

    const updated = await this.findByIdForUser(id, userId);
    return updated!;
  }

  async deleteForUser(
    id: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.calendarEvent.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Calendar event not found for the authenticated user.",
      );
    }
  }
}

export { PrismaCalendarEventRepository as CalendarEventRepositoryImpl };
