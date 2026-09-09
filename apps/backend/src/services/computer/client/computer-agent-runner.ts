import { ComputerAgent } from "../agent/computer-agent.types";
import { LocalComputerAgent } from "../agent/local-computer-agent";
import { ComputerAgentClient } from "./computer-agent-client";
import { ComputerAgentClientError } from "./computer-agent-client.types";
import {
  ComputerAgentRunnerConfig,
  ComputerAgentRunnerStartOptions,
  ComputerAgentRunnerState,
  ComputerAgentRunnerStatus,
  HostActionExecutor,
} from "./computer-agent-runner.types";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_HEARTBEAT_INTERVAL_MS = 100;
const DEFAULT_ACTION_POLL_INTERVAL_MS = 3_000;
const MIN_ACTION_POLL_INTERVAL_MS = 100;

/**
 * Default host-side action executor delegating to LocalComputerAgent.
 * Enforces strict allowlist of the 5 allowed computer actions and fails closed on unknown actions.
 */
export class DefaultHostActionExecutor implements HostActionExecutor {
  private readonly localAgent: ComputerAgent;

  constructor(localAgent?: ComputerAgent) {
    this.localAgent = localAgent ?? new LocalComputerAgent();
  }

  async executeAction(
    actionName: string,
    params?: unknown,
  ): Promise<unknown> {
    switch (actionName) {
      case "computer_list_applications":
        return this.localAgent.listApplications();

      case "computer_launch_application": {
        const appId = (params as { appId?: string } | undefined)?.appId;
        if (typeof appId !== "string" || !appId.trim()) {
          throw new Error("appId must be a non-empty string for computer_launch_application.");
        }
        return this.localAgent.launchApplication(appId.trim());
      }

      case "computer_list_files": {
        const filePath = (params as { path?: string } | undefined)?.path;
        return this.localAgent.listFiles(filePath);
      }

      case "computer_read_file": {
        const filePath = (params as { path?: string } | undefined)?.path;
        if (typeof filePath !== "string" || !filePath.trim()) {
          throw new Error("path must be a non-empty string for computer_read_file.");
        }
        return this.localAgent.readFile(filePath.trim());
      }

      case "computer_write_file": {
        const filePath = (params as { path?: string } | undefined)?.path;
        const content = (params as { content?: string } | undefined)?.content;
        if (typeof filePath !== "string" || !filePath.trim()) {
          throw new Error("path must be a non-empty string for computer_write_file.");
        }
        if (typeof content !== "string") {
          throw new Error("content must be a string for computer_write_file.");
        }
        return this.localAgent.writeFile(filePath.trim(), content);
      }

      default:
        throw new Error(`Unsupported computer action: "${actionName}".`);
    }
  }
}

/**
 * Standalone host agent lifecycle, periodic authenticated heartbeat runner,
 * and host-side action execution loop.
 *
 * Security & architectural guarantees:
 * - Operates strictly on runner lifecycle, heartbeat pings, and claimed action dispatch.
 * - Delegates host execution strictly to HostActionExecutor (defaulting to LocalComputerAgent).
 * - Does not execute arbitrary commands or duplicate backend authorization policies.
 * - Manages timers cleanly and supports AbortController cancellation.
 * - Prevents overlapping/duplicate heartbeat or action execution loops.
 * - Sanitizes errors and never leaks secret credentials.
 */
export class ComputerAgentRunner {
  public readonly client: ComputerAgentClient;
  public readonly heartbeatIntervalMs: number;
  public readonly actionPollingIntervalMs: number;
  public readonly actionPollingEnabled: boolean;
  public readonly actionExecutor: HostActionExecutor;

  private _status: ComputerAgentRunnerStatus = "STOPPED";
  private _startedAt: number | null = null;
  private _lastHeartbeatAt: number | null = null;
  private _lastHeartbeatSuccess: boolean | null = null;
  private _consecutiveSuccesses = 0;
  private _consecutiveFailures = 0;
  private _lastError: string | null = null;

  private _isActionExecuting = false;
  private _lastActionAt: number | null = null;
  private _totalActionsExecuted = 0;
  private _totalActionsSucceeded = 0;
  private _totalActionsFailed = 0;

  private heartbeatTimer: NodeJS.Timeout | null = null;
  private actionPollTimer: NodeJS.Timeout | null = null;
  private internalAbortController: AbortController | null = null;
  private activeHeartbeatPromise: Promise<void> | null = null;
  private activeActionPollPromise: Promise<void> | null = null;
  private activeExecutionPromise: Promise<void> | null = null;
  private externalAbortCleanup: (() => void) | null = null;

  private readonly onHeartbeatSuccess?: ComputerAgentRunnerConfig["onHeartbeatSuccess"];
  private readonly onHeartbeatError?: ComputerAgentRunnerConfig["onHeartbeatError"];
  private readonly onActionPollSuccess?: ComputerAgentRunnerConfig["onActionPollSuccess"];
  private readonly onActionPollError?: ComputerAgentRunnerConfig["onActionPollError"];
  private readonly onActionExecutionComplete?: ComputerAgentRunnerConfig["onActionExecutionComplete"];
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

    const hbInterval = config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    if (typeof hbInterval !== "number" || hbInterval < MIN_HEARTBEAT_INTERVAL_MS) {
      throw new ComputerAgentClientError({
        message: `Heartbeat interval must be at least ${MIN_HEARTBEAT_INTERVAL_MS}ms.`,
        statusCode: 400,
      });
    }
    this.heartbeatIntervalMs = hbInterval;

    const actionInterval = config.actionPollingIntervalMs ?? DEFAULT_ACTION_POLL_INTERVAL_MS;
    if (typeof actionInterval !== "number" || actionInterval < MIN_ACTION_POLL_INTERVAL_MS) {
      throw new ComputerAgentClientError({
        message: `Action polling interval must be at least ${MIN_ACTION_POLL_INTERVAL_MS}ms.`,
        statusCode: 400,
      });
    }
    this.actionPollingIntervalMs = actionInterval;

    this.actionPollingEnabled = config.actionPollingEnabled ?? true;
    this.actionExecutor = config.actionExecutor ?? new DefaultHostActionExecutor();

    this.onHeartbeatSuccess = config.onHeartbeatSuccess;
    this.onHeartbeatError = config.onHeartbeatError;
    this.onActionPollSuccess = config.onActionPollSuccess;
    this.onActionPollError = config.onActionPollError;
    this.onActionExecutionComplete = config.onActionExecutionComplete;
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
    const rawHbInterval = env.BRAINOS_AGENT_HEARTBEAT_INTERVAL_MS;
    if (!heartbeatIntervalMs && rawHbInterval && /^\d+$/.test(rawHbInterval.trim())) {
      heartbeatIntervalMs = Number.parseInt(rawHbInterval.trim(), 10);
    }

    let actionPollingIntervalMs = options?.actionPollingIntervalMs;
    const rawActionInterval =
      env.BRAINOS_AGENT_ACTION_POLL_INTERVAL_MS ??
      env.COMPUTER_AGENT_ACTION_POLL_INTERVAL_MS;
    if (!actionPollingIntervalMs && rawActionInterval && /^\d+$/.test(rawActionInterval.trim())) {
      actionPollingIntervalMs = Number.parseInt(rawActionInterval.trim(), 10);
    }

    let actionPollingEnabled = options?.actionPollingEnabled;
    const rawPollingEnabled =
      env.BRAINOS_AGENT_ACTION_POLLING_ENABLED ??
      env.COMPUTER_AGENT_ACTION_POLLING_ENABLED;
    if (actionPollingEnabled === undefined && rawPollingEnabled !== undefined) {
      actionPollingEnabled = rawPollingEnabled.trim().toLowerCase() !== "false";
    }

    return new ComputerAgentRunner({
      client,
      ...options,
      heartbeatIntervalMs,
      actionPollingIntervalMs,
      actionPollingEnabled,
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
      actionPollingEnabled: this.actionPollingEnabled,
      actionPollingIntervalMs: this.actionPollingIntervalMs,
      isActionExecuting: this._isActionExecuting,
      lastActionAt: this._lastActionAt,
      totalActionsExecuted: this._totalActionsExecuted,
      totalActionsSucceeded: this._totalActionsSucceeded,
      totalActionsFailed: this._totalActionsFailed,
    };
  }

  /**
   * Starts the host runner, executes an immediate authenticated ping, and schedules periodic heartbeats
   * and action polling.
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

      if (this.actionPollingEnabled) {
        this.scheduleNextActionPoll();
      }
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
   * Gracefully stops the runner and cancels any scheduled or pending heartbeats and action polling.
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

    // Wait for in-flight action poll/execution to finish if active
    if (this.activeActionPollPromise) {
      try {
        await this.activeActionPollPromise;
      } catch {
        // Ignore in-flight poll errors during graceful stop
      } finally {
        this.activeActionPollPromise = null;
      }
    }

    if (this.activeExecutionPromise) {
      try {
        await this.activeExecutionPromise;
      } catch {
        // Ignore in-flight execution errors during graceful stop
      } finally {
        this.activeExecutionPromise = null;
      }
    }

    this._isActionExecuting = false;
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

  private scheduleNextActionPoll(): void {
    if (this._status !== "RUNNING" || !this.actionPollingEnabled) {
      return;
    }

    this.actionPollTimer = setTimeout(async () => {
      if (this._status !== "RUNNING" || !this.actionPollingEnabled) {
        return;
      }

      // If an action is already executing locally, defer this poll tick
      if (this._isActionExecuting) {
        if (this._status === "RUNNING" && this.actionPollingEnabled) {
          this.scheduleNextActionPoll();
        }
        return;
      }

      try {
        await this.performActionPoll();
      } catch {
        // Fail-safe: handled in performActionPoll, safe to continue loop
      } finally {
        if (this._status === "RUNNING" && this.actionPollingEnabled) {
          this.scheduleNextActionPoll();
        }
      }
    }, this.actionPollingIntervalMs);
  }

  private async performActionPoll(): Promise<void> {
    const signal = this.internalAbortController?.signal;
    if (signal?.aborted || this._isActionExecuting) {
      return;
    }

    this.activeActionPollPromise = (async () => {
      try {
        const response = await this.client.pollAction({ signal });
        const now = Date.now();

        if (response.success && response.data) {
          const { hasAction, action } = response.data;

          if (hasAction && action) {
            if (this.onActionPollSuccess) {
              try {
                this.onActionPollSuccess({
                  timestamp: now,
                  agentId: this.client.agentId,
                  hasAction: true,
                  actionId: action.id,
                  actionName: action.actionName,
                });
              } catch {
                // Fail-safe
              }
            }

            // Claimed action successfully - execute locally on host
            await this.executeClaimedAction(action, signal);
          } else {
            if (this.onActionPollSuccess) {
              try {
                this.onActionPollSuccess({
                  timestamp: now,
                  agentId: this.client.agentId,
                  hasAction: false,
                });
              } catch {
                // Fail-safe
              }
            }
          }
        } else {
          const error = new Error(
            response.error?.message ?? "Action poll failed on server.",
          );
          if (this.onActionPollError) {
            try {
              this.onActionPollError({
                timestamp: now,
                agentId: this.client.agentId,
                error,
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

        const error =
          err instanceof Error
            ? err
            : new Error("Action poll communication error.");

        if (this.onActionPollError) {
          try {
            this.onActionPollError({
              timestamp: Date.now(),
              agentId: this.client.agentId,
              error,
            });
          } catch {
            // Fail-safe
          }
        }
      }
    })();

    await this.activeActionPollPromise;
  }

  private async executeClaimedAction(
    action: {
      id: string;
      correlationId: string;
      actionName: string;
      params?: unknown;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) {
      return;
    }

    this._isActionExecuting = true;

    this.activeExecutionPromise = (async () => {
      let success = false;
      let result: unknown = undefined;
      let errorMsg: string | undefined = undefined;

      try {
        if (signal?.aborted) {
          return;
        }

        result = await this.actionExecutor.executeAction(
          action.actionName,
          action.params,
        );
        success = true;
      } catch (err: unknown) {
        success = false;
        errorMsg =
          err instanceof Error ? err.message : "Local action execution failed.";
      }

      this._lastActionAt = Date.now();
      this._totalActionsExecuted += 1;
      if (success) {
        this._totalActionsSucceeded += 1;
      } else {
        this._totalActionsFailed += 1;
      }

      // Submit execution result back to BrainOS server
      if (!signal?.aborted) {
        try {
          await this.client.reportActionResult(
            {
              actionId: action.id,
              correlationId: action.correlationId,
              success,
              result,
              error: errorMsg,
            },
            { signal },
          );
        } catch (reportErr: unknown) {
          // Log or capture report error safely without crashing host runner
        }
      }

      if (this.onActionExecutionComplete) {
        try {
          this.onActionExecutionComplete({
            timestamp: this._lastActionAt,
            agentId: this.client.agentId,
            actionId: action.id,
            correlationId: action.correlationId,
            actionName: action.actionName,
            success,
            result,
            error: errorMsg,
          });
        } catch {
          // Fail-safe
        }
      }
    })();

    try {
      await this.activeExecutionPromise;
    } finally {
      this._isActionExecuting = false;
      this.activeExecutionPromise = null;
    }
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.actionPollTimer) {
      clearTimeout(this.actionPollTimer);
      this.actionPollTimer = null;
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
      actionPollingIntervalMs: this.actionPollingIntervalMs,
      actionPollingEnabled: this.actionPollingEnabled,
      isActionExecuting: this._isActionExecuting,
      startedAt: this._startedAt,
      lastHeartbeatAt: this._lastHeartbeatAt,
      lastActionAt: this._lastActionAt,
      consecutiveSuccesses: this._consecutiveSuccesses,
      consecutiveFailures: this._consecutiveFailures,
      totalActionsExecuted: this._totalActionsExecuted,
      totalActionsSucceeded: this._totalActionsSucceeded,
      totalActionsFailed: this._totalActionsFailed,
    };
  }

  [Symbol.for("nodejs.util.inspect.custom")](): Record<string, unknown> {
    return this.toJSON();
  }
}
