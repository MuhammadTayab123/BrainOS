import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskPriority, TaskStatus } from "@prisma/client";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  create: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  updateByIdForUser: vi.fn(),
  completeByIdForUser: vi.fn(),
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
  "../../src/services/tasks/repositories/task.repository",
  () => ({
    TaskRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      listByUser(options: Record<string, unknown>) {
        return fakes.listByUser(options);
      }

      findByIdForUser(taskId: string, userId: string) {
        return fakes.findByIdForUser(taskId, userId);
      }

      updateByIdForUser(
        taskId: string,
        userId: string,
        data: Record<string, unknown>,
      ) {
        return fakes.updateByIdForUser(taskId, userId, data);
      }

      completeByIdForUser(taskId: string, userId: string) {
        return fakes.completeByIdForUser(taskId, userId);
      }

      softDeleteByIdForUser(taskId: string, userId: string) {
        return fakes.softDeleteByIdForUser(taskId, userId);
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

const mockTask = {
  id: "task-1",
  userId: "user-a",
  title: "Test task",
  description: "Test description",
  status: TaskStatus.TODO,
  priority: TaskPriority.MEDIUM,
  dueAt: new Date("2026-09-10T12:00:00.000Z"),
  createdAt: new Date("2026-09-04T10:00:00.000Z"),
  updatedAt: new Date("2026-09-04T10:00:00.000Z"),
  deletedAt: null,
};

describe("Tasks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakes.authenticatedUser.mockResolvedValue(userA);
  });

  describe("POST /api/v1/tasks", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app)
        .post("/api/v1/tasks")
        .send({ title: "New task" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    });

    it("rejects missing title", async () => {
      const response = await request(app)
        .post("/api/v1/tasks")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_TITLE",
          message: "Task title is required.",
        },
      });
    });

    it("rejects non-string description", async () => {
      const response = await request(app)
        .post("/api/v1/tasks")
        .send({ title: "Task", description: 123 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_DESCRIPTION",
          message: "Task description must be a string.",
        },
      });
    });

    it("rejects invalid priority", async () => {
      const response = await request(app)
        .post("/api/v1/tasks")
        .send({ title: "Task", priority: "SUPER_URGENT" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_PRIORITY",
          message: "Invalid task priority.",
        },
      });
    });

    it("rejects invalid due date", async () => {
      const response = await request(app)
        .post("/api/v1/tasks")
        .send({ title: "Task", dueAt: "not-a-date" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_DUE_DATE",
          message: "Task due date must be a valid date.",
        },
      });
    });

    it("creates a task successfully", async () => {
      fakes.create.mockResolvedValue(mockTask);

      const response = await request(app)
        .post("/api/v1/tasks")
        .send({
          title: "  Test task  ",
          description: "  Test description  ",
          priority: "MEDIUM",
          dueAt: "2026-09-10T12:00:00.000Z",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "Test task",
        description: "Test description",
        priority: TaskPriority.MEDIUM,
        dueAt: new Date("2026-09-10T12:00:00.000Z"),
      });
    });
  });

  describe("GET /api/v1/tasks", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/tasks");

      expect(response.status).toBe(401);
    });

    it("lists tasks for the authenticated user", async () => {
      fakes.listByUser.mockResolvedValue([mockTask]);

      const response = await request(app).get("/api/v1/tasks");

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
      fakes.listByUser.mockResolvedValue([mockTask]);

      const response = await request(app).get(
        "/api/v1/tasks?status=TODO&priority=HIGH&limit=10&dueBefore=2026-09-15T00:00:00.000Z&dueAfter=2026-09-01T00:00:00.000Z",
      );

      expect(response.status).toBe(200);
      expect(fakes.listByUser).toHaveBeenCalledWith({
        userId: "user-a",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        limit: 10,
        dueBefore: new Date("2026-09-15T00:00:00.000Z"),
        dueAfter: new Date("2026-09-01T00:00:00.000Z"),
      });
    });

    it("rejects invalid limit", async () => {
      const response = await request(app).get("/api/v1/tasks?limit=0");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_LIMIT");
    });

    it("rejects invalid status", async () => {
      const response = await request(app).get("/api/v1/tasks?status=UNKNOWN");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_STATUS");
    });

    it("rejects invalid priority", async () => {
      const response = await request(app).get("/api/v1/tasks?priority=UNKNOWN");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PRIORITY");
    });

    it("rejects invalid dueBefore date", async () => {
      const response = await request(app).get("/api/v1/tasks?dueBefore=bad-date");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_DUE_BEFORE");
    });

    it("rejects invalid dueAfter date", async () => {
      const response = await request(app).get("/api/v1/tasks?dueAfter=bad-date");

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_DUE_AFTER");
    });
  });

  describe("GET /api/v1/tasks/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/tasks/task-1");

      expect(response.status).toBe(401);
    });

    it("returns 404 when task is not found", async () => {
      fakes.findByIdForUser.mockResolvedValue(null);

      const response = await request(app).get("/api/v1/tasks/task-1");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("returns task by id", async () => {
      fakes.findByIdForUser.mockResolvedValue(mockTask);

      const response = await request(app).get("/api/v1/tasks/task-1");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(fakes.findByIdForUser).toHaveBeenCalledWith("task-1", "user-a");
    });
  });

  describe("PATCH /api/v1/tasks/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app)
        .patch("/api/v1/tasks/task-1")
        .send({ title: "Updated" });

      expect(response.status).toBe(401);
    });

    it("rejects empty title string", async () => {
      const response = await request(app)
        .patch("/api/v1/tasks/task-1")
        .send({ title: "   " });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_TITLE");
    });

    it("rejects invalid priority", async () => {
      const response = await request(app)
        .patch("/api/v1/tasks/task-1")
        .send({ priority: "INVALID" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_PRIORITY");
    });

    it("rejects invalid due date", async () => {
      const response = await request(app)
        .patch("/api/v1/tasks/task-1")
        .send({ dueAt: "invalid-date" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_DUE_DATE");
    });

    it("returns 404 when updating non-existent task", async () => {
      fakes.updateByIdForUser.mockRejectedValue(
        new NotFoundError("Task not found for the authenticated user."),
      );

      const response = await request(app)
        .patch("/api/v1/tasks/non-existent")
        .send({ title: "Updated title" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("updates task successfully", async () => {
      fakes.updateByIdForUser.mockResolvedValue(undefined);

      const response = await request(app)
        .patch("/api/v1/tasks/task-1")
        .send({
          title: "Updated title",
          description: null,
          priority: "HIGH",
          dueAt: null,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "task-1",
        },
      });
      expect(fakes.updateByIdForUser).toHaveBeenCalledWith(
        "task-1",
        "user-a",
        {
          title: "Updated title",
          description: null,
          priority: TaskPriority.HIGH,
          dueAt: null,
        },
      );
    });
  });

  describe("POST /api/v1/tasks/:id/complete", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).post("/api/v1/tasks/task-1/complete");

      expect(response.status).toBe(401);
    });

    it("returns 404 when completing non-existent task", async () => {
      fakes.completeByIdForUser.mockRejectedValue(
        new NotFoundError("Task not found for the authenticated user."),
      );

      const response = await request(app).post("/api/v1/tasks/task-1/complete");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("completes task successfully", async () => {
      fakes.completeByIdForUser.mockResolvedValue(undefined);

      const response = await request(app).post("/api/v1/tasks/task-1/complete");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "task-1",
          status: "COMPLETED",
        },
      });
      expect(fakes.completeByIdForUser).toHaveBeenCalledWith(
        "task-1",
        "user-a",
      );
    });
  });

  describe("DELETE /api/v1/tasks/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      fakes.authenticatedUser.mockResolvedValue(null);

      const response = await request(app).delete("/api/v1/tasks/task-1");

      expect(response.status).toBe(401);
    });

    it("returns 404 when deleting non-existent task", async () => {
      fakes.softDeleteByIdForUser.mockRejectedValue(
        new NotFoundError("Task not found for the authenticated user."),
      );

      const response = await request(app).delete("/api/v1/tasks/task-1");

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });

    it("deletes task successfully", async () => {
      fakes.softDeleteByIdForUser.mockResolvedValue(undefined);

      const response = await request(app).delete("/api/v1/tasks/task-1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: "task-1",
        },
      });
      expect(fakes.softDeleteByIdForUser).toHaveBeenCalledWith(
        "task-1",
        "user-a",
      );
    });
  });
});
