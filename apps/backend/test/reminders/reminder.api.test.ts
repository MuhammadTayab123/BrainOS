import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderStatus } from "@prisma/client";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  create: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  cancel: vi.fn(),
  softDeleteByIdForUser: vi.fn(),
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
  "../../src/services/reminders/repositories/reminder.repository",
  () => ({
    ReminderRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      listByUser(options: Record<string, unknown>) {
        return fakes.listByUser(options);
      }

      findByIdForUser(reminderId: string, userId: string) {
        return fakes.findByIdForUser(reminderId, userId);
      }

      cancel(reminderId: string, userId: string) {
        return fakes.cancel(reminderId, userId);
      }

      softDeleteByIdForUser(reminderId: string, userId: string) {
        return fakes.softDeleteByIdForUser(reminderId, userId);
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

const mockReminder = {
  id: "reminder-1",
  userId: "user-a",
  taskId: "task-1",
  message: "Test reminder",
  scheduledFor: new Date("2026-09-10T12:00:00.000Z"),
  status: ReminderStatus.PENDING,
  attempts: 0,
  deliveredAt: null,
  lastError: null,
  createdAt: new Date("2026-09-04T10:00:00.000Z"),
  updatedAt: new Date("2026-09-04T10:00:00.000Z"),
  deletedAt: null,
};

describe("Reminders API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.authenticatedUser.mockResolvedValue(userA);
  });

  describe("POST /api/v1/reminders", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/reminders")
        .send({ message: "New reminder", scheduledFor: "2026-09-10T12:00:00.000Z" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    });

    it("rejects non-string message", async () => {
      const response = await request(app)
        .post("/api/v1/reminders")
        .send({ message: 123, scheduledFor: "2026-09-10T12:00:00.000Z" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MESSAGE",
          message: "Reminder message is required.",
        },
      });
    });

    it("rejects missing message", async () => {
      const response = await request(app)
        .post("/api/v1/reminders")
        .send({ scheduledFor: "2026-09-10T12:00:00.000Z" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_MESSAGE",
          message: "Reminder message is required.",
        },
      });
    });

    it("rejects empty message string", async () => {
      const response = await request(app)
        .post("/api/v1/reminders")
        .send({ message: "   ", scheduledFor: "2026-09-10T12:00:00.000Z" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_MESSAGE");
    });

    it("rejects missing scheduledFor", async () => {
      const response = await request(app)
        .post("/api/v1/reminders")
        .send({ message: "Check email" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_SCHEDULED_FOR",
          message: "Reminder scheduled time is required.",
        },
      });
    });

    it("rejects invalid scheduledFor date", async () => {
      const response = await request(app)
        .post("/api/v1/reminders")
        .send({ message: "Check email", scheduledFor: "invalid-date" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_SCHEDULED_FOR",
          message: "Reminder scheduled time must be a valid date.",
        },
      });
    });

    it("rejects invalid taskId", async () => {
      const response = await request(app)
        .post("/api/v1/reminders")
        .send({
          message: "Check email",
          scheduledFor: "2026-09-10T12:00:00.000Z",
          taskId: "   ",
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_TASK_ID",
          message: "Task ID must be a non-empty string.",
        },
      });
    });

    it("creates a reminder successfully and ignores client-provided userId", async () => {
      fakes.create.mockResolvedValue(mockReminder);

      const response = await request(app)
        .post("/api/v1/reminders")
        .send({
          userId: "malicious-user-id",
          message: "  Test reminder  ",
          scheduledFor: "2026-09-10T12:00:00.000Z",
          taskId: "  task-1  ",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        message: "Test reminder",
        scheduledFor: new Date("2026-09-10T12:00:00.000Z"),
        taskId: "task-1",
      });
    });
  });

  describe("GET /api/v1/reminders", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/reminders");

      expect(response.status).toBe(401);
    });

    it("lists reminders for the authenticated user", async () => {
      fakes.listByUser.mockResolvedValue([mockReminder]);

      const response = await request(app).get("/api/v1/reminders");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(fakes.listByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-a",
          limit: 50,
        }),
      );
    });

    it("validates and applies query filters", async () => {
      fakes.listByUser.mockResolvedValue([mockReminder]);

      const response = await request(app).get(
        "/api/v1/reminders?status=PENDING&limit=10&dueBefore=2026-09-15T00:00:00.000Z",
      );

      expect(response.status).toBe(200);
      expect(fakes.listByUser).toHaveBeenCalledWith({
        userId: "user-a",
        status: ReminderStatus.PENDING,
        limit: 10,
        dueBefore: new Date("2026-09-15T00:00:00.000Z"),
      });
    });

    it("rejects invalid limit", async () => {
      const response = await request(app).get("/api/v1/reminders?limit=0");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_LIMIT");
    });

    it("rejects invalid status", async () => {
      const response = await request(app).get("/api/v1/reminders?status=UNKNOWN");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_STATUS");
    });

    it("rejects invalid dueBefore date", async () => {
      const response = await request(app).get("/api/v1/reminders?dueBefore=bad-date");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_DUE_BEFORE");
    });
  });

  describe("GET /api/v1/reminders/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/reminders/reminder-1");

      expect(response.status).toBe(401);
    });

    it("returns 404 when reminder is not found", async () => {
      fakes.findByIdForUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/reminders/reminder-1");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns reminder by id", async () => {
      fakes.findByIdForUser.mockResolvedValue(mockReminder);

      const response = await request(app).get("/api/v1/reminders/reminder-1");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(fakes.findByIdForUser).toHaveBeenCalledWith("reminder-1", "user-a");
    });
  });

  describe("POST /api/v1/reminders/:id/cancel", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).post("/api/v1/reminders/reminder-1/cancel");

      expect(response.status).toBe(401);
    });

    it("returns 404 when cancelling non-existent reminder", async () => {
      fakes.cancel.mockRejectedValue(
        new NotFoundError("Active reminder not found for the authenticated user."),
      );

      const response = await request(app).post("/api/v1/reminders/reminder-1/cancel");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("cancels reminder successfully", async () => {
      fakes.cancel.mockResolvedValue(undefined);

      const response = await request(app).post("/api/v1/reminders/reminder-1/cancel");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "reminder-1",
          status: "CANCELLED",
        },
      });
      expect(fakes.cancel).toHaveBeenCalledWith("reminder-1", "user-a");
    });
  });

  describe("DELETE /api/v1/reminders/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).delete("/api/v1/reminders/reminder-1");

      expect(response.status).toBe(401);
    });

    it("returns 404 when deleting non-existent reminder", async () => {
      fakes.softDeleteByIdForUser.mockRejectedValue(
        new NotFoundError("Reminder not found for the authenticated user."),
      );

      const response = await request(app).delete("/api/v1/reminders/reminder-1");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("deletes reminder successfully", async () => {
      fakes.softDeleteByIdForUser.mockResolvedValue(undefined);

      const response = await request(app).delete("/api/v1/reminders/reminder-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "reminder-1",
        },
      });
      expect(fakes.softDeleteByIdForUser).toHaveBeenCalledWith("reminder-1", "user-a");
    });
  });
});
