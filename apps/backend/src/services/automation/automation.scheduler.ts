import { AutomationWorker } from "./execution/automation.worker";

const DEFAULT_INTERVAL_MS = 30_000;

export class AutomationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly worker: AutomationWorker,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {
    if (!Number.isInteger(intervalMs) || intervalMs < 1_000) {
      throw new Error("Automation scheduler interval must be at least 1000ms.");
    }
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);

    void this.runOnce();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.worker.processDueAutomations();
      await this.worker.processTaskDueAutomations();
    } finally {
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}
