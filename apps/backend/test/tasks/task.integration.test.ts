import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { Prisma } from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { prisma } from "../../src/lib/prisma";
import { TaskRepository } from "../../src/services/tasks/repositories/task.repository";
import {
  TaskPriority,
  TaskStatus,
} from "../../src/services/tasks/task.types";
import { assertSafeTestEnvironment } from "../safety";

const userA = {
  id: "task-integration-user-a",
  clerkId: "task-integration-clerk-a",
  email: "task-integration-user-a@example.test",
};

const userB = {
  id: "task-integration-user-b",
  clerkId: "task-integration-clerk-b",
  email: "task-integration-user-b@example.test",
};

const testUserIds = [userA.id, userB.id];

const taskRepository = new TaskRepository();

function assertTestDatabaseSafety(): void {
  assertSafeTestEnvironment();
}

async function cleanupIntegrationRows(): Promise<void> {
  assertTestDatabaseSafety();

  await prisma.task.deleteMany({
    where: {
      userId: {
        in: testUserIds,
      },
    },
  });
}

describe("Task PostgreSQL integration", () => {
  beforeAll(async () => {
    assertTestDatabaseSafety();

    const database = await prisma.$queryRaw<
      Array<{ database: string }>
    >(
      Prisma.sql`
        SELECT current_database() AS "database"
      `,
    );

    expect(database).toEqual([
      {
        database: "brainos_test",
      },
    ]);

    const precheck = await prisma.$queryRaw<
      Array<{
        taskTable: string | null;
        userTable: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          to_regclass('public."Task"')::text AS "taskTable",
          to_regclass('public."User"')::text AS "userTable"
      `,
    );

    expect(precheck).toEqual([
      {
        taskTable: '"Task"',
        userTable: '"User"',
      },
    ]);

    await cleanupIntegrationRows();

    assertTestDatabaseSafety();

    await prisma.user.upsert({
      where: {
        id: userA.id,
      },
      update: {
        clerkId: userA.clerkId,
        email: userA.email,
        firstName: "Task",
        lastName: "User A",
        imageUrl: null,
      },
      create: {
        ...userA,
        firstName: "Task",
        lastName: "User A",
        imageUrl: null,
      },
    });

    await prisma.user.upsert({
      where: {
        id: userB.id,
      },
      update: {
        clerkId: userB.clerkId,
        email: userB.email,
        firstName: "Task",
        lastName: "User B",
        imageUrl: null,
      },
      create: {
        ...userB,
        firstName: "Task",
        lastName: "User B",
        imageUrl: null,
      },
    });
  });

  beforeEach(async () => {
    await cleanupIntegrationRows();
  });

  afterAll(async () => {
    try {
      await cleanupIntegrationRows();

      assertTestDatabaseSafety();

      await prisma.user.deleteMany({
        where: {
          id: {
            in: testUserIds,
          },
        },
      });
    } finally {
      await prisma.$disconnect();
      delete (globalThis as { prisma?: unknown }).prisma;
    }
  });

  it("persists a task with owner, title, status, and priority", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Integration task",
      description: "Task persistence test",
      priority: TaskPriority.HIGH,
    });

    expect(task).toMatchObject({
      userId: userA.id,
      title: "Integration task",
      description: "Task persistence test",
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      deletedAt: null,
      completedAt: null,
    });
  });

  it("lists only active tasks belonging to the requested owner", async () => {
    const taskA = await taskRepository.create({
      userId: userA.id,
      title: "Owner A task",
    });

    const taskB = await taskRepository.create({
      userId: userB.id,
      title: "Owner B task",
    });

    const userATasks = await taskRepository.listByUser({
      userId: userA.id,
    });

    const userBTasks = await taskRepository.listByUser({
      userId: userB.id,
    });

    expect(userATasks.map((task) => task.id)).toEqual([
      taskA.id,
    ]);

    expect(userBTasks.map((task) => task.id)).toEqual([
      taskB.id,
    ]);
  });

  it("retrieves an owned task and denies different-owner and nonexistent reads", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Owner protected task",
    });

    await expect(
      taskRepository.findByIdForUser(
        task.id,
        userA.id,
      ),
    ).resolves.toMatchObject({
      id: task.id,
      userId: userA.id,
    });

    await expect(
      taskRepository.findByIdForUser(
        task.id,
        userB.id,
      ),
    ).resolves.toBeNull();

    await expect(
      taskRepository.findByIdForUser(
        "task-does-not-exist",
        userA.id,
      ),
    ).resolves.toBeNull();
  });

  it("updates only the task belonging to the authenticated owner", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Before update",
      priority: TaskPriority.LOW,
    });

    await taskRepository.updateByIdForUser(
      task.id,
      userA.id,
      {
        title: "After update",
        description: "Updated description",
        priority: TaskPriority.HIGH,
      },
    );

    const updated =
      await taskRepository.findByIdForUser(
        task.id,
        userA.id,
      );

    expect(updated).toMatchObject({
      id: task.id,
      title: "After update",
      description: "Updated description",
      priority: TaskPriority.HIGH,
    });
  });

  it("denies a cross-owner update without changing the real task", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Protected task",
      priority: TaskPriority.MEDIUM,
    });

    await expect(
      taskRepository.updateByIdForUser(
        task.id,
        userB.id,
        {
          title: "Unauthorized update",
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    const stored =
      await taskRepository.findByIdForUser(
        task.id,
        userA.id,
      );

    expect(stored).toMatchObject({
      title: "Protected task",
      priority: TaskPriority.MEDIUM,
      deletedAt: null,
    });
  });

  it("completes an owned task", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Complete me",
    });

    await taskRepository.completeByIdForUser(
      task.id,
      userA.id,
    );

    const completed =
      await taskRepository.findByIdForUser(
        task.id,
        userA.id,
      );

    expect(completed).toMatchObject({
      id: task.id,
      status: TaskStatus.COMPLETED,
    });

    expect(completed?.completedAt).toBeInstanceOf(Date);
  });

  it("denies cross-owner completion", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Protected completion",
    });

    await expect(
      taskRepository.completeByIdForUser(
        task.id,
        userB.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    const stored =
      await taskRepository.findByIdForUser(
        task.id,
        userA.id,
      );

    expect(stored).toMatchObject({
      status: TaskStatus.TODO,
      completedAt: null,
    });
  });

  it("soft-deletes an owned task", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Soft delete task",
    });

    await taskRepository.softDeleteByIdForUser(
      task.id,
      userA.id,
    );

    const stored =
      await prisma.task.findUnique({
        where: {
          id: task.id,
        },
      });

    expect(stored).toMatchObject({
      id: task.id,
      deletedAt: expect.any(Date),
    });
  });

  it("hides soft-deleted tasks from active reads and lists", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Hidden task",
    });

    await taskRepository.softDeleteByIdForUser(
      task.id,
      userA.id,
    );

    await expect(
      taskRepository.findByIdForUser(
        task.id,
        userA.id,
      ),
    ).resolves.toBeNull();

    await expect(
      taskRepository.listByUser({
        userId: userA.id,
      }),
    ).resolves.toEqual([]);
  });

  it("denies repeated deletion and cross-owner deletion", async () => {
    const task = await taskRepository.create({
      userId: userA.id,
      title: "Delete protection",
    });

    await expect(
      taskRepository.softDeleteByIdForUser(
        task.id,
        userB.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);

    await taskRepository.softDeleteByIdForUser(
      task.id,
      userA.id,
    );

    await expect(
      taskRepository.softDeleteByIdForUser(
        task.id,
        userA.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("filters tasks by status and priority", async () => {
    const todoHigh = await taskRepository.create({
      userId: userA.id,
      title: "High todo",
      priority: TaskPriority.HIGH,
    });

    await taskRepository.create({
      userId: userA.id,
      title: "Medium todo",
      priority: TaskPriority.MEDIUM,
    });

    const completed = await taskRepository.create({
      userId: userA.id,
      title: "High completed",
      priority: TaskPriority.HIGH,
    });

    await taskRepository.completeByIdForUser(
      completed.id,
      userA.id,
    );

    const results =
      await taskRepository.listByUser({
        userId: userA.id,
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
      });

    expect(results.map((task) => task.id)).toEqual([
      todoHigh.id,
    ]);
  });
});