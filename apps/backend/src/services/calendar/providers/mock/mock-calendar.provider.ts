import { randomUUID } from "node:crypto";
import { CalendarProvider } from "../calendar.provider";
import {
  CalendarProviderAuthError,
  CalendarProviderCapabilities,
  CalendarProviderNotFoundError,
  CalendarProviderRateLimitError,
  CalendarProviderUnavailableError,
  CalendarProviderValidationError,
  ProviderCalendarEvent,
  ProviderCreateEventInput,
  ProviderListEventsOptions,
  ProviderRequestOptions,
  ProviderUpdateEventInput,
} from "../calendar.provider.types";

export type MockFailureMode =
  | "none"
  | "auth"
  | "rate_limit"
  | "not_found"
  | "unavailable"
  | "validation";

export interface MockCalendarProviderOptions {
  id?: string;
  name?: string;
  capabilities?: Partial<CalendarProviderCapabilities>;
  initialEvents?: ProviderCalendarEvent[];
  simulatedDelayMs?: number;
  failureMode?: MockFailureMode;
}

export interface RecordedProviderCall {
  method: "listEvents" | "getEvent" | "createEvent" | "updateEvent" | "deleteEvent";
  args: unknown;
  timestamp: Date;
}

const DEFAULT_CAPABILITIES: CalendarProviderCapabilities = {
  isReadOnly: false,
  supportsRecurring: true,
  supportsAllDay: true,
  supportsStatusUpdates: true,
  supportsLocation: true,
  supportsDescription: true,
  supportsAttendees: true,
  supportsReminders: true,
};

export class MockCalendarProvider implements CalendarProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly capabilities: CalendarProviderCapabilities;

  private events = new Map<string, ProviderCalendarEvent>();
  public recordedCalls: RecordedProviderCall[] = [];
  public simulatedDelayMs: number;
  public failureMode: MockFailureMode;

  constructor(options: MockCalendarProviderOptions = {}) {
    this.id = options.id ?? "mock-calendar";
    this.name = options.name ?? "Mock Calendar Provider";
    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      ...options.capabilities,
    };
    this.simulatedDelayMs = options.simulatedDelayMs ?? 0;
    this.failureMode = options.failureMode ?? "none";

    if (options.initialEvents) {
      for (const event of options.initialEvents) {
        this.events.set(event.externalId, this.cloneEvent(event));
      }
    }
  }

  private async handlePreflight(
    method: RecordedProviderCall["method"],
    args: unknown,
    options?: ProviderRequestOptions,
  ): Promise<void> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    this.recordedCalls.push({
      method,
      args,
      timestamp: new Date(),
    });

    if (this.simulatedDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, this.simulatedDelayMs);
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }
      });
    }

    if (this.failureMode === "auth") {
      throw new CalendarProviderAuthError("Simulated authentication failure.", this.id);
    }
    if (this.failureMode === "rate_limit") {
      throw new CalendarProviderRateLimitError("Simulated rate limit exceeded.", {
        providerId: this.id,
        retryAfterSeconds: 60,
      });
    }
    if (this.failureMode === "not_found") {
      throw new CalendarProviderNotFoundError("Simulated provider resource not found.", this.id);
    }
    if (this.failureMode === "unavailable") {
      throw new CalendarProviderUnavailableError("Simulated provider unavailable.", this.id);
    }
    if (this.failureMode === "validation") {
      throw new CalendarProviderValidationError("Simulated validation error.", this.id);
    }
  }

  private cloneEvent(event: ProviderCalendarEvent): ProviderCalendarEvent {
    return {
      ...event,
      startTime: new Date(event.startTime.getTime()),
      endTime: new Date(event.endTime.getTime()),
      createdAt: event.createdAt ? new Date(event.createdAt.getTime()) : undefined,
      updatedAt: event.updatedAt ? new Date(event.updatedAt.getTime()) : undefined,
      metadata: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : null,
    };
  }

  async listEvents(options?: ProviderListEventsOptions): Promise<ProviderCalendarEvent[]> {
    await this.handlePreflight("listEvents", options, options);

    let result = Array.from(this.events.values()).map((e) => this.cloneEvent(e));

    if (options?.status) {
      result = result.filter((e) => e.status === options.status);
    }

    if (options?.rangeStart && options?.rangeEnd) {
      const rStart = options.rangeStart.getTime();
      const rEnd = options.rangeEnd.getTime();
      if (rStart >= rEnd) {
        throw new CalendarProviderValidationError(
          "rangeStart must be before rangeEnd.",
          this.id,
        );
      }
      // Standard interval overlap: event.startTime < rangeEnd && event.endTime > rangeStart
      result = result.filter(
        (e) => e.startTime.getTime() < rEnd && e.endTime.getTime() > rStart,
      );
    } else if (options?.from) {
      const fromTime = options.from.getTime();
      result = result.filter((e) => e.endTime.getTime() >= fromTime);
    }

    // Sort by startTime ascending
    result.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (options?.limit !== undefined && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  async getEvent(
    externalId: string,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent | null> {
    await this.handlePreflight("getEvent", { externalId }, options);

    const event = this.events.get(externalId);
    if (!event) {
      return null;
    }
    return this.cloneEvent(event);
  }

  async createEvent(
    input: ProviderCreateEventInput,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent> {
    await this.handlePreflight("createEvent", input, options);

    if (this.capabilities.isReadOnly) {
      throw new CalendarProviderValidationError(
        "Provider is read-only and does not support creating events.",
        this.id,
      );
    }

    if (!input.title || input.title.trim().length === 0) {
      throw new CalendarProviderValidationError(
        "Event title is required.",
        this.id,
      );
    }

    if (input.startTime.getTime() >= input.endTime.getTime()) {
      throw new CalendarProviderValidationError(
        "Start time must be before end time.",
        this.id,
      );
    }

    const now = new Date();
    const externalId = randomUUID();
    const event: ProviderCalendarEvent = {
      externalId,
      title: input.title.trim(),
      description: input.description ?? null,
      location: input.location ?? null,
      startTime: new Date(input.startTime.getTime()),
      endTime: new Date(input.endTime.getTime()),
      isAllDay: input.isAllDay ?? false,
      timezone: input.timezone ? input.timezone.trim() : "UTC",
      status: input.status ?? "CONFIRMED",
      recurrenceRule: input.recurrenceRule ?? null,
      metadata: input.metadata ?? null,
      htmlLink: `https://calendar.mock.local/events/${externalId}`,
      createdAt: now,
      updatedAt: now,
    };

    this.events.set(event.externalId, this.cloneEvent(event));
    return this.cloneEvent(event);
  }

  async updateEvent(
    externalId: string,
    input: ProviderUpdateEventInput,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent> {
    await this.handlePreflight("updateEvent", { externalId, input }, options);

    if (this.capabilities.isReadOnly) {
      throw new CalendarProviderValidationError(
        "Provider is read-only and does not support updating events.",
        this.id,
      );
    }

    const existing = this.events.get(externalId);
    if (!existing) {
      throw new CalendarProviderNotFoundError(
        `Event with externalId '${externalId}' not found.`,
        this.id,
      );
    }

    if (input.title !== undefined && input.title.trim().length === 0) {
      throw new CalendarProviderValidationError(
        "Event title cannot be blank.",
        this.id,
      );
    }

    const effectiveStart = input.startTime ?? existing.startTime;
    const effectiveEnd = input.endTime ?? existing.endTime;

    if (effectiveStart.getTime() >= effectiveEnd.getTime()) {
      throw new CalendarProviderValidationError(
        "Start time must be before end time.",
        this.id,
      );
    }

    const updated: ProviderCalendarEvent = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      location: input.location !== undefined ? input.location : existing.location,
      startTime: new Date(effectiveStart.getTime()),
      endTime: new Date(effectiveEnd.getTime()),
      isAllDay: input.isAllDay !== undefined ? input.isAllDay : existing.isAllDay,
      timezone: input.timezone !== undefined ? input.timezone.trim() : existing.timezone,
      status: input.status !== undefined ? input.status : existing.status,
      recurrenceRule:
        input.recurrenceRule !== undefined ? input.recurrenceRule : existing.recurrenceRule,
      metadata: input.metadata !== undefined ? input.metadata : existing.metadata,
      updatedAt: new Date(),
    };

    this.events.set(externalId, this.cloneEvent(updated));
    return this.cloneEvent(updated);
  }

  async deleteEvent(
    externalId: string,
    options?: ProviderRequestOptions,
  ): Promise<void> {
    await this.handlePreflight("deleteEvent", { externalId }, options);

    if (this.capabilities.isReadOnly) {
      throw new CalendarProviderValidationError(
        "Provider is read-only and does not support deleting events.",
        this.id,
      );
    }

    if (!this.events.has(externalId)) {
      throw new CalendarProviderNotFoundError(
        `Event with externalId '${externalId}' not found.`,
        this.id,
      );
    }

    this.events.delete(externalId);
  }

  // --- Test & simulation utilities ---

  public seedEvents(events: ProviderCalendarEvent[]): void {
    for (const event of events) {
      this.events.set(event.externalId, this.cloneEvent(event));
    }
  }

  public getEvents(): ProviderCalendarEvent[] {
    return Array.from(this.events.values()).map((e) => this.cloneEvent(e));
  }

  public clear(): void {
    this.events.clear();
    this.recordedCalls = [];
  }

  public reset(): void {
    this.clear();
    this.simulatedDelayMs = 0;
    this.failureMode = "none";
  }
}
