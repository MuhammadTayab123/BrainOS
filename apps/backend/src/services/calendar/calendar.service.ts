import { NotFoundError, ValidationError } from "../../errors";

import {
  CalendarEvent,
  CalendarEventRepository,
  CreateCalendarEventInput,
  FindCalendarEventsByDateRangeOptions,
  FindUpcomingCalendarEventsOptions,
  isValidIanaTimezone,
  ListCalendarEventsOptions,
  UpdateCalendarEventData,
} from "./calendar.types";

export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarEventRepository,
  ) {}

  async create(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    this.validateUserId(input.userId);
    this.validateTitle(input.title);
    this.validateDates(input.startTime, input.endTime);

    if (input.timezone !== undefined) {
      this.validateTimezone(input.timezone);
    }

    return this.calendarRepository.create({
      userId: input.userId.trim(),
      title: input.title.trim(),
      description:
        input.description === null || input.description === undefined
          ? input.description
          : input.description.trim(),
      location:
        input.location === null || input.location === undefined
          ? input.location
          : input.location.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      isAllDay: input.isAllDay ?? false,
      timezone: input.timezone ? input.timezone.trim() : "UTC",
      status: input.status ?? "CONFIRMED",
      recurrenceRule: input.recurrenceRule,
      metadata: input.metadata,
    });
  }

  async get(id: string, userId: string): Promise<CalendarEvent> {
    this.validateUserId(userId);
    this.validateId(id, "Calendar event ID");

    const event = await this.calendarRepository.findByIdForUser(id, userId);

    if (!event) {
      throw new NotFoundError(
        "Calendar event not found for the authenticated user.",
      );
    }

    return event;
  }

  async list(options: ListCalendarEventsOptions): Promise<CalendarEvent[]> {
    this.validateUserId(options.userId);

    if (
      options.rangeStart !== undefined &&
      options.rangeEnd !== undefined
    ) {
      this.validateDates(
        options.rangeStart,
        options.rangeEnd,
        "Range start must be before range end.",
      );

      return this.calendarRepository.findByDateRange({
        userId: options.userId.trim(),
        rangeStart: options.rangeStart,
        rangeEnd: options.rangeEnd,
        status: options.status,
        limit: options.limit,
      });
    }

    if (options.rangeStart !== undefined || options.rangeEnd !== undefined) {
      throw new ValidationError(
        "Both rangeStart and rangeEnd are required when filtering by date range.",
      );
    }

    return this.calendarRepository.findUpcoming({
      userId: options.userId.trim(),
      from: options.from ?? new Date(0),
      status: options.status,
      limit: options.limit,
    });
  }

  async findByDateRange(
    options: FindCalendarEventsByDateRangeOptions,
  ): Promise<CalendarEvent[]> {
    this.validateUserId(options.userId);
    this.validateDates(
      options.rangeStart,
      options.rangeEnd,
      "Range start must be before range end.",
    );

    return this.calendarRepository.findByDateRange({
      userId: options.userId.trim(),
      rangeStart: options.rangeStart,
      rangeEnd: options.rangeEnd,
      status: options.status,
      limit: options.limit,
    });
  }

  async findUpcoming(
    options: FindUpcomingCalendarEventsOptions,
  ): Promise<CalendarEvent[]> {
    this.validateUserId(options.userId);

    return this.calendarRepository.findUpcoming({
      userId: options.userId.trim(),
      from: options.from ?? new Date(),
      status: options.status,
      limit: options.limit,
    });
  }

  async update(
    id: string,
    userId: string,
    data: UpdateCalendarEventData,
  ): Promise<CalendarEvent> {
    this.validateUserId(userId);
    this.validateId(id, "Calendar event ID");

    // Fetch existing record to verify existence and determine final effective dates
    const existing = await this.calendarRepository.findByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundError(
        "Calendar event not found for the authenticated user.",
      );
    }

    if (data.title !== undefined) {
      this.validateTitle(data.title);
    }

    if (data.timezone !== undefined) {
      this.validateTimezone(data.timezone);
    }

    // Always validate the FINAL effective startTime/endTime pair
    const effectiveStart =
      data.startTime !== undefined ? data.startTime : existing.startTime;
    const effectiveEnd =
      data.endTime !== undefined ? data.endTime : existing.endTime;

    this.validateDates(
      effectiveStart,
      effectiveEnd,
      "Start time must be before end time.",
    );

    const sanitizedData: UpdateCalendarEventData = {
      ...data,
      title: data.title !== undefined ? data.title.trim() : undefined,
      description:
        data.description !== undefined
          ? data.description === null
            ? null
            : data.description.trim()
          : undefined,
      location:
        data.location !== undefined
          ? data.location === null
            ? null
            : data.location.trim()
          : undefined,
      timezone:
        data.timezone !== undefined ? data.timezone.trim() : undefined,
    };

    return this.calendarRepository.updateForUser(
      id,
      userId,
      sanitizedData,
    );
  }

  async delete(id: string, userId: string): Promise<void> {
    this.validateUserId(userId);
    this.validateId(id, "Calendar event ID");

    await this.calendarRepository.deleteForUser(id, userId);
  }

  // Aliases matching project service conventions
  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    return this.create(input);
  }

  async getEvent(id: string, userId: string): Promise<CalendarEvent> {
    return this.get(id, userId);
  }

  async listEvents(options: ListCalendarEventsOptions): Promise<CalendarEvent[]> {
    return this.list(options);
  }

  async updateEvent(
    id: string,
    userId: string,
    data: UpdateCalendarEventData,
  ): Promise<CalendarEvent> {
    return this.update(id, userId, data);
  }

  async deleteEvent(id: string, userId: string): Promise<void> {
    return this.delete(id, userId);
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new ValidationError("User ID is required.");
    }
  }

  private validateId(value: string, fieldName: string): void {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      throw new ValidationError(`${fieldName} is required.`);
    }
  }

  private validateTitle(title: string): void {
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new ValidationError("Event title is required.");
    }
  }

  private validateDates(
    startTime: Date,
    endTime: Date,
    errorMessage = "Start time must be before end time.",
  ): void {
    if (
      !(startTime instanceof Date) ||
      isNaN(startTime.getTime()) ||
      !(endTime instanceof Date) ||
      isNaN(endTime.getTime())
    ) {
      throw new ValidationError("Valid start and end times are required.");
    }

    if (startTime.getTime() >= endTime.getTime()) {
      throw new ValidationError(errorMessage);
    }
  }

  private validateTimezone(timezone: string): void {
    if (!isValidIanaTimezone(timezone)) {
      throw new ValidationError("Invalid IANA timezone.");
    }
  }
}
