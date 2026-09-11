import { describe, expect, it, vi } from "vitest";

import { NotFoundError, ValidationError } from "../../../src/errors";
import { CalendarService } from "../../../src/services/calendar/calendar.service";
import {
  CalendarEvent,
  CalendarEventRepository,
} from "../../../src/services/calendar/calendar.types";

describe("CalendarService", () => {
  function createService() {
    const repository = {
      create: vi.fn(),
      findByIdForUser: vi.fn(),
      findByDateRange: vi.fn(),
      findUpcoming: vi.fn(),
      updateForUser: vi.fn(),
      deleteForUser: vi.fn(),
    } as unknown as CalendarEventRepository;

    const service = new CalendarService(repository);

    return {
      service,
      repository,
    };
  }

  const mockEvent: CalendarEvent = {
    id: "evt-1",
    userId: "user-1",
    title: "Planning Session",
    description: "Sprint planning",
    location: "Room 101",
    startTime: new Date("2026-10-01T10:00:00.000Z"),
    endTime: new Date("2026-10-01T11:00:00.000Z"),
    isAllDay: false,
    timezone: "UTC",
    status: "CONFIRMED",
    recurrenceRule: null,
    metadata: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };

  describe("create", () => {
    it("creates an event with trimmed fields and defaults", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.create).mockResolvedValue(mockEvent);

      const result = await service.create({
        userId: " user-1 ",
        title: "  Planning Session  ",
        description: "  Sprint planning  ",
        location: "  Room 101  ",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: "user-1",
        title: "Planning Session",
        description: "Sprint planning",
        location: "Room 101",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
        isAllDay: false,
        timezone: "UTC",
        status: "CONFIRMED",
        recurrenceRule: undefined,
        metadata: undefined,
      });

      expect(result).toEqual(mockEvent);
    });

    it("rejects an empty or whitespace title", async () => {
      const { service, repository } = createService();

      await expect(
        service.create({
          userId: "user-1",
          title: "   ",
          startTime: new Date("2026-10-01T10:00:00.000Z"),
          endTime: new Date("2026-10-01T11:00:00.000Z"),
        }),
      ).rejects.toThrow(ValidationError);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a missing or empty user id", async () => {
      const { service, repository } = createService();

      await expect(
        service.create({
          userId: "   ",
          title: "Planning Session",
          startTime: new Date("2026-10-01T10:00:00.000Z"),
          endTime: new Date("2026-10-01T11:00:00.000Z"),
        }),
      ).rejects.toThrow("User ID is required.");

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects when startTime is equal to endTime", async () => {
      const { service, repository } = createService();
      const time = new Date("2026-10-01T10:00:00.000Z");

      await expect(
        service.create({
          userId: "user-1",
          title: "Zero Duration Event",
          startTime: time,
          endTime: time,
        }),
      ).rejects.toThrow("Start time must be before end time.");

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects when startTime is after endTime", async () => {
      const { service, repository } = createService();

      await expect(
        service.create({
          userId: "user-1",
          title: "Reversed Times",
          startTime: new Date("2026-10-01T12:00:00.000Z"),
          endTime: new Date("2026-10-01T11:00:00.000Z"),
        }),
      ).rejects.toThrow("Start time must be before end time.");

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid IANA timezone", async () => {
      const { service, repository } = createService();

      await expect(
        service.create({
          userId: "user-1",
          title: "Invalid TZ Event",
          startTime: new Date("2026-10-01T10:00:00.000Z"),
          endTime: new Date("2026-10-01T11:00:00.000Z"),
          timezone: "Mars/Olympus_Mons",
        }),
      ).rejects.toThrow("Invalid IANA timezone.");

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("accepts a valid custom IANA timezone", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.create).mockResolvedValue({
        ...mockEvent,
        timezone: "Asia/Tokyo",
      });

      await service.create({
        userId: "user-1",
        title: "Tokyo Meeting",
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T11:00:00.000Z"),
        timezone: "Asia/Tokyo",
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timezone: "Asia/Tokyo",
        }),
      );
    });
  });

  describe("get", () => {
    it("returns the event when found for user", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);

      const result = await service.get("evt-1", "user-1");

      expect(repository.findByIdForUser).toHaveBeenCalledWith("evt-1", "user-1");
      expect(result).toEqual(mockEvent);
    });

    it("throws NotFoundError when event is not found", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(null);

      await expect(service.get("evt-unknown", "user-1")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError when event belongs to another user (tenant isolation)", async () => {
      const { service, repository } = createService();

      // Repository findByIdForUser with user-2 returns null because owner is user-1
      vi.mocked(repository.findByIdForUser).mockResolvedValue(null);

      await expect(service.get("evt-1", "user-2")).rejects.toThrow(
        NotFoundError,
      );
      expect(repository.findByIdForUser).toHaveBeenCalledWith("evt-1", "user-2");
    });
  });

  describe("list", () => {
    it("delegates to findByDateRange when rangeStart and rangeEnd are provided", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByDateRange).mockResolvedValue([mockEvent]);

      const rangeStart = new Date("2026-10-01T00:00:00.000Z");
      const rangeEnd = new Date("2026-10-02T00:00:00.000Z");

      const results = await service.list({
        userId: "user-1",
        rangeStart,
        rangeEnd,
        status: "CONFIRMED",
      });

      expect(repository.findByDateRange).toHaveBeenCalledWith({
        userId: "user-1",
        rangeStart,
        rangeEnd,
        status: "CONFIRMED",
        limit: undefined,
      });
      expect(results).toEqual([mockEvent]);
    });

    it("rejects when rangeStart >= rangeEnd", async () => {
      const { service } = createService();

      await expect(
        service.list({
          userId: "user-1",
          rangeStart: new Date("2026-10-02T00:00:00.000Z"),
          rangeEnd: new Date("2026-10-01T00:00:00.000Z"),
        }),
      ).rejects.toThrow("Range start must be before range end.");
    });

    it("rejects when only one of rangeStart/rangeEnd is provided", async () => {
      const { service } = createService();

      await expect(
        service.list({
          userId: "user-1",
          rangeStart: new Date("2026-10-01T00:00:00.000Z"),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("delegates to findUpcoming when no date range is provided", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findUpcoming).mockResolvedValue([mockEvent]);

      const results = await service.list({
        userId: "user-1",
      });

      expect(repository.findUpcoming).toHaveBeenCalledWith({
        userId: "user-1",
        from: expect.any(Date),
        status: undefined,
        limit: undefined,
      });
      expect(results).toEqual([mockEvent]);
    });
  });

  describe("update", () => {
    it("updates title and location of an owned event", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);
      vi.mocked(repository.updateForUser).mockResolvedValue({
        ...mockEvent,
        title: "Updated Title",
        location: "Room 202",
      });

      const updated = await service.update("evt-1", "user-1", {
        title: "  Updated Title  ",
        location: "  Room 202  ",
      });

      expect(repository.updateForUser).toHaveBeenCalledWith(
        "evt-1",
        "user-1",
        expect.objectContaining({
          title: "Updated Title",
          location: "Room 202",
        }),
      );
      expect(updated.title).toBe("Updated Title");
    });

    it("throws NotFoundError if the event does not exist for the user", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(null);

      await expect(
        service.update("evt-other", "user-1", {
          title: "Hacked Title",
        }),
      ).rejects.toThrow(NotFoundError);

      expect(repository.updateForUser).not.toHaveBeenCalled();
    });

    it("validates FINAL effective pair when only startTime is updated", async () => {
      const { service, repository } = createService();

      // existing: 10:00 to 11:00
      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);

      // Attempt to move startTime to 11:30 (after existing endTime of 11:00)
      await expect(
        service.update("evt-1", "user-1", {
          startTime: new Date("2026-10-01T11:30:00.000Z"),
        }),
      ).rejects.toThrow("Start time must be before end time.");

      expect(repository.updateForUser).not.toHaveBeenCalled();
    });

    it("validates FINAL effective pair when only endTime is updated", async () => {
      const { service, repository } = createService();

      // existing: 10:00 to 11:00
      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);

      // Attempt to move endTime to 09:30 (before existing startTime of 10:00)
      await expect(
        service.update("evt-1", "user-1", {
          endTime: new Date("2026-10-01T09:30:00.000Z"),
        }),
      ).rejects.toThrow("Start time must be before end time.");

      expect(repository.updateForUser).not.toHaveBeenCalled();
    });

    it("succeeds when updating startTime within valid range", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);
      vi.mocked(repository.updateForUser).mockResolvedValue({
        ...mockEvent,
        startTime: new Date("2026-10-01T10:30:00.000Z"),
      });

      const result = await service.update("evt-1", "user-1", {
        startTime: new Date("2026-10-01T10:30:00.000Z"),
      });

      expect(repository.updateForUser).toHaveBeenCalledWith(
        "evt-1",
        "user-1",
        expect.objectContaining({
          startTime: new Date("2026-10-01T10:30:00.000Z"),
        }),
      );
      expect(result.startTime).toEqual(new Date("2026-10-01T10:30:00.000Z"));
    });

    it("rejects invalid timezone update", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);

      await expect(
        service.update("evt-1", "user-1", {
          timezone: "Invalid/Timezone",
        }),
      ).rejects.toThrow("Invalid IANA timezone.");

      expect(repository.updateForUser).not.toHaveBeenCalled();
    });

    it("updates status between CONFIRMED, TENTATIVE, and CANCELLED", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.findByIdForUser).mockResolvedValue(mockEvent);
      vi.mocked(repository.updateForUser).mockResolvedValue({
        ...mockEvent,
        status: "CANCELLED",
      });

      const updated = await service.update("evt-1", "user-1", {
        status: "CANCELLED",
      });

      expect(repository.updateForUser).toHaveBeenCalledWith(
        "evt-1",
        "user-1",
        expect.objectContaining({
          status: "CANCELLED",
        }),
      );
      expect(updated.status).toBe("CANCELLED");
    });
  });

  describe("delete", () => {
    it("deletes an owned event", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.deleteForUser).mockResolvedValue(undefined);

      await service.delete("evt-1", "user-1");

      expect(repository.deleteForUser).toHaveBeenCalledWith("evt-1", "user-1");
    });

    it("propagates NotFoundError if event does not belong to user", async () => {
      const { service, repository } = createService();

      vi.mocked(repository.deleteForUser).mockRejectedValue(
        new NotFoundError("Calendar event not found for the authenticated user."),
      );

      await expect(service.delete("evt-1", "user-2")).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
