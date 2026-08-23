import { describe, expect, it, vi } from "vitest";

import { ReminderWorker } from "../../../src/services/reminders/reminder.worker";
import { ReminderScheduler } from "../../../src/services/reminders/reminder.scheduler";

describe("ReminderScheduler", () => {
  function createScheduler(interval = 30_000) {
    const worker = {
      processDueReminders: vi.fn(),
    } as unknown as ReminderWorker;

    const scheduler = new ReminderScheduler(
      worker,
      interval,
    );

    return {
      scheduler,
      worker,
    };
  }

  it("runs the worker once immediately when started", async () => {
    const { scheduler, worker } =
      createScheduler();

    worker.processDueReminders = vi
      .fn()
      .mockResolvedValue(undefined);

    scheduler.start();

    await vi.waitFor(() => {
      expect(
        worker.processDueReminders,
      ).toHaveBeenCalledTimes(1);
    });

    scheduler.stop();
  });

  it("does not start twice", async () => {
    const { scheduler, worker } =
      createScheduler();

    worker.processDueReminders = vi
      .fn()
      .mockResolvedValue(undefined);

    scheduler.start();
    scheduler.start();

    await vi.waitFor(() => {
      expect(
        worker.processDueReminders,
      ).toHaveBeenCalledTimes(1);
    });

    scheduler.stop();
  });

  it("does not overlap worker executions", async () => {
    const { scheduler, worker } =
      createScheduler();

    let resolveWorker!: () => void;

    worker.processDueReminders = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveWorker = resolve;
          }),
      );

    const firstRun = scheduler.runOnce();

    await vi.waitFor(() => {
      expect(
        worker.processDueReminders,
      ).toHaveBeenCalledTimes(1);
    });

    await scheduler.runOnce();

    expect(
      worker.processDueReminders,
    ).toHaveBeenCalledTimes(1);

    resolveWorker();
    await firstRun;
  });

  it("can be stopped", () => {
    const { scheduler } =
      createScheduler();

    expect(
      scheduler.isRunning(),
    ).toBe(false);

    scheduler.start();

    expect(
      scheduler.isRunning(),
    ).toBe(true);

    scheduler.stop();

    expect(
      scheduler.isRunning(),
    ).toBe(false);
  });

  it("rejects intervals below one second", () => {
    const worker =
      {} as ReminderWorker;

    expect(
      () =>
        new ReminderScheduler(
          worker,
          999,
        ),
    ).toThrow(
      "Reminder scheduler interval must be at least 1000ms.",
    );
  });
});