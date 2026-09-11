import { CalendarEvent, CalendarEventStatus, Prisma } from "@prisma/client";

export {
  CalendarEvent,
  CalendarEventStatus,
};

export function isValidIanaTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== "string" || timezone.trim().length === 0) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
    return true;
  } catch {
    return false;
  }
}

export interface CreateCalendarEventInput {
  userId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string | null;
  location?: string | null;
  isAllDay?: boolean;
  timezone?: string;
  status?: CalendarEventStatus;
  recurrenceRule?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface UpdateCalendarEventData {
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: Date;
  endTime?: Date;
  isAllDay?: boolean;
  timezone?: string;
  status?: CalendarEventStatus;
  recurrenceRule?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

export interface FindCalendarEventsByDateRangeOptions {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  status?: CalendarEventStatus;
  limit?: number;
}

export interface FindUpcomingCalendarEventsOptions {
  userId: string;
  from?: Date;
  status?: CalendarEventStatus;
  limit?: number;
}

export interface ListCalendarEventsOptions {
  userId: string;
  rangeStart?: Date;
  rangeEnd?: Date;
  from?: Date;
  status?: CalendarEventStatus;
  limit?: number;
}

export interface CalendarEventRepository {
  create(data: CreateCalendarEventInput): Promise<CalendarEvent>;
  findByIdForUser(id: string, userId: string): Promise<CalendarEvent | null>;
  findByDateRange(options: FindCalendarEventsByDateRangeOptions): Promise<CalendarEvent[]>;
  findUpcoming(options: FindUpcomingCalendarEventsOptions): Promise<CalendarEvent[]>;
  updateForUser(id: string, userId: string, data: UpdateCalendarEventData): Promise<CalendarEvent>;
  deleteForUser(id: string, userId: string): Promise<void>;
}
