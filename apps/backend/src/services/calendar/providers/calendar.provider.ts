import {
  CalendarProviderCapabilities,
  ProviderCalendarEvent,
  ProviderCreateEventInput,
  ProviderListEventsOptions,
  ProviderRequestOptions,
  ProviderUpdateEventInput,
} from "./calendar.provider.types";

/**
 * ============================================================================
 * BrainOS External Calendar Provider Contract
 * ============================================================================
 *
 * Provider-independent interface for external calendar systems (e.g., Google,
 * Microsoft Graph, CalDAV).
 *
 * Invariants:
 * - Does not accept or expose BrainOS tenant/userId; account/token binding is
 *   managed externally by the caller or container.
 * - Normalized event model decoupled from any vendor API schema.
 * - Fail-closed error normalization using CalendarProviderError hierarchy.
 */
export interface CalendarProvider {
  /**
   * Unique identifier of this provider instance (e.g. "mock-calendar", "google-calendar-1").
   */
  readonly id: string;

  /**
   * Human-readable display name of the provider.
   */
  readonly name: string;

  /**
   * Capabilities declared by this provider.
   */
  readonly capabilities: CalendarProviderCapabilities;

  /**
   * List calendar events from the provider matching the given filters.
   */
  listEvents(options?: ProviderListEventsOptions): Promise<ProviderCalendarEvent[]>;

  /**
   * Fetch a single calendar event by its external provider ID.
   * Returns null if not found.
   */
  getEvent(
    externalId: string,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent | null>;

  /**
   * Create a new calendar event on the provider.
   */
  createEvent(
    input: ProviderCreateEventInput,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent>;

  /**
   * Update an existing calendar event on the provider.
   */
  updateEvent(
    externalId: string,
    input: ProviderUpdateEventInput,
    options?: ProviderRequestOptions,
  ): Promise<ProviderCalendarEvent>;

  /**
   * Delete an existing calendar event from the provider.
   */
  deleteEvent(
    externalId: string,
    options?: ProviderRequestOptions,
  ): Promise<void>;
}
