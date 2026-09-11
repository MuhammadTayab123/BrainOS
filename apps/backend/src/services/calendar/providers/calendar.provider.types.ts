import { AppError } from "../../../errors/AppError";

/**
 * ============================================================================
 * BrainOS External Calendar Provider Types & Models
 * ============================================================================
 */

export type ProviderEventStatus = "CONFIRMED" | "TENTATIVE" | "CANCELLED";

export interface ProviderCalendarEvent {
  externalId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone: string;
  status: ProviderEventStatus;
  recurrenceRule?: string | null;
  metadata?: Record<string, unknown> | null;
  htmlLink?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProviderRequestOptions {
  signal?: AbortSignal;
}

export interface ProviderCreateEventInput {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string | null;
  location?: string | null;
  isAllDay?: boolean;
  timezone?: string;
  status?: ProviderEventStatus;
  recurrenceRule?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProviderUpdateEventInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: Date;
  endTime?: Date;
  isAllDay?: boolean;
  timezone?: string;
  status?: ProviderEventStatus;
  recurrenceRule?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ProviderListEventsOptions extends ProviderRequestOptions {
  rangeStart?: Date;
  rangeEnd?: Date;
  from?: Date;
  status?: ProviderEventStatus;
  limit?: number;
}

export interface CalendarProviderCapabilities {
  readonly isReadOnly: boolean;
  readonly supportsRecurring: boolean;
  readonly supportsAllDay: boolean;
  readonly supportsStatusUpdates: boolean;
  readonly supportsLocation: boolean;
  readonly supportsDescription: boolean;
  readonly supportsAttendees: boolean;
  readonly supportsReminders: boolean;
}

/**
 * ============================================================================
 * Normalized Safe Calendar Provider Errors
 * ============================================================================
 */

export class CalendarProviderError extends AppError {
  public readonly providerId?: string;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      providerId?: string;
      isOperational?: boolean;
    },
  ) {
    super({
      message,
      statusCode: options?.statusCode ?? 502,
      code: options?.code ?? "CALENDAR_PROVIDER_ERROR",
      isOperational: options?.isOperational ?? true,
    });
    this.providerId = options?.providerId;
  }
}

export class CalendarProviderAuthError extends CalendarProviderError {
  constructor(
    message = "Calendar provider authentication failed.",
    providerId?: string,
  ) {
    super(message, {
      statusCode: 401,
      code: "CALENDAR_PROVIDER_AUTH_ERROR",
      providerId,
    });
  }
}

export class CalendarProviderNotFoundError extends CalendarProviderError {
  constructor(
    message = "Calendar event not found on provider.",
    providerId?: string,
  ) {
    super(message, {
      statusCode: 404,
      code: "CALENDAR_PROVIDER_NOT_FOUND",
      providerId,
    });
  }
}

export class CalendarProviderRateLimitError extends CalendarProviderError {
  public readonly retryAfterSeconds?: number;

  constructor(
    message = "Calendar provider rate limit exceeded.",
    options?: { providerId?: string; retryAfterSeconds?: number },
  ) {
    super(message, {
      statusCode: 429,
      code: "CALENDAR_PROVIDER_RATE_LIMIT",
      providerId: options?.providerId,
    });
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export class CalendarProviderValidationError extends CalendarProviderError {
  constructor(message: string, providerId?: string) {
    super(message, {
      statusCode: 400,
      code: "CALENDAR_PROVIDER_VALIDATION_ERROR",
      providerId,
    });
  }
}

export class CalendarProviderUnavailableError extends CalendarProviderError {
  constructor(
    message = "Calendar provider service is temporarily unavailable.",
    providerId?: string,
  ) {
    super(message, {
      statusCode: 503,
      code: "CALENDAR_PROVIDER_UNAVAILABLE",
      providerId,
    });
  }
}
