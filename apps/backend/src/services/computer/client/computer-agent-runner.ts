import { ComputerAgentClient } from "./computer-agent-client";
import { ComputerAgentClientError } from "./computer-agent-client.types";
import {
  ComputerAgentRunnerConfig,
  ComputerAgentRunnerStartOptions,
  ComputerAgentRunnerState,
  ComputerAgentRunnerStatus,
} from "./computer-agent-runner.types";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_HEARTBEAT_INTERVAL_MS = 100;

/**
 * Standalone host agent lifecycle and periodic authenticated heartbeat runner.
 *
 * Security & architectural guarantees:
 * - Operates strictly on runner lifecycle and heartbeat pings.
 * - Does not execute arbitrary commands or duplicate backend authorization policies.
 * - Manages timers cleanly and supports AbortController cancellation.
 * - Prevents overlapping/duplicate heartbeat loops.
 * - Sanitizes errors and never leaks secret credentials.
 */
export class ComputerAgentRunner {
  public readonly client: ComputerAgentClient;
  public readonly heartbeatIntervalMs: number;

  private _status: ComputerAgentRunnerStatus = "STOPPED";
  private _startedAt: number | null = null;
  private _lastHeartbeatAt: number | null = null;
  private _lastHeartbeatSuccess: boolean | null = null;
  private _consecutiveSuccesses = 0;
  private _consecutiveFailures = 0;
  private _lastError: string | null = null;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private internalAbortController: AbortController | null = null;
  private activeHeartbeatPromise: Promise<void> | null = null;
  private externalAbortCleanup: (() => void) | null = null;

  private readonly onHeartbeatSuccess?: ComputerAgentRunnerConfig["onHeartbeatSuccess"];
  private readonly onHeartbeatError?: ComputerAgentRunnerConfig["onHeartbeatError"];
  private readonly onStatusChange?: ComputerAgentRunnerConfig["onStatusChange"];

  constructor(config: ComputerAgentRunnerConfig) {
    if (!config || typeof config !== "object") {
      throw new ComputerAgentClientError({
        message: "ComputerAgentRunnerConfig must be a valid object.",
        statusCode: 400,
      });
    }

    if (!config.client || !(config.client instanceof ComputerAgentClient)) {
      throw new ComputerAgentClientError({
        message: "A valid ComputerAgentClient instance is required.",
        statusCode: 400,
      });
    }

    this.client = config.client;

    const interval = config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    if (typeof interval !== "number" || interval < MIN_HEARTBEAT_INTERVAL_MS) {
      throw new ComputerAgentClientError({
        message: `Heartbeat interval must be at least ${MIN_HEARTBEAT_INTERVAL_MS}ms.`,
        statusCode: 400,
      });
    }
    this.heartbeatIntervalMs = interval;

    this.onHeartbeatSuccess = config.onHeartbeatSuccess;
    this.onHeartbeatError = config.onHeartbeatError;
    this.onStatusChange = config.onStatusChange;
  }

  /**
   * Initializes a ComputerAgentRunner from environment variables.
   */
  static fromEnv(
    env: NodeJS.ProcessEnv = process.env,
    options?: Omit<ComputerAgentRunnerConfig, "client">,
    customFetch?: typeof fetch,
  ): ComputerAgentRunner {
    const client = ComputerAgentClient.fromEnv(env, customFetch);

    let heartbeatIntervalMs = options?.heartbeatIntervalMs;
    const rawInterval = env.BRAINOS_AGENT_HEARTBEAT_INTERVAL_MS;
    if (!heartbeatIntervalMs && rawInterval && /^\d+$/.test(rawInterval.trim())) {
      heartbeatIntervalMs = Number.parseInt(rawInterval.trim(), 10);
    }

    return new ComputerAgentRunner({
      client,
      ...options,
      heartbeatIntervalMs,
    });
  }

  get status(): ComputerAgentRunnerStatus {
    return this._status;
  }

  get isRunning(): boolean {
    return this._status === "RUNNING";
  }

  getState(): ComputerAgentRunnerState {
    return {
      status: this._status,
      isRunning: this.isRunning,
      agentId: this.client.agentId,
      baseUrl: this.client.baseUrl,
      startedAt: this._startedAt,
      lastHeartbeatAt: this._lastHeartbeatAt,
      lastHeartbeatSuccess: this._lastHeartbeatSuccess,
      consecutiveSuccesses: this._consecutiveSuccesses,
      consecutiveFailures: this._consecutiveFailures,
      lastError: this._lastError,
    };
  }

  /**
   * Starts the host runner, executes an immediate authenticated ping, and schedules periodic heartbeats.
   */
  async start(options?: ComputerAgentRunnerStartOptions): Promise<void> {
    if (this._status === "RUNNING" || this._status === "STARTING") {
      throw new ComputerAgentClientError({
        message: `Runner cannot be started in current state: "${this._status}". Call stop() first.`,
        code: "ALREADY_RUNNING",
        statusCode: 409,
      });
    }

    if (options?.signal?.aborted) {
      throw new ComputerAgentClientError({
        message: "Runner start aborted before execution.",
        code: "ABORTED",
        statusCode: 499,
      });
    }

    this.setStatus("STARTING");
    this.internalAbortController = new AbortController();

    if (options?.signal) {
      const onAbort = () => {
        void this.stop();
      };
      options.signal.addEventListener("abort", onAbort, { once: true });
      this.externalAbortCleanup = () => {
        options.signal?.removeEventListener("abort", onAbort);
      };
    }

    try {
      if (!options?.skipImmediatePing) {
        await this.performHeartbeat();
      }

      this._startedAt = Date.now();
      this.setStatus("RUNNING");
      this.scheduleNextHeartbeat();
    } catch (err: unknown) {
      this.cleanup();
      this.setStatus("ERROR");
      const error =
        err instanceof Error ? err : new Error("Failed to start runner.");
      this._lastError = error.message;
      throw err;
    }
  }

  /**
   * Gracefully stops the runner and cancels any scheduled or pending heartbeats.
   */
  async stop(): Promise<void> {
    if (this._status === "STOPPED" || this._status === "STOPPING") {
      return;
    }

    this.setStatus("STOPPING");
    this.cleanup();

    // Wait for in-flight heartbeat ping to finish if one is active
    if (this.activeHeartbeatPromise) {
      try {
        await this.activeHeartbeatPromise;
      } catch {
        // Ignore in-flight heartbeat errors during graceful stop
      } finally {
        this.activeHeartbeatPromise = null;
      }
    }

    this.setStatus("STOPPED");
  }

  private scheduleNextHeartbeat(): void {
    if (this._status !== "RUNNING") {
      return;
    }

    this.heartbeatTimer = setTimeout(async () => {
      if (this._status !== "RUNNING") {
        return;
      }

      try {
        await this.performHeartbeat();
      } catch {
        // Handled in performHeartbeat, safe to continue loop
      } finally {
        if (this._status === "RUNNING") {
          this.scheduleNextHeartbeat();
        }
      }
    }, this.heartbeatIntervalMs);
  }

  private async performHeartbeat(): Promise<void> {
    const signal = this.internalAbortController?.signal;
    if (signal?.aborted) {
      return;
    }

    const now = Date.now();
    this.activeHeartbeatPromise = (async () => {
      try {
        const response = await this.client.ping({ signal });
        this._lastHeartbeatAt = Date.now();
        this._lastHeartbeatSuccess = response.success;

        if (response.success) {
          this._consecutiveSuccesses += 1;
          this._consecutiveFailures = 0;
          this._lastError = null;

          if (this.onHeartbeatSuccess) {
            try {
              this.onHeartbeatSuccess({
                timestamp: this._lastHeartbeatAt,
                agentId: this.client.agentId,
                consecutiveSuccesses: this._consecutiveSuccesses,
                receivedAt: response.data?.receivedAt,
              });
            } catch {
              // Fail-safe: listener errors do not break runner
            }
          }
        } else {
          this._consecutiveFailures += 1;
          this._consecutiveSuccesses = 0;
          const errorMsg =
            response.error?.message ?? "Heartbeat rejected by server.";
          this._lastError = errorMsg;

          if (this.onHeartbeatError) {
            try {
              this.onHeartbeatError({
                timestamp: this._lastHeartbeatAt,
                agentId: this.client.agentId,
                consecutiveFailures: this._consecutiveFailures,
                error: new Error(errorMsg),
              });
            } catch {
              // Fail-safe
            }
          }
        }
      } catch (err: unknown) {
        if (signal?.aborted) {
          return;
        }

        this._lastHeartbeatAt = Date.now();
        this._lastHeartbeatSuccess = false;
        this._consecutiveFailures += 1;
        this._consecutiveSuccesses = 0;

        const error =
          err instanceof Error
            ? err
            : new Error("Heartbeat communication error.");
        this._lastError = error.message;

        if (this.onHeartbeatError) {
          try {
            this.onHeartbeatError({
              timestamp: this._lastHeartbeatAt,
              agentId: this.client.agentId,
              consecutiveFailures: this._consecutiveFailures,
              error,
            });
          } catch {
            // Fail-safe
          }
        }

        // Re-throw if in STARTING state so start() fails closed
        if (this._status === "STARTING") {
          throw err;
        }
      }
    })();

    await this.activeHeartbeatPromise;
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.internalAbortController) {
      this.internalAbortController.abort();
      this.internalAbortController = null;
    }

    if (this.externalAbortCleanup) {
      this.externalAbortCleanup();
      this.externalAbortCleanup = null;
    }
  }

  private setStatus(newStatus: ComputerAgentRunnerStatus): void {
    const prev = this._status;
    if (prev === newStatus) return;

    this._status = newStatus;
    if (this.onStatusChange) {
      try {
        this.onStatusChange(newStatus, prev);
      } catch {
        // Fail-safe
      }
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      agentId: this.client.agentId,
      baseUrl: this.client.baseUrl,
      status: this._status,
      isRunning: this.isRunning,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      startedAt: this._startedAt,
      lastHeartbeatAt: this._lastHeartbeatAt,
      consecutiveSuccesses: this._consecutiveSuccesses,
      consecutiveFailures: this._consecutiveFailures,
    };
  }

  [Symbol.for("nodejs.util.inspect.custom")](): Record<string, unknown> {
    return this.toJSON();
  }
}
