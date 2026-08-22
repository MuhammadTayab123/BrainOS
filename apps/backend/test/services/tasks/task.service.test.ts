import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../src/errors";
import { TaskRepository } from "../../../src/services/tasks/repositories/task.repository";
import { TaskService } from "../../../src/services/tasks/task.service";

describe("TaskService", () => {
  function createService() {
    const repository = {
      create: vi.fn(),
      listByUser: vi.fn(),
      findByIdForUser: vi.fn(),
      updateByIdForUser: vi.fn(),
      completeByIdForUser: vi.fn(),
      softDeleteByIdForUser: vi.fn(),
    } as unknown as TaskRepository;

    const service = new TaskService(repository);

    return {
      service,
      repository,
    };
  }

  describe("createTask", () => {
    it("creates a task with trimmed title", async () => {
      const { service, repository } =
        createService();

      repository.create = vi.fn().mockResolvedValue({
        id: "task-1",
        title: "Finish BrainOS",
      });

      const result = await service.createTask({
        userId: "user-1",
        title: "  Finish BrainOS  ",
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: "user-1",
        title: "Finish BrainOS",
        description: undefined,
        priority: undefined,
        dueAt: undefined,
      });

      expect(result).toEqual({
        id: "task-1",
        title: "Finish BrainOS",
      });
    });

    it("rejects an empty title", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.createTask({
          userId: "user-1",
          title: "   ",
        }),
      ).rejects.toThrow(
        "Task title is required.",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a missing user id", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.createTask({
          userId: "   ",
          title: "Test task",
        }),
      ).rejects.toThrow(
        "User ID is required.",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("listTasks", () => {
    it("uses the default limit", async () => {
      const { service, repository } =
        createService();

      repository.listByUser = vi
        .fn()
        .mockResolvedValue([]);

      await service.listTasks({
        userId: "user-1",
      });

      expect(
        repository.listByUser,
      ).toHaveBeenCalledWith({
        userId: "user-1",
        limit: 50,
      });
    });

    it("rejects a limit above the maximum", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.listTasks({
          userId: "user-1",
          limit: 51,
        }),
      ).rejects.toThrow(
        "Task list limit must be an integer between 1 and 50.",
      );

      expect(
        repository.listByUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe("getTask", () => {
    it("returns an owned task", async () => {
      const { service, repository } =
        createService();

      const task = {
        id: "task-1",
        userId: "user-1",
        title: "BrainOS task",
      };

      repository.findByIdForUser = vi
        .fn()
        .mockResolvedValue(task);

      const result = await service.getTask(
        "task-1",
        "user-1",
      );

      expect(
        repository.findByIdForUser,
      ).toHaveBeenCalledWith(
        "task-1",
        "user-1",
      );

      expect(result).toEqual(task);
    });

    it("throws when the task does not exist", async () => {
      const { service, repository } =
        createService();

      repository.findByIdForUser = vi
        .fn()
        .mockResolvedValue(null);

      await expect(
        service.getTask(
          "missing-task",
          "user-1",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("updateTask", () => {
    it("trims updated title and description", async () => {
      const { service, repository } =
        createService();

      repository.updateByIdForUser = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.updateTask(
        "task-1",
        "user-1",
        {
          title: "  Updated task  ",
          description: "  Updated description  ",
        },
      );

      expect(
        repository.updateByIdForUser,
      ).toHaveBeenCalledWith(
        "task-1",
        "user-1",
        {
          title: "Updated task",
          description: "Updated description",
        },
      );
    });
  });

  describe("completeTask", () => {
    it("delegates completion to the repository", async () => {
      const { service, repository } =
        createService();

      repository.completeByIdForUser = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.completeTask(
        "task-1",
        "user-1",
      );

      expect(
        repository.completeByIdForUser,
      ).toHaveBeenCalledWith(
        "task-1",
        "user-1",
      );
    });
  });

  describe("deleteTask", () => {
    it("delegates soft deletion to the repository", async () => {
      const { service, repository } =
        createService();

      repository.softDeleteByIdForUser = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.deleteTask(
        "task-1",
        "user-1",
      );

      expect(
        repository.softDeleteByIdForUser,
      ).toHaveBeenCalledWith(
        "task-1",
        "user-1",
      );
    });
  });
});