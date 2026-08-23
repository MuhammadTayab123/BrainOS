import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ReminderStatus } from "@prisma/client";
import { NotFoundError } from "../../../src/errors";

import { ReminderRepository } from "../../../src/services/reminders/repositories/reminder.repository";
import { ReminderService } from "../../../src/services/reminders/reminder.service";

describe("ReminderService", () => {
  function createService() {
    const repository = {
      create: vi.fn(),
      listByUser: vi.fn(),
      findByIdForUser: vi.fn(),
      markProcessing: vi.fn(),
      markDelivered: vi.fn(),
      markFailed: vi.fn(),
      cancel: vi.fn(),
      softDeleteByIdForUser: vi.fn(),
    } as unknown as ReminderRepository;

    const service = new ReminderService(repository);

    return {
      service,
      repository,
    };
  }

  describe("createReminder", () => {
    it("creates a reminder with a trimmed message", async () => {
      const { service, repository } =
        createService();

      const scheduledFor = new Date(
        "2026-08-24T10:00:00.000Z",
      );

      repository.create = vi
        .fn()
        .mockResolvedValue({
          id: "reminder-1",
          message: "Check BrainOS",
        });

      const result =
        await service.createReminder({
          userId: "user-1",
          message: "  Check BrainOS  ",
          scheduledFor,
        });

      expect(repository.create).toHaveBeenCalledWith({
        userId: "user-1",
        taskId: undefined,
        message: "Check BrainOS",
        scheduledFor,
      });

      expect(result).toEqual({
        id: "reminder-1",
        message: "Check BrainOS",
      });
    });

    it("accepts an optional task ID", async () => {
      const { service, repository } =
        createService();

      const scheduledFor = new Date(
        "2026-08-24T10:00:00.000Z",
      );

      repository.create = vi
        .fn()
        .mockResolvedValue({
          id: "reminder-1",
        });

      await service.createReminder({
        userId: "user-1",
        taskId: "task-1",
        message: "Finish task",
        scheduledFor,
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: "user-1",
        taskId: "task-1",
        message: "Finish task",
        scheduledFor,
      });
    });

    it("rejects an empty message", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.createReminder({
          userId: "user-1",
          message: "   ",
          scheduledFor: new Date(),
        }),
      ).rejects.toThrow(
        "Reminder message is required.",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects a missing user ID", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.createReminder({
          userId: "   ",
          message: "Test reminder",
          scheduledFor: new Date(),
        }),
      ).rejects.toThrow(
        "User ID is required.",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid scheduled date", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.createReminder({
          userId: "user-1",
          message: "Test reminder",
          scheduledFor: new Date("invalid"),
        }),
      ).rejects.toThrow(
        "Reminder scheduled time is required.",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid task ID", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.createReminder({
          userId: "user-1",
          taskId: "   ",
          message: "Test reminder",
          scheduledFor: new Date(),
        }),
      ).rejects.toThrow(
        "Task ID is required.",
      );

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe("listReminders", () => {
    it("uses the default limit", async () => {
      const { service, repository } =
        createService();

      repository.listByUser = vi
        .fn()
        .mockResolvedValue([]);

      await service.listReminders({
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
        service.listReminders({
          userId: "user-1",
          limit: 51,
        }),
      ).rejects.toThrow(
        "Reminder list limit must be an integer between 1 and 50.",
      );

      expect(
        repository.listByUser,
      ).not.toHaveBeenCalled();
    });

    it("passes reminder filters to the repository", async () => {
      const { service, repository } =
        createService();

      const dueBefore = new Date(
        "2026-08-24T12:00:00.000Z",
      );

      repository.listByUser = vi
        .fn()
        .mockResolvedValue([]);

      await service.listReminders({
        userId: "user-1",
        status: ReminderStatus.PENDING,
        dueBefore,
        limit: 10,
      });

      expect(
        repository.listByUser,
      ).toHaveBeenCalledWith({
        userId: "user-1",
        status: ReminderStatus.PENDING,
        dueBefore,
        limit: 10,
      });
    });
  });

  describe("getReminder", () => {
    it("returns an owned reminder", async () => {
      const { service, repository } =
        createService();

      const reminder = {
        id: "reminder-1",
        userId: "user-1",
        message: "Check BrainOS",
        status: ReminderStatus.PENDING,
      };

      repository.findByIdForUser = vi
        .fn()
        .mockResolvedValue(reminder);

      const result =
        await service.getReminder(
          "reminder-1",
          "user-1",
        );

      expect(
        repository.findByIdForUser,
      ).toHaveBeenCalledWith(
        "reminder-1",
        "user-1",
      );

      expect(result).toEqual(reminder);
    });

    it("throws when the reminder does not exist", async () => {
      const { service, repository } =
        createService();

      repository.findByIdForUser = vi
        .fn()
        .mockResolvedValue(null);

      await expect(
        service.getReminder(
          "missing-reminder",
          "user-1",
        ),
      ).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("rejects a missing reminder ID", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.getReminder(
          "   ",
          "user-1",
        ),
      ).rejects.toThrow(
        "Reminder ID is required.",
      );

      expect(
        repository.findByIdForUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe("markProcessing", () => {
    it("delegates processing to the repository", async () => {
      const { service, repository } =
        createService();

      repository.markProcessing = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.markProcessing(
        "reminder-1",
      );

      expect(
        repository.markProcessing,
      ).toHaveBeenCalledWith(
        "reminder-1",
      );
    });

    it("rejects a missing reminder ID", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.markProcessing("   "),
      ).rejects.toThrow(
        "Reminder ID is required.",
      );

      expect(
        repository.markProcessing,
      ).not.toHaveBeenCalled();
    });
  });

  describe("markDelivered", () => {
    it("delegates delivery to the repository", async () => {
      const { service, repository } =
        createService();

      repository.markDelivered = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.markDelivered(
        "reminder-1",
      );

      expect(
        repository.markDelivered,
      ).toHaveBeenCalledWith(
        "reminder-1",
      );
    });
  });

  describe("markFailed", () => {
    it("trims the failure error", async () => {
      const { service, repository } =
        createService();

      repository.markFailed = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.markFailed(
        "reminder-1",
        {
          lastError:
            "  Delivery failed  ",
        },
      );

      expect(
        repository.markFailed,
      ).toHaveBeenCalledWith(
        "reminder-1",
        "Delivery failed",
      );
    });

    it("rejects an empty failure error", async () => {
      const { service, repository } =
        createService();

      await expect(
        service.markFailed(
          "reminder-1",
          {
            lastError: "   ",
          },
        ),
      ).rejects.toThrow(
        "Reminder failure error is required.",
      );

      expect(
        repository.markFailed,
      ).not.toHaveBeenCalled();
    });
  });

  describe("cancelReminder", () => {
    it("delegates cancellation to the repository", async () => {
      const { service, repository } =
        createService();

      repository.cancel = vi
        .fn()
        .mockResolvedValue(undefined);

      await service.cancelReminder(
        "reminder-1",
        "user-1",
      );

      expect(
        repository.cancel,
      ).toHaveBeenCalledWith(
        "reminder-1",
        "user-1",
      );
    });
  });

  describe("deleteReminder", () => {
    it("delegates soft deletion to the repository", async () => {
      const { service, repository } =
        createService();

      repository.softDeleteByIdForUser =
        vi.fn().mockResolvedValue(
          undefined,
        );

      await service.deleteReminder(
        "reminder-1",
        "user-1",
      );

      expect(
        repository.softDeleteByIdForUser,
      ).toHaveBeenCalledWith(
        "reminder-1",
        "user-1",
      );
    });
  });
});