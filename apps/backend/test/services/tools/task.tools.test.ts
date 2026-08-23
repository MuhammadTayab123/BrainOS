import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  listTasks: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock(
  "../../../src/services/tasks/task.service",
  () => ({
    TaskService: class {
      createTask = mocks.createTask;
      listTasks = mocks.listTasks;
      getTask = mocks.getTask;
      updateTask = mocks.updateTask;
      completeTask = mocks.completeTask;
      deleteTask = mocks.deleteTask;
    },
  }),
);

vi.mock(
  "../../../src/services/tasks/repositories/task.repository",
  () => ({
    TaskRepository: class {},
  }),
);

import {
  createTaskTool,
  listTasksTool,
  getTaskTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
} from "../../../src/services/tools/task.tools";

describe("Task tools", () => {
  const context = {
    userId: "user_a",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create_task", () => {
    it("creates a task using the authenticated user", async () => {
      const createdTask = {
        id: "task_1",
        userId: "user_a",
        title: "Finish BrainOS",
        description: "Complete Phase 19",
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
      };

      mocks.createTask.mockResolvedValue(
        createdTask,
      );

      const result =
        await createTaskTool.execute(
          {
            title: "Finish BrainOS",
            description: "Complete Phase 19",
            priority: "HIGH",
          },
          context,
        );

      expect(
        mocks.createTask,
      ).toHaveBeenCalledWith({
        userId: "user_a",
        title: "Finish BrainOS",
        description: "Complete Phase 19",
        priority: TaskPriority.HIGH,
        dueAt: undefined,
      });

      expect(result).toEqual(createdTask);
    });

    it("does not allow the input to choose the task owner", async () => {
      mocks.createTask.mockResolvedValue({
        id: "task_1",
      });

      await createTaskTool.execute(
        {
          title: "Protected task",
          userId: "user_b",
        },
        context,
      );

      expect(
        mocks.createTask,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_a",
        }),
      );

      expect(
        mocks.createTask.mock.calls[0][0].userId,
      ).not.toBe("user_b");
    });

    it("rejects a missing title", async () => {
      await expect(
        createTaskTool.execute(
          {},
          context,
        ),
      ).rejects.toThrow(
        "title is required.",
      );

      expect(
        mocks.createTask,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid priority", async () => {
      await expect(
        createTaskTool.execute(
          {
            title: "Invalid priority",
            priority: "URGENT",
          },
          context,
        ),
      ).rejects.toThrow(
        "priority must be one of",
      );

      expect(
        mocks.createTask,
      ).not.toHaveBeenCalled();
    });

    it("rejects invalid input", async () => {
      await expect(
        createTaskTool.execute(
          "not an object",
          context,
        ),
      ).rejects.toThrow(
        "Tool input must be an object.",
      );

      expect(
        mocks.createTask,
      ).not.toHaveBeenCalled();
    });
  });

  describe("list_tasks", () => {
    it("lists tasks using the authenticated user", async () => {
      const tasks = [
        {
          id: "task_1",
          userId: "user_a",
          title: "Task A",
        },
      ];

      mocks.listTasks.mockResolvedValue(tasks);

      const result =
        await listTasksTool.execute(
          {
            status: "TODO",
            priority: "HIGH",
            limit: 10,
          },
          context,
        );

      expect(
        mocks.listTasks,
      ).toHaveBeenCalledWith({
        userId: "user_a",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        dueBefore: undefined,
        dueAfter: undefined,
        limit: 10,
      });

      expect(result).toEqual(tasks);
    });

    it("rejects an invalid status", async () => {
      await expect(
        listTasksTool.execute(
          {
            status: "INVALID",
          },
          context,
        ),
      ).rejects.toThrow(
        "status must be one of",
      );

      expect(
        mocks.listTasks,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid limit", async () => {
      await expect(
        listTasksTool.execute(
          {
            limit: 0,
          },
          context,
        ),
      ).rejects.toThrow(
        "limit must be a positive integer.",
      );

      expect(
        mocks.listTasks,
      ).not.toHaveBeenCalled();
    });
  });

  describe("get_task", () => {
    it("gets a task using the authenticated user", async () => {
      const task = {
        id: "task_1",
        userId: "user_a",
        title: "Finish BrainOS",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      };

      mocks.getTask.mockResolvedValue(task);

      const result =
        await getTaskTool.execute(
          {
            taskId: "task_1",
          },
          context,
        );

      expect(
        mocks.getTask,
      ).toHaveBeenCalledWith(
        "task_1",
        "user_a",
      );

      expect(result).toEqual(task);
    });

    it("rejects a missing task ID", async () => {
      await expect(
        getTaskTool.execute(
          {},
          context,
        ),
      ).rejects.toThrow(
        "taskId is required.",
      );

      expect(
        mocks.getTask,
      ).not.toHaveBeenCalled();
    });
  });

  describe("update_task", () => {
    it("updates supplied task fields for the authenticated user", async () => {
      mocks.updateTask.mockResolvedValue(
        undefined,
      );

      const result =
        await updateTaskTool.execute(
          {
            taskId: "task_1",
            title: "Finish Phase 19",
            description:
              "Complete task tool work",
            priority: "HIGH",
            dueAt:
              "2026-08-30T12:00:00.000Z",
          },
          context,
        );

      expect(
        mocks.updateTask,
      ).toHaveBeenCalledWith(
        "task_1",
        "user_a",
        {
          title: "Finish Phase 19",
          description:
            "Complete task tool work",
          priority:
            TaskPriority.HIGH,
          dueAt: new Date(
            "2026-08-30T12:00:00.000Z",
          ),
        },
      );

      expect(result).toEqual({
        success: true,
        taskId: "task_1",
        updated: true,
      });
    });

    it("rejects a missing task ID", async () => {
      await expect(
        updateTaskTool.execute(
          {
            title: "New title",
          },
          context,
        ),
      ).rejects.toThrow(
        "taskId is required.",
      );

      expect(
        mocks.updateTask,
      ).not.toHaveBeenCalled();
    });

    it("rejects an update with no fields", async () => {
      await expect(
        updateTaskTool.execute(
          {
            taskId: "task_1",
          },
          context,
        ),
      ).rejects.toThrow(
        "At least one task field must be provided for update.",
      );

      expect(
        mocks.updateTask,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid priority", async () => {
      await expect(
        updateTaskTool.execute(
          {
            taskId: "task_1",
            priority: "URGENT",
          },
          context,
        ),
      ).rejects.toThrow(
        "priority must be one of",
      );

      expect(
        mocks.updateTask,
      ).not.toHaveBeenCalled();
    });
  });

  describe("complete_task", () => {
    it("completes a task for the authenticated user", async () => {
      mocks.completeTask.mockResolvedValue(
        undefined,
      );

      const result =
        await completeTaskTool.execute(
          {
            taskId: "task_1",
          },
          context,
        );

      expect(
        mocks.completeTask,
      ).toHaveBeenCalledWith(
        "task_1",
        "user_a",
      );

      expect(result).toEqual({
        success: true,
        taskId: "task_1",
        status: TaskStatus.COMPLETED,
      });
    });

    it("rejects a missing task ID", async () => {
      await expect(
        completeTaskTool.execute(
          {},
          context,
        ),
      ).rejects.toThrow(
        "taskId is required.",
      );

      expect(
        mocks.completeTask,
      ).not.toHaveBeenCalled();
    });
  });

  describe("delete_task", () => {
    it("deletes a task for the authenticated user", async () => {
      mocks.deleteTask.mockResolvedValue(
        undefined,
      );

      const result =
        await deleteTaskTool.execute(
          {
            taskId: "task_1",
          },
          context,
        );

      expect(
        mocks.deleteTask,
      ).toHaveBeenCalledWith(
        "task_1",
        "user_a",
      );

      expect(result).toEqual({
        success: true,
        taskId: "task_1",
        deleted: true,
      });
    });

    it("rejects a missing task ID", async () => {
      await expect(
        deleteTaskTool.execute(
          {},
          context,
        ),
      ).rejects.toThrow(
        "taskId is required.",
      );

      expect(
        mocks.deleteTask,
      ).not.toHaveBeenCalled();
    });
  });
});