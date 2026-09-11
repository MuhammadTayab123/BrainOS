import { describe, expect, it, beforeEach } from "vitest";
import {
  CalendarProvider,
  CalendarProviderAuthError,
  CalendarProviderNotFoundError,
  CalendarProviderRateLimitError,
  CalendarProviderRegistry,
  CalendarProviderUnavailableError,
  CalendarProviderValidationError,
  MockCalendarProvider,
  ProviderCalendarEvent,
} from "../../../../src/services/calendar/providers";

describe("Calendar Provider Abstraction", () => {
  describe("Capabilities and Interface", () => {
    it("reports default capabilities accurately on MockCalendarProvider", () => {
      const provider = new MockCalendarProvider();

      expect(provider.id).toBe("mock-calendar");
      expect(provider.name).toBe("Mock Calendar Provider");
      expect(provider.capabilities.isReadOnly).toBe(false);
      expect(provider.capabilities.supportsRecurring).toBe(true);
      expect(provider.capabilities.supportsAllDay).toBe(true);
      expect(provider.capabilities.supportsStatusUpdates).toBe(true);
      expect(provider.capabilities.supportsLocation).toBe(true);
      expect(provider.capabilities.supportsDescription).toBe(true);
      expect(provider.capabilities.supportsAttendees).toBe(true);
      expect(provider.capabilities.supportsReminders).toBe(true);
    });

    it("allows custom capability overrides", () => {
      const readOnlyProvider = new MockCalendarProvider({
        id: "read-only-cal",
        name: "Read Only Provider",
        capabilities: {
          isReadOnly: true,
          supportsRecurring: false,
        },
      });

      expect(readOnlyProvider.capabilities.isReadOnly).toBe(true);
      expect(readOnlyProvider.capabilities.supportsRecurring).toBe(false);
      expect(readOnlyProvider.capabilities.supportsAllDay).toBe(true);
    });
  });

  describe("MockCalendarProvider CRUD Operations", () => {
    let provider: MockCalendarProvider;

    beforeEach(() => {
      provider = new MockCalendarProvider();
    });

    it("creates an event with valid normalized data and defaults", async () => {
      const start = new Date("2026-10-01T10:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      const created = await provider.createEvent({
        title: "Sprint Planning",
        startTime: start,
        endTime: end,
      });

      expect(created.externalId).toBeDefined();
      expect(typeof created.externalId).toBe("string");
      expect(created.title).toBe("Sprint Planning");
      expect(created.startTime.toISOString()).toBe(start.toISOString());
      expect(created.endTime.toISOString()).toBe(end.toISOString());
      expect(created.timezone).toBe("UTC");
      expect(created.status).toBe("CONFIRMED");
      expect(created.isAllDay).toBe(false);
      expect(created.htmlLink).toContain(created.externalId.slice(0, 8));
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("creates an event with optional fields provided", async () => {
      const start = new Date("2026-10-02T14:00:00Z");
      const end = new Date("2026-10-02T15:00:00Z");

      const created = await provider.createEvent({
        title: "Architecture Review",
        description: "Review provider abstraction",
        location: "Virtual Room 4",
        startTime: start,
        endTime: end,
        timezone: "America/New_York",
        status: "TENTATIVE",
        isAllDay: true,
        recurrenceRule: "FREQ=WEEKLY;BYDAY=FR",
        metadata: { department: "engineering" },
      });

      expect(created.title).toBe("Architecture Review");
      expect(created.description).toBe("Review provider abstraction");
      expect(created.location).toBe("Virtual Room 4");
      expect(created.timezone).toBe("America/New_York");
      expect(created.status).toBe("TENTATIVE");
      expect(created.isAllDay).toBe(true);
      expect(created.recurrenceRule).toBe("FREQ=WEEKLY;BYDAY=FR");
      expect(created.metadata).toEqual({ department: "engineering" });
    });

    it("rejects event creation with empty or whitespace title", async () => {
      const start = new Date("2026-10-01T10:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      await expect(
        provider.createEvent({
          title: "   ",
          startTime: start,
          endTime: end,
        }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("rejects event creation where start time is equal to end time", async () => {
      const sameTime = new Date("2026-10-01T10:00:00Z");

      await expect(
        provider.createEvent({
          title: "Zero Duration Event",
          startTime: sameTime,
          endTime: sameTime,
        }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("rejects event creation where start time is after end time", async () => {
      const start = new Date("2026-10-01T12:00:00Z");
      const end = new Date("2026-10-01T10:00:00Z");

      await expect(
        provider.createEvent({
          title: "Inverted Time Event",
          startTime: start,
          endTime: end,
        }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("rejects creation when provider is read-only", async () => {
      const roProvider = new MockCalendarProvider({
        capabilities: { isReadOnly: true },
      });

      await expect(
        roProvider.createEvent({
          title: "Test",
          startTime: new Date("2026-10-01T10:00:00Z"),
          endTime: new Date("2026-10-01T11:00:00Z"),
        }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("fetches an existing event by externalId and returns cloned object", async () => {
      const created = await provider.createEvent({
        title: "Team Sync",
        startTime: new Date("2026-10-03T09:00:00Z"),
        endTime: new Date("2026-10-03T10:00:00Z"),
      });

      const fetched = await provider.getEvent(created.externalId);
      expect(fetched).not.toBeNull();
      expect(fetched?.externalId).toBe(created.externalId);
      expect(fetched?.title).toBe("Team Sync");

      // Mutating fetched should not mutate internal store
      if (fetched) {
        fetched.title = "Altered Title";
      }

      const fetchedAgain = await provider.getEvent(created.externalId);
      expect(fetchedAgain?.title).toBe("Team Sync");
    });

    it("returns null when getEvent cannot find the externalId", async () => {
      const result = await provider.getEvent("non-existent-id");
      expect(result).toBeNull();
    });

    it("updates an existing event with partial modifications", async () => {
      const created = await provider.createEvent({
        title: "Old Title",
        description: "Old Desc",
        startTime: new Date("2026-10-04T10:00:00Z"),
        endTime: new Date("2026-10-04T11:00:00Z"),
        status: "CONFIRMED",
      });

      const updated = await provider.updateEvent(created.externalId, {
        title: "New Title",
        status: "CANCELLED",
      });

      expect(updated.title).toBe("New Title");
      expect(updated.description).toBe("Old Desc");
      expect(updated.status).toBe("CANCELLED");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt!.getTime());
    });

    it("validates effective date pairing on partial updates", async () => {
      const created = await provider.createEvent({
        title: "Date Test",
        startTime: new Date("2026-10-04T10:00:00Z"),
        endTime: new Date("2026-10-04T11:00:00Z"),
      });

      // Updating start time to after existing end time should fail
      await expect(
        provider.updateEvent(created.externalId, {
          startTime: new Date("2026-10-04T12:00:00Z"),
        }),
      ).rejects.toThrow(CalendarProviderValidationError);

      // Updating end time to before existing start time should fail
      await expect(
        provider.updateEvent(created.externalId, {
          endTime: new Date("2026-10-04T09:00:00Z"),
        }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("throws CalendarProviderNotFoundError when updating non-existent event", async () => {
      await expect(
        provider.updateEvent("missing-id", { title: "New" }),
      ).rejects.toThrow(CalendarProviderNotFoundError);
    });

    it("throws CalendarProviderValidationError when updating title to blank", async () => {
      const created = await provider.createEvent({
        title: "Original",
        startTime: new Date("2026-10-04T10:00:00Z"),
        endTime: new Date("2026-10-04T11:00:00Z"),
      });

      await expect(
        provider.updateEvent(created.externalId, { title: "   " }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("deletes an existing event", async () => {
      const created = await provider.createEvent({
        title: "To Delete",
        startTime: new Date("2026-10-05T10:00:00Z"),
        endTime: new Date("2026-10-05T11:00:00Z"),
      });

      await provider.deleteEvent(created.externalId);

      const fetched = await provider.getEvent(created.externalId);
      expect(fetched).toBeNull();
    });

    it("throws CalendarProviderNotFoundError when deleting non-existent event", async () => {
      await expect(provider.deleteEvent("unknown-id")).rejects.toThrow(
        CalendarProviderNotFoundError,
      );
    });

    it("rejects delete and update when provider is read-only", async () => {
      const roProvider = new MockCalendarProvider({
        capabilities: { isReadOnly: true },
        initialEvents: [
          {
            externalId: "ro-1",
            title: "Read Only Event",
            startTime: new Date("2026-10-01T10:00:00Z"),
            endTime: new Date("2026-10-01T11:00:00Z"),
            isAllDay: false,
            timezone: "UTC",
            status: "CONFIRMED",
          },
        ],
      });

      await expect(
        roProvider.updateEvent("ro-1", { title: "Attempt Update" }),
      ).rejects.toThrow(CalendarProviderValidationError);

      await expect(roProvider.deleteEvent("ro-1")).rejects.toThrow(
        CalendarProviderValidationError,
      );
    });
  });

  describe("Date-Range Filtering and List Operations", () => {
    let provider: MockCalendarProvider;

    beforeEach(() => {
      provider = new MockCalendarProvider();
      provider.seedEvents([
        {
          externalId: "evt-1",
          title: "Morning Standup",
          startTime: new Date("2026-10-10T09:00:00Z"),
          endTime: new Date("2026-10-10T09:30:00Z"),
          isAllDay: false,
          timezone: "UTC",
          status: "CONFIRMED",
        },
        {
          externalId: "evt-2",
          title: "All Day Hackathon",
          startTime: new Date("2026-10-10T00:00:00Z"),
          endTime: new Date("2026-10-10T23:59:59Z"),
          isAllDay: true,
          timezone: "UTC",
          status: "CONFIRMED",
        },
        {
          externalId: "evt-3",
          title: "Tentative Demo",
          startTime: new Date("2026-10-11T14:00:00Z"),
          endTime: new Date("2026-10-11T15:00:00Z"),
          isAllDay: false,
          timezone: "UTC",
          status: "TENTATIVE",
        },
        {
          externalId: "evt-4",
          title: "Cancelled Retrospective",
          startTime: new Date("2026-10-12T16:00:00Z"),
          endTime: new Date("2026-10-12T17:00:00Z"),
          isAllDay: false,
          timezone: "UTC",
          status: "CANCELLED",
        },
      ]);
    });

    it("lists all events sorted by startTime ascending", async () => {
      const list = await provider.listEvents();
      expect(list.length).toBe(4);
      expect(list[0].externalId).toBe("evt-2"); // 00:00
      expect(list[1].externalId).toBe("evt-1"); // 09:00
      expect(list[2].externalId).toBe("evt-3"); // Next day
      expect(list[3].externalId).toBe("evt-4"); // Two days later
    });

    it("filters events by status", async () => {
      const tentative = await provider.listEvents({ status: "TENTATIVE" });
      expect(tentative.length).toBe(1);
      expect(tentative[0].title).toBe("Tentative Demo");

      const confirmed = await provider.listEvents({ status: "CONFIRMED" });
      expect(confirmed.length).toBe(2);
    });

    it("filters events overlapping a date range correctly", async () => {
      // Range: 2026-10-10 08:00 to 10:00 UTC
      const overlapping = await provider.listEvents({
        rangeStart: new Date("2026-10-10T08:00:00Z"),
        rangeEnd: new Date("2026-10-10T10:00:00Z"),
      });

      // evt-1 (09:00-09:30) overlaps
      // evt-2 (00:00-23:59) overlaps
      // evt-3 and evt-4 are on subsequent days and do not overlap
      expect(overlapping.length).toBe(2);
      expect(overlapping.map((e) => e.externalId)).toEqual(["evt-2", "evt-1"]);
    });

    it("rejects rangeStart >= rangeEnd", async () => {
      await expect(
        provider.listEvents({
          rangeStart: new Date("2026-10-10T12:00:00Z"),
          rangeEnd: new Date("2026-10-10T10:00:00Z"),
        }),
      ).rejects.toThrow(CalendarProviderValidationError);
    });

    it("filters upcoming events with from timestamp", async () => {
      const fromEvents = await provider.listEvents({
        from: new Date("2026-10-11T12:00:00Z"),
      });

      expect(fromEvents.length).toBe(2);
      expect(fromEvents.map((e) => e.externalId)).toEqual(["evt-3", "evt-4"]);
    });

    it("respects limit parameter", async () => {
      const limited = await provider.listEvents({ limit: 2 });
      expect(limited.length).toBe(2);
    });
  });

  describe("Simulated Errors and Provider Failure Modes", () => {
    it("simulates authentication errors (401)", async () => {
      const provider = new MockCalendarProvider({ failureMode: "auth" });

      await expect(provider.listEvents()).rejects.toThrow(CalendarProviderAuthError);
      try {
        await provider.listEvents();
      } catch (err) {
        expect(err).toBeInstanceOf(CalendarProviderAuthError);
        const providerErr = err as CalendarProviderAuthError;
        expect(providerErr.statusCode).toBe(401);
        expect(providerErr.code).toBe("CALENDAR_PROVIDER_AUTH_ERROR");
        expect(providerErr.providerId).toBe("mock-calendar");
      }
    });

    it("simulates rate limit errors (429)", async () => {
      const provider = new MockCalendarProvider({ failureMode: "rate_limit" });

      try {
        await provider.createEvent({
          title: "Rate Limit Test",
          startTime: new Date("2026-10-01T10:00:00Z"),
          endTime: new Date("2026-10-01T11:00:00Z"),
        });
        expect.unreachable("Should have thrown rate limit error");
      } catch (err) {
        expect(err).toBeInstanceOf(CalendarProviderRateLimitError);
        const rateErr = err as CalendarProviderRateLimitError;
        expect(rateErr.statusCode).toBe(429);
        expect(rateErr.code).toBe("CALENDAR_PROVIDER_RATE_LIMIT");
        expect(rateErr.retryAfterSeconds).toBe(60);
      }
    });

    it("simulates unavailable errors (503)", async () => {
      const provider = new MockCalendarProvider({ failureMode: "unavailable" });

      await expect(provider.getEvent("some-id")).rejects.toThrow(
        CalendarProviderUnavailableError,
      );
    });

    it("ensures error messages never expose credentials or tokens", async () => {
      const provider = new MockCalendarProvider({ failureMode: "auth" });

      try {
        await provider.listEvents();
      } catch (err) {
        const message = (err as Error).message;
        expect(message).not.toContain("bearer");
        expect(message).not.toContain("secret");
        expect(message).not.toContain("token");
        expect(message).not.toContain("password");
      }
    });
  });

  describe("Recorded Calls, Latency, and AbortSignal", () => {
    it("records method calls with arguments and timestamps", async () => {
      const provider = new MockCalendarProvider();

      await provider.createEvent({
        title: "Recorded Event",
        startTime: new Date("2026-10-01T10:00:00Z"),
        endTime: new Date("2026-10-01T11:00:00Z"),
      });

      await provider.listEvents({ limit: 5 });

      expect(provider.recordedCalls.length).toBe(2);
      expect(provider.recordedCalls[0].method).toBe("createEvent");
      expect(provider.recordedCalls[1].method).toBe("listEvents");
    });

    it("respects pre-aborted signal", async () => {
      const provider = new MockCalendarProvider();
      const controller = new AbortController();
      controller.abort();

      await expect(
        provider.listEvents({ signal: controller.signal }),
      ).rejects.toThrow("The operation was aborted.");
    });

    it("respects signal aborted during simulated delay", async () => {
      const provider = new MockCalendarProvider({ simulatedDelayMs: 200 });
      const controller = new AbortController();

      const promise = provider.listEvents({ signal: controller.signal });
      setTimeout(() => controller.abort(), 20);

      await expect(promise).rejects.toThrow("The operation was aborted.");
    });

    it("resets provider state cleanly", async () => {
      const provider = new MockCalendarProvider({
        simulatedDelayMs: 50,
        failureMode: "auth",
      });

      provider.seedEvents([
        {
          externalId: "seed-1",
          title: "Seeded",
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          isAllDay: false,
          timezone: "UTC",
          status: "CONFIRMED",
        },
      ]);

      expect(provider.getEvents().length).toBe(1);
      provider.reset();

      expect(provider.getEvents().length).toBe(0);
      expect(provider.simulatedDelayMs).toBe(0);
      expect(provider.failureMode).toBe("none");
      expect(provider.recordedCalls.length).toBe(0);
    });
  });

  describe("CalendarProviderRegistry", () => {
    let registry: CalendarProviderRegistry;

    beforeEach(() => {
      registry = new CalendarProviderRegistry();
    });

    it("registers and retrieves a provider instance", () => {
      const provider: CalendarProvider = new MockCalendarProvider({ id: "cal-1" });
      registry.register(provider);

      expect(registry.has("cal-1")).toBe(true);
      expect(registry.get("cal-1")).toBe(provider);
      expect(registry.getOrThrow("cal-1")).toBe(provider);
    });

    it("throws CalendarProviderNotFoundError when getOrThrow fails", () => {
      expect(() => registry.getOrThrow("missing")).toThrow(CalendarProviderNotFoundError);
    });

    it("lists all registered providers", () => {
      registry.register(new MockCalendarProvider({ id: "cal-1" }));
      registry.register(new MockCalendarProvider({ id: "cal-2" }));

      const list = registry.list();
      expect(list.length).toBe(2);
      expect(list.map((p) => p.id)).toEqual(["cal-1", "cal-2"]);
    });

    it("rejects duplicate registration unless allowOverride is true", () => {
      const p1 = new MockCalendarProvider({ id: "cal-dup", name: "P1" });
      const p2 = new MockCalendarProvider({ id: "cal-dup", name: "P2" });

      registry.register(p1);
      expect(() => registry.register(p2)).toThrow("already registered");

      registry.register(p2, true);
      expect(registry.get("cal-dup")?.name).toBe("P2");
    });

    it("unregisters and clears providers", () => {
      registry.register(new MockCalendarProvider({ id: "cal-1" }));
      registry.register(new MockCalendarProvider({ id: "cal-2" }));

      expect(registry.unregister("cal-1")).toBe(true);
      expect(registry.has("cal-1")).toBe(false);
      expect(registry.has("cal-2")).toBe(true);

      registry.clear();
      expect(registry.list().length).toBe(0);
    });
  });
});
