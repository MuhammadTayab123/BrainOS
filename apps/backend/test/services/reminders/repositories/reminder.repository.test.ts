import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NotFoundError } from "../../../../src/errors";
import { DatabaseClient } from "../../../../src/lib/prisma.types";
import { ReminderRepository } from "../../../../src/services/reminders/repositories/reminder.repository";
import { ReminderStatus } from "../../../../src/services/reminders/reminder.types";

describe("ReminderRepository", () => {
  function createRepository() {
    const db = {
      reminder: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
    } as unknown as DatabaseClient;

    const repository = new ReminderRepository(db);

    return {
      repository,
      db,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a reminder with the supplied data", async () => {
      const { repository, db } =
        createRepository();

      const scheduledFor = new Date(
        "2026-08-24T10:00:00.000Z",
      );

      const reminder = {
        id: "reminder-1",
        userId: "user-1",
        taskId: "task-1",
        message: "Check BrainOS",
        scheduledFor,
      };

      db.reminder.create = vi
        .fn()
        .mockResolvedValue(reminder);

      const result =
        await repository.create({
          userId: "user-1",
          taskId: "task-1",
          message: "Check BrainOS",
          scheduledFor,
        });

      expect(
        db.reminder.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          taskId: "task-1",
          message: "Check BrainOS",
          scheduledFor,
        },
      });

      expect(result).toEqual(reminder);
    });
  });

  describe("listByUser", () => {
    it("lists active reminders for a user", async () => {
      const { repository, db } =
        createRepository();

      const reminders = [
        {
          id: "reminder-1",
          userId: "user-1",
          message: "Check BrainOS",
        },
      ];

      db.reminder.findMany = vi
        .fn()
        .mockResolvedValue(reminders);

      const result =
        await repository.listByUser({
          userId: "user-1",
          limit: 10,
        });

      expect(
        db.reminder.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          deletedAt: null,
          status: undefined,
          scheduledFor: undefined,
        },
        orderBy: {
          scheduledFor: "asc",
        },
        take: 10,
      });

      expect(result).toEqual(
        reminders,
      );
    });

    it("applies status and dueBefore filters", async () => {
      const { repository, db } =
        createRepository();

      const dueBefore = new Date(
        "2026-08-24T12:00:00.000Z",
      );

      db.reminder.findMany = vi
        .fn()
        .mockResolvedValue([]);

      await repository.listByUser({
        userId: "user-1",
        status: ReminderStatus.PENDING,
        dueBefore,
        limit: 5,
      });

      expect(
        db.reminder.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          deletedAt: null,
          status: ReminderStatus.PENDING,
          scheduledFor: {
            lte: dueBefore,
          },
        },
        orderBy: {
          scheduledFor: "asc",
        },
        take: 5,
      });
    });
  });

  describe("findByIdForUser", () => {
    it("finds an active reminder owned by the user", async () => {
      const { repository, db } =
        createRepository();

      const reminder = {
        id: "reminder-1",
        userId: "user-1",
        message: "Check BrainOS",
      };

      db.reminder.findFirst = vi
        .fn()
        .mockResolvedValue(reminder);

      const result =
        await repository.findByIdForUser(
          "reminder-1",
          "user-1",
        );

      expect(
        db.reminder.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: "reminder-1",
          userId: "user-1",
          deletedAt: null,
        },
      });

      expect(result).toEqual(
        reminder,
      );
    });
  });

  describe("markProcessing", () => {
    it("moves a pending reminder to processing and increments attempts", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 1,
        });

      await repository.markProcessing(
        "reminder-1",
      );

      expect(
        db.reminder.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: "reminder-1",
          deletedAt: null,
          status: "PENDING",
        },
        data: {
          status: "PROCESSING",
          attempts: {
            increment: 1,
          },
        },
      });
    });

    it("throws when the pending reminder does not exist", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 0,
        });

      await expect(
        repository.markProcessing(
          "missing-reminder",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("markDelivered", () => {
    it("moves a processing reminder to delivered", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 1,
        });

      await repository.markDelivered(
        "reminder-1",
      );

      expect(
        db.reminder.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: "reminder-1",
          deletedAt: null,
          status: "PROCESSING",
        },
        data: {
          status: "DELIVERED",
          deliveredAt: expect.any(Date),
          lastError: null,
        },
      });
    });

    it("throws when the processing reminder does not exist", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 0,
        });

      await expect(
        repository.markDelivered(
          "missing-reminder",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("markFailed", () => {
    it("moves a processing reminder to failed", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 1,
        });

      await repository.markFailed(
        "reminder-1",
        "Delivery failed",
      );

      expect(
        db.reminder.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: "reminder-1",
          deletedAt: null,
          status: "PROCESSING",
        },
        data: {
          status: "FAILED",
          lastError: "Delivery failed",
        },
      });
    });

    it("throws when the processing reminder does not exist", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 0,
        });

      await expect(
        repository.markFailed(
          "missing-reminder",
          "Delivery failed",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("cancel", () => {
    it("cancels an active reminder owned by the user", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 1,
        });

      await repository.cancel(
        "reminder-1",
        "user-1",
      );

      expect(
        db.reminder.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: "reminder-1",
          userId: "user-1",
          deletedAt: null,
          status: {
            in: [
              "PENDING",
              "PROCESSING",
            ],
          },
        },
        data: {
          status: "CANCELLED",
        },
      });
    });

    it("throws when no active reminder is found", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 0,
        });

      await expect(
        repository.cancel(
          "missing-reminder",
          "user-1",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("softDeleteByIdForUser", () => {
    it("soft deletes an active reminder owned by the user", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 1,
        });

      await repository.softDeleteByIdForUser(
        "reminder-1",
        "user-1",
      );

      expect(
        db.reminder.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          id: "reminder-1",
          userId: "user-1",
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      });
    });

    it("throws when the reminder does not exist", async () => {
      const { repository, db } =
        createRepository();

      db.reminder.updateMany = vi
        .fn()
        .mockResolvedValue({
          count: 0,
        });

      await expect(
        repository.softDeleteByIdForUser(
          "missing-reminder",
          "user-1",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});