import { describe, expect, it, vi } from "vitest";

import { AutomationScheduler } from "../../../src/services/automation/automation.scheduler";

describe("AutomationScheduler", () => {
  it("runs the worker immediately when started", async () => {
    const worker = {
      processDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
      processTaskDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
    };

    const scheduler = new AutomationScheduler(worker as any, 30_000);

    scheduler.start();

    await vi.waitFor(() => {
      expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    });

    await vi.waitFor(() => {
      expect(worker.processTaskDueAutomations).toHaveBeenCalledTimes(1);
    });

    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();
  });

  it("does not start twice", async () => {
    const worker = {
      processDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
      processTaskDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
    };

    const scheduler = new AutomationScheduler(worker as any, 30_000);

    scheduler.start();
    scheduler.start();

    await vi.waitFor(() => {
      expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    });

    await vi.waitFor(() => {
      expect(worker.processTaskDueAutomations).toHaveBeenCalledTimes(1);
    });

    scheduler.stop();

    expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    expect(worker.processTaskDueAutomations).toHaveBeenCalledTimes(1);
  });

  it("does not overlap worker executions", async () => {
    let resolveWorker: (() => void) | undefined;

    const workerPromise = new Promise<void>((resolve) => {
      resolveWorker = resolve;
    });

    const worker = {
      processDueAutomations: vi.fn().mockReturnValue(workerPromise),
      processTaskDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
    };

    const scheduler = new AutomationScheduler(worker as any, 1_000);

    const firstRun = scheduler.runOnce();
    const secondRun = scheduler.runOnce();

    await Promise.resolve();

    expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    expect(worker.processTaskDueAutomations).not.toHaveBeenCalled();

    resolveWorker!();

    await firstRun;
    await secondRun;

    expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    expect(worker.processTaskDueAutomations).toHaveBeenCalledTimes(1);
  });

  it("stops the scheduler", async () => {
    const worker = {
      processDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
      processTaskDueAutomations: vi.fn().mockResolvedValue({
        found: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      }),
    };

    const scheduler = new AutomationScheduler(worker as any, 30_000);

    scheduler.start();

    await vi.waitFor(() => {
      expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    });

    await vi.waitFor(() => {
      expect(worker.processTaskDueAutomations).toHaveBeenCalledTimes(1);
    });

    expect(scheduler.isRunning()).toBe(true);

    scheduler.stop();

    expect(scheduler.isRunning()).toBe(false);
  });

  it("rejects an interval below 1000ms", () => {
    const worker = {
      processDueAutomations: vi.fn(),
      processTaskDueAutomations: vi.fn(),
    };

    expect(() => new AutomationScheduler(worker as any, 999)).toThrow(
      "Automation scheduler interval must be at least 1000ms.",
    );
  });

  it("runs both automation worker paths", async () => {
    const worker = {
      processDueAutomations: vi.fn().mockResolvedValue({
        found: 1,
        processed: 1,
        completed: 1,
        failed: 0,
        skipped: 0,
      }),
      processTaskDueAutomations: vi.fn().mockResolvedValue({
        found: 2,
        processed: 2,
        completed: 2,
        failed: 0,
        skipped: 0,
      }),
    };

    const scheduler = new AutomationScheduler(worker as any, 30_000);

    await scheduler.runOnce();

    expect(worker.processDueAutomations).toHaveBeenCalledTimes(1);
    expect(worker.processTaskDueAutomations).toHaveBeenCalledTimes(1);
  });
});
