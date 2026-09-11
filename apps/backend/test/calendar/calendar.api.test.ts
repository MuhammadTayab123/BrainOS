import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarEventStatus } from "@prisma/client";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  create: vi.fn(),
  findByIdForUser: vi.fn(),
  findByDateRange: vi.fn(),
  findUpcoming: vi.fn(),
  updateForUser: vi.fn(),
  deleteForUser: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),

  getAuth: () => ({
    userId: "user-a",
    sessionId: "test-session",
    isAuthenticated: true,
  }),
}));

vi.mock("../../src/services/auth/auth.service", () => ({
  getAuthenticatedUser: fakes.authenticatedUser,
}));

vi.mock(
  "../../src/services/calendar/repositories/calendar.repository",
  () => ({
    PrismaCalendarEventRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      findByIdForUser(id: string, userId: string) {
        return fakes.findByIdForUser(id, userId);
      }

      findByDateRange(options: Record<string, unknown>) {
        return fakes.findByDateRange(options);
      }

      findUpcoming(options: Record<string, unknown>) {
        return fakes.findUpcoming(options);
      }

      updateForUser(
        id: string,
        userId: string,
        data: Record<string, unknown>,
      ) {
        return fakes.updateForUser(id, userId, data);
      }

      deleteForUser(id: string, userId: string) {
        return fakes.deleteForUser(id, userId);
      }
    },
    CalendarEventRepositoryImpl: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      findByIdForUser(id: string, userId: string) {
        return fakes.findByIdForUser(id, userId);
      }

      findByDateRange(options: Record<string, unknown>) {
        return fakes.findByDateRange(options);
      }

      findUpcoming(options: Record<string, unknown>) {
        return fakes.findUpcoming(options);
      }

      updateForUser(
        id: string,
        userId: string,
        data: Record<string, unknown>,
      ) {
        return fakes.updateForUser(id, userId, data);
      }

      deleteForUser(id: string, userId: string) {
        return fakes.deleteForUser(id, userId);
      }
    },
  }),
);

import app from "../../src/app";
import { NotFoundError } from "../../src/errors";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
  firstName: null,
  lastName: null,
  imageUrl: null,
};

const mockEvent = {
  id: "evt-1",
  userId: "user-a",
  title: "Sprint Planning",
  description: "Bi-weekly sprint planning",
  location: "Room 101",
  startTime: new Date("2026-10-01T10:00:00.000Z"),
  endTime: new Date("2026-10-01T11:00:00.000Z"),
  isAllDay: false,
  timezone: "UTC",
  status: CalendarEventStatus.CONFIRMED,
  recurrenceRule: null,
  metadata: null,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

describe("Calendar REST API (Mission 88)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.authenticatedUser.mockResolvedValue(userA);
  });

  describe("Authentication Requirements", () => {
    it("returns 401 on POST /api/v1/calendar/events when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/v1/calendar/events")
        .send({
          title: "Test Event",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 on GET /api/v1/calendar/events when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/calendar/events");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("returns 401 on GET /api/v1/calendar/events/:id when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/calendar/events/evt-1");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("returns 401 on PATCH /api/v1/calendar/events/:id when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/calendar/events/evt-1")
        .send({ title: "Updated" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("returns 401 on DELETE /api/v1/calendar/events/:id when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const res = await request(app).delete("/api/v1/calendar/events/evt-1");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/calendar/events", () => {
    it("creates a calendar event with server-derived userId", async () => {
      fakes.create.mockResolvedValue(mockEvent);

      const res = await request(app)
        .post("/api/v1/calendar/events")
        .send({
          userId: "ATTACKER_ID", // Untrusted, must be ignored
          title: "Sprint Planning",
          description: "Bi-weekly sprint planning",
          location: "Room 101",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
          timezone: "UTC",
          status: "CONFIRMED",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("evt-1");

      expect(fakes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-a", // Strictly user-a from auth
          title: "Sprint Planning",
          location: "Room 101",
        }),
      );
    });

    it("rejects request when title is missing or empty", async () => {
      const res = await request(app)
        .post("/api/v1/calendar/events")
        .send({
          title: "   ",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(fakes.create).not.toHaveBeenCalled();
    });

    it("rejects request when startTime is after endTime", async () => {
      const res = await request(app)
        .post("/api/v1/calendar/events")
        .send({
          title: "Reversed Event",
          startTime: "2026-10-01T12:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(fakes.create).not.toHaveBeenCalled();
    });

    it("rejects request with invalid IANA timezone", async () => {
      const res = await request(app)
        .post("/api/v1/calendar/events")
        .send({
          title: "Bad TZ Event",
          startTime: "2026-10-01T10:00:00.000Z",
          endTime: "2026-10-01T11:00:00.000Z",
          timezone: "Invalid/Fake_Zone",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(fakes.create).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/calendar/events", () => {
    it("lists events with date range query parameters", async () => {
      fakes.findByDateRange.mockResolvedValue([mockEvent]);

      const res = await request(app)
        .get("/api/v1/calendar/events")
        .query({
          rangeStart: "2026-10-01T00:00:00.000Z",
          rangeEnd: "2026-10-02T00:00:00.000Z",
          status: "CONFIRMED",
          limit: "20",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([
        expect.objectContaining({
          id: "evt-1",
        }),
      ]);

      expect(fakes.findByDateRange).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-a",
          status: "CONFIRMED",
          limit: 20,
        }),
      );
    });

    it("rejects inverted date ranges (rangeStart >= rangeEnd)", async () => {
      const res = await request(app)
        .get("/api/v1/calendar/events")
        .query({
          rangeStart: "2026-10-02T00:00:00.000Z",
          rangeEnd: "2026-10-01T00:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(fakes.findByDateRange).not.toHaveBeenCalled();
    });

    it("lists upcoming events when rangeStart/rangeEnd are not provided", async () => {
      fakes.findUpcoming.mockResolvedValue([mockEvent]);

      const res = await request(app)
        .get("/api/v1/calendar/events")
        .query({
          limit: "10",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(fakes.findUpcoming).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-a",
          limit: 10,
        }),
      );
    });
  });

  describe("GET /api/v1/calendar/events/:id", () => {
    it("returns the event when found for authenticated user", async () => {
      fakes.findByIdForUser.mockResolvedValue(mockEvent);

      const res = await request(app).get("/api/v1/calendar/events/evt-1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("evt-1");
      expect(fakes.findByIdForUser).toHaveBeenCalledWith("evt-1", "user-a");
    });

    it("returns 404 when event is not found or belongs to another user", async () => {
      fakes.findByIdForUser.mockResolvedValue(null);

      const res = await request(app).get("/api/v1/calendar/events/evt-other");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/calendar/events/:id", () => {
    it("updates event fields for authenticated user", async () => {
      fakes.findByIdForUser.mockResolvedValue(mockEvent);
      fakes.updateForUser.mockResolvedValue({
        ...mockEvent,
        title: "Updated Title",
        location: "New Location",
      });

      const res = await request(app)
        .patch("/api/v1/calendar/events/evt-1")
        .send({
          title: "Updated Title",
          location: "New Location",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Updated Title");

      expect(fakes.updateForUser).toHaveBeenCalledWith(
        "evt-1",
        "user-a",
        expect.objectContaining({
          title: "Updated Title",
          location: "New Location",
        }),
      );
    });

    it("returns 404 when updating non-existent event", async () => {
      fakes.findByIdForUser.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/v1/calendar/events/evt-unknown")
        .send({
          title: "Updated Title",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(fakes.updateForUser).not.toHaveBeenCalled();
    });

    it("rejects update that inverts existing date interval", async () => {
      fakes.findByIdForUser.mockResolvedValue(mockEvent); // 10:00 to 11:00

      // Attempt to set startTime to 11:30 without changing endTime
      const res = await request(app)
        .patch("/api/v1/calendar/events/evt-1")
        .send({
          startTime: "2026-10-01T11:30:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(fakes.updateForUser).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/v1/calendar/events/:id", () => {
    it("deletes owned event and returns { id }", async () => {
      fakes.deleteForUser.mockResolvedValue(undefined);

      const res = await request(app).delete("/api/v1/calendar/events/evt-1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ id: "evt-1" });
      expect(fakes.deleteForUser).toHaveBeenCalledWith("evt-1", "user-a");
    });

    it("returns 404 when deleting event belonging to another user", async () => {
      fakes.deleteForUser.mockRejectedValue(
        new NotFoundError("Calendar event not found for the authenticated user."),
      );

      const res = await request(app).delete("/api/v1/calendar/events/evt-other");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });
});
