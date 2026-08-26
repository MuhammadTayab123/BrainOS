import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ReminderRepository } from "../../../src/services/reminders/repositories/reminder.repository";
import { ReminderDeliveryProvider } from "../../../src/services/reminders/reminder-delivery.provider";
import { ReminderWorker } from "../../../src/services/reminders/reminder.worker";

describe("ReminderWorker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it("processes and delivers due reminders", async () => {
    const {
      worker,
      repository,
      deliveryProvider,
    } = createWorker();

    const now = new Date(
      "2026-08-26T10:00:00.000Z",
    );

    const scheduledFor = new Date(
      "2026-08-26T09:59:00.000Z",
    );

    repository.findDuePending = vi
      .fn()
      .mockResolvedValue([
        {
          id: "reminder-1",
          userId: "user-1",
          taskId: "task-1",
          message: "Check BrainOS",
          scheduledFor,
        },
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
      await worker.processDueReminders({
        now,
        limit: 10,
      });

    expect(
      repository.findDuePending,
    ).toHaveBeenCalledWith(
      now,
      10,
    );

    expect(
      repository.markProcessing,
    ).toHaveBeenCalledWith(
      "reminder-1",
    );

    expect(
      deliveryProvider.deliver,
    ).toHaveBeenCalledWith({
      id: "reminder-1",
      userId: "user-1",
      taskId: "task-1",
      message: "Check BrainOS",
      scheduledFor,
    });

    expect(
      repository.markDelivered,
    ).toHaveBeenCalledWith(
      "reminder-1",
    );

    expect(result).toEqual({
      found: 1,
      processed: 1,
      delivered: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it("marks a reminder failed when delivery fails", async () => {
    const {
      worker,
      repository,
      deliveryProvider,
    } = createWorker();

    repository.findDuePending = vi
      .fn()
      .mockResolvedValue([
        {
          id: "reminder-1",
          userId: "user-1",
          taskId: null,
          message: "Check BrainOS",
          scheduledFor: new Date(
            "2026-08-26T09:59:00.000Z",
          ),
        },
      ]);

    repository.markProcessing = vi
      .fn()
      .mockResolvedValue(undefined);

    deliveryProvider.deliver = vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Delivery unavailable.",
        ),
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
      "Delivery unavailable.",
    );

    expect(result).toEqual({
      found: 1,
      processed: 1,
      delivered: 0,
      failed: 1,
      skipped: 0,
    });
  });
});
