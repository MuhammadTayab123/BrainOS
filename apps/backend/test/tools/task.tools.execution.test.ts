import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTaskMock } = vi.hoisted(() => ({
  createTaskMock: vi.fn(),
}));

vi.mock("../../src/services/tasks/repositories/task.repository", () => {
  return {
    TaskRepository: class MockTaskRepository {
      create = createTaskMock;
    },
  };
});

import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolExecutor } from "../../src/services/tools/tool.executor";

describe("Task tool execution integration", () => {
  beforeEach(() => {
    createTaskMock.mockReset();
  });

  it("executes create_task through the real registry and executor", async () => {
    const createdTask = {
      id: "task-123",
      userId: "user-123",
      title: "Review BrainOS architecture",
      description: "Review the current architecture.",
      priority: "HIGH",
      dueAt: null,
    };

    createTaskMock.mockResolvedValue(createdTask);

    const registry = createToolRegistry();
    const executor = new ToolExecutor(registry);

    const result = await executor.execute(
      "create_task",
      {
        title: "Review BrainOS architecture",
        description: "Review the current architecture.",
        priority: "HIGH",
      },
      {
        userId: "user-123",
      },
    );

    expect(createTaskMock).toHaveBeenCalledTimes(1);

    expect(createTaskMock).toHaveBeenCalledWith({
      userId: "user-123",
      title: "Review BrainOS architecture",
      description: "Review the current architecture.",
      priority: "HIGH",
      dueAt: undefined,
    });

    expect(result).toEqual(createdTask);
  });

  it("rejects create_task without a title", async () => {
    const registry = createToolRegistry();
    const executor = new ToolExecutor(registry);

    await expect(
      executor.execute(
        "create_task",
        {},
        {
          userId: "user-123",
        },
      ),
    ).rejects.toThrow("title is required.");

    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it("uses the authenticated user from the tool context", async () => {
    createTaskMock.mockResolvedValue({
      id: "task-456",
      userId: "authenticated-user",
      title: "My task",
    });

    const registry = createToolRegistry();
    const executor = new ToolExecutor(registry);

    await executor.execute(
      "create_task",
      {
        title: "My task",
      },
      {
        userId: "authenticated-user",
      },
    );

    expect(createTaskMock).toHaveBeenCalledWith({
      userId: "authenticated-user",
      title: "My task",
      description: undefined,
      priority: undefined,
      dueAt: undefined,
    });
  });
});
