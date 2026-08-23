import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../src/errors";
import { ReminderDeliveryProvider } from "../../../src/services/reminders/reminder.delivery";
import { ReminderWorker } from "../../../src/services/reminders/reminder.worker";
import { ReminderRepository } from "../../../src/services/reminders/repositories/reminder.repository";

describe("ReminderWorker", () => {
  function createWorker() {
    const repository = {
      findDuePending: vi.fn(),
      markProcessing: vi.fn(),
      markDelivered: vi.fn(),
      markFailed: vi.fn(),
    } as unknown as ReminderRepository;

    const deliveryProvider = {
      deliver: vi.fn(),
    } as unknown as ReminderDeliveryProvider;

    const worker = new ReminderWorker(
      repository,
      deliveryProvider,
    );

    return {
      worker,
      repository,
      deliveryProvider,
    };
  }

  const reminder = {
    id: "reminder-1",
    userId: "user-1",
    taskId: null,
    message: "Test reminder",
    scheduledFor: new Date(
      "2026-08-23T20:00:00.000Z",
    ),
    status: "PENDING" as const,
    attempts: 0,
    deliveredAt: null,
    lastError: null,
    createdAt: new Date(
      "2026-08-23T19:00:00.000Z",
    ),
    updatedAt: new Date(
      "2026-08-23T19:00:00.000Z",
    ),
    deletedAt: null,
  };

  it("delivers a due reminder successfully", async () => {
    const {
      worker,
      repository,
      deliveryProvider,
    } = createWorker();

    repository.findDuePending = vi
      .fn()
      .mockResolvedValue([reminder]);

    repository.markProcessing = vi
      .fn()
      .mockResolvedValue(undefined);

    deliveryProvider.deliver = vi
      .fn()
      .mockResolvedValue(undefined);

    repository.markDelivered = vi
      .fn()
      .mockResolvedValue(undefined);

    const result =
      await worker.processDueReminders(
        new Date(
          "2026-08-23T21:00:00.000Z",
        ),
      );

    expect(
      repository.findDuePending,
    ).toHaveBeenCalledWith(
      new Date(
        "2026-08-23T21:00:00.000Z",
      ),
      50,
    );

    expect(
      repository.markProcessing,
    ).toHaveBeenCalledWith(
      "reminder-1",
    );

    expect(
      deliveryProvider.deliver,
    ).toHaveBeenCalledWith(
      reminder,
    );

    expect(
      repository.markDelivered,
    ).toHaveBeenCalledWith(
      "reminder-1",
    );

    expect(result).toEqual({
      scanned: 1,
      claimed: 1,
      delivered: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it("marks a reminder failed when delivery throws", async () => {
    const {
      worker,
      repository,
      deliveryProvider,
    } = createWorker();

    repository.findDuePending = vi
      .fn()
      .mockResolvedValue([reminder]);

    repository.markProcessing = vi
      .fn()
      .mockResolvedValue(undefined);

    deliveryProvider.deliver = vi
      .fn()
      .mockRejectedValue(
        new Error("Delivery provider unavailable."),
      );

    repository.markFailed = vi
      .fn()
      .mockResolvedValue(undefined);

    const result =
      await worker.processDueReminders();

    expect(
      repository.markFailed,
    ).toHaveBeenCalledWith(
      "reminder-1",
      "Delivery provider unavailable.",
    );

    expect(
      repository.markDelivered,
    ).not.toHaveBeenCalled();

    expect(result).toEqual({
      scanned: 1,
      claimed: 1,
      delivered: 0,
      failed: 1,
      skipped: 0,
    });
  });

  it("skips a reminder that another worker already claimed", async () => {
    const {
      worker,
      repository,
      deliveryProvider,
    } = createWorker();

    repository.findDuePending = vi
      .fn()
      .mockResolvedValue([reminder]);

    repository.markProcessing = vi
      .fn()
      .mockRejectedValue(
        new NotFoundError(
          "Pending reminder not found.",
        ),
      );

    const result =
      await worker.processDueReminders();

    expect(
      deliveryProvider.deliver,
    ).not.toHaveBeenCalled();

    expect(result).toEqual({
      scanned: 1,
      claimed: 0,
      delivered: 0,
      failed: 0,
      skipped: 1,
    });
  });

  it("processes multiple reminders", async () => {
    const {
      worker,
      repository,
      deliveryProvider,
    } = createWorker();

    const secondReminder = {
      ...reminder,
      id: "reminder-2",
      message: "Second reminder",
    };

    repository.findDuePending = vi
      .fn()
      .mockResolvedValue([
        reminder,
        secondReminder,
      ]);

    repository.markProcessing = vi
      .fn()
      .mockResolvedValue(undefined);

    deliveryProvider.deliver = vi
      .fn()
      .mockResolvedValue(undefined);

    repository.markDelivered = vi
      .fn()
      .mockResolvedValue(undefined);

    const result =
      await worker.processDueReminders();

    expect(
      deliveryProvider.deliver,
    ).toHaveBeenCalledTimes(2);

    expect(
      repository.markProcessing,
    ).toHaveBeenCalledTimes(2);

    expect(
      repository.markDelivered,
    ).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      scanned: 2,
      claimed: 2,
      delivered: 2,
      failed: 0,
      skipped: 0,
    });
  });

  it("rejects an invalid batch size", async () => {
    const { worker, repository } =
      createWorker();

    await expect(
      worker.processDueReminders(
        new Date(),
        0,
      ),
    ).rejects.toThrow(
      "Reminder worker batch size must be an integer between 1 and 50.",
    );

    expect(
      repository.findDuePending,
    ).not.toHaveBeenCalled();
  });

  it("rejects a batch size above the maximum", async () => {
    const { worker, repository } =
      createWorker();

    await expect(
      worker.processDueReminders(
        new Date(),
        51,
      ),
    ).rejects.toThrow(
      "Reminder worker batch size must be an integer between 1 and 50.",
    );

    expect(
      repository.findDuePending,
    ).not.toHaveBeenCalled();
  });

  it("rejects an invalid execution time", async () => {
    const { worker, repository } =
      createWorker();

    await expect(
      worker.processDueReminders(
        new Date("invalid"),
      ),
    ).rejects.toThrow(
      "Worker execution time is required.",
    );

    expect(
      repository.findDuePending,
    ).not.toHaveBeenCalled();
  });
});