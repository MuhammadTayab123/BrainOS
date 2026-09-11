import { describe, expect, it } from "vitest";

import {
  calendarEventIdParamSchema,
  calendarEventStatusSchema,
  createCalendarEventBodySchema,
  listCalendarEventsQuerySchema,
  updateCalendarEventBodySchema,
} from "../../src/validators/calendar.validator";

describe("Calendar Validators", () => {
  describe("createCalendarEventBodySchema", () => {
    it("accepts valid calendar event input", () => {
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

      const parsed = createCalendarEventBodySchema.parse({
        title: "Team Sync",
        startTime: now.toISOString(),
        endTime: inOneHour.toISOString(),
        location: "Meeting Room A",
        timezone: "America/New_York",
        status: "CONFIRMED",
      });

      expect(parsed.title).toBe("Team Sync");
      expect(parsed.isAllDay).toBe(false);
      expect(parsed.timezone).toBe("America/New_York");
      expect(parsed.status).toBe("CONFIRMED");
    });

    it("applies default timezone and status", () => {
      const start = new Date("2026-10-01T10:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      const parsed = createCalendarEventBodySchema.parse({
        title: "Default Test",
        startTime: start,
        endTime: end,
      });

      expect(parsed.timezone).toBe("UTC");
      expect(parsed.status).toBe("CONFIRMED");
      expect(parsed.isAllDay).toBe(false);
    });

    it("rejects empty title", () => {
      const start = new Date("2026-10-01T10:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      const result = createCalendarEventBodySchema.safeParse({
        title: "   ",
        startTime: start,
        endTime: end,
      });

      expect(result.success).toBe(false);
    });

    it("rejects when startTime is after endTime", () => {
      const start = new Date("2026-10-01T12:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      const result = createCalendarEventBodySchema.safeParse({
        title: "Invalid Dates",
        startTime: start,
        endTime: end,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Start time must be before end time",
        );
      }
    });

    it("rejects when startTime equals endTime", () => {
      const time = new Date("2026-10-01T12:00:00Z");

      const result = createCalendarEventBodySchema.safeParse({
        title: "Zero Duration",
        startTime: time,
        endTime: time,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Start time must be before end time",
        );
      }
    });

    it("rejects invalid IANA timezone", () => {
      const start = new Date("2026-10-01T10:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      const result = createCalendarEventBodySchema.safeParse({
        title: "Invalid TZ",
        startTime: start,
        endTime: end,
        timezone: "Invalid/Fake_Zone",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Invalid IANA timezone");
      }
    });

    it("accepts valid IANA timezones", () => {
      const start = new Date("2026-10-01T10:00:00Z");
      const end = new Date("2026-10-01T11:00:00Z");

      const timezones = [
        "UTC",
        "America/Los_Angeles",
        "Europe/London",
        "Asia/Karachi",
        "Asia/Tokyo",
      ];

      for (const tz of timezones) {
        const result = createCalendarEventBodySchema.safeParse({
          title: "TZ Test",
          startTime: start,
          endTime: end,
          timezone: tz,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("updateCalendarEventBodySchema", () => {
    it("accepts valid partial update", () => {
      const parsed = updateCalendarEventBodySchema.parse({
        title: "Updated Title",
        status: "TENTATIVE",
      });

      expect(parsed.title).toBe("Updated Title");
      expect(parsed.status).toBe("TENTATIVE");
    });

    it("rejects empty title when provided", () => {
      const result = updateCalendarEventBodySchema.safeParse({
        title: "   ",
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid date order when both dates are provided", () => {
      const result = updateCalendarEventBodySchema.safeParse({
        startTime: new Date("2026-10-01T15:00:00Z"),
        endTime: new Date("2026-10-01T14:00:00Z"),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Start time must be before end time",
        );
      }
    });

    it("accepts single date update in schema (final effective pair checked by service)", () => {
      const result = updateCalendarEventBodySchema.safeParse({
        startTime: new Date("2026-10-01T15:00:00Z"),
      });

      expect(result.success).toBe(true);
    });

    it("rejects invalid timezone in update", () => {
      const result = updateCalendarEventBodySchema.safeParse({
        timezone: "Not/Valid",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("listCalendarEventsQuerySchema", () => {
    it("accepts valid date range query", () => {
      const result = listCalendarEventsQuerySchema.safeParse({
        rangeStart: "2026-10-01T00:00:00Z",
        rangeEnd: "2026-10-02T00:00:00Z",
        status: "CONFIRMED",
        limit: "25",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.status).toBe("CONFIRMED");
      }
    });

    it("rejects rangeStart >= rangeEnd", () => {
      const result = listCalendarEventsQuerySchema.safeParse({
        rangeStart: "2026-10-02T00:00:00Z",
        rangeEnd: "2026-10-01T00:00:00Z",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("calendarEventStatusSchema", () => {
    it("accepts CONFIRMED, TENTATIVE, and CANCELLED", () => {
      expect(calendarEventStatusSchema.safeParse("CONFIRMED").success).toBe(true);
      expect(calendarEventStatusSchema.safeParse("TENTATIVE").success).toBe(true);
      expect(calendarEventStatusSchema.safeParse("CANCELLED").success).toBe(true);
      expect(calendarEventStatusSchema.safeParse("UNKNOWN").success).toBe(false);
    });
  });

  describe("calendarEventIdParamSchema", () => {
    it("validates id param", () => {
      expect(calendarEventIdParamSchema.safeParse({ id: "evt-123" }).success).toBe(
        true,
      );
      expect(calendarEventIdParamSchema.safeParse({ id: "" }).success).toBe(
        false,
      );
      expect(calendarEventIdParamSchema.safeParse({ id: "   " }).success).toBe(
        false,
      );
    });
  });
});
