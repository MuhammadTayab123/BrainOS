import { ComputerAgentClient } from "./computer-agent-client";

/**
 * Lifecycle states of the Computer Agent Host Runner.
 */
export type ComputerAgentRunnerStatus =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "ERROR";

/**
 * Event data emitted upon successful heartbeat ping.
 */
export interface HeartbeatSuccessEvent {
  timestamp: number;
  agentId: string;
  consecutiveSuccesses: number;
  receivedAt?: number;
}

/**
 * Event data emitted upon heartbeat ping error.
 */
export interface HeartbeatErrorEvent {
  timestamp: number;
  agentId: string;
  consecutiveFailures: number;
  error: Error;
}

/**
 * Host-side action executor abstraction.
 * Executes claimed actions locally on the host machine.
 */
export interface HostActionExecutor {
  executeAction(
    actionName: string,
    params?: unknown,
  ): Promise<unknown>;
}

/**
 * Event data emitted when action polling completes.
 */
export interface ActionPollSuccessEvent {
  timestamp: number;
  agentId: string;
  hasAction: boolean;
  actionId?: string;
  actionName?: string;
}

/**
 * Event data emitted when action polling encounters an error.
 */
export interface ActionPollErrorEvent {
  timestamp: number;
  agentId: string;
  error: Error;
}

/**
 * Event data emitted when a local host action execution completes and reports back.
 */
export interface ActionExecutionCompleteEvent {
  timestamp: number;
  agentId: string;
  actionId: string;
  correlationId: string;
  actionName: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Configuration options for creating a ComputerAgentRunner.
 */
export interface ComputerAgentRunnerConfig {
  /**
   * Pre-configured ComputerAgentClient instance.
   */
  client: ComputerAgentClient;

  /**
   * Heartbeat interval in milliseconds (default: 30,000ms, minimum: 100ms).
   */
  heartbeatIntervalMs?: number;

  /**
   * Action polling interval in milliseconds (default: 3,000ms, minimum: 100ms).
   */
  actionPollingIntervalMs?: number;

  /**
   * Whether action polling loop is enabled (default: true).
   */
  actionPollingEnabled?: boolean;

  /**
   * Host-side action executor responsible for local execution.
   */
  actionExecutor?: HostActionExecutor;

  /**
   * Callback invoked when a heartbeat ping completes successfully.
   */
  onHeartbeatSuccess?: (event: HeartbeatSuccessEvent) => void;

  /**
   * Callback invoked when a heartbeat ping fails.
   */
  onHeartbeatError?: (event: HeartbeatErrorEvent) => void;

  /**
   * Callback invoked when an action poll completes.
   */
  onActionPollSuccess?: (event: ActionPollSuccessEvent) => void;

  /**
   * Callback invoked when an action poll fails.
   */
  onActionPollError?: (event: ActionPollErrorEvent) => void;

  /**
   * Callback invoked when an action is executed and reported.
   */
  onActionExecutionComplete?: (event: ActionExecutionCompleteEvent) => void;

  /**
   * Callback invoked whenever runner lifecycle status changes.
   */
  onStatusChange?: (
    status: ComputerAgentRunnerStatus,
    prevStatus: ComputerAgentRunnerStatus,
  ) => void;
}

/**
 * Options for starting the runner.
 */
export interface ComputerAgentRunnerStartOptions {
  /**
   * Optional external AbortSignal for cancellation/shutdown.
   */
  signal?: AbortSignal;

  /**
   * Whether to skip the initial immediate ping (default: false).
   */
  skipImmediatePing?: boolean;
}

/**
 * Runtime state snapshot of the ComputerAgentRunner.
 */
export interface ComputerAgentRunnerState {
  status: ComputerAgentRunnerStatus;
  isRunning: boolean;
  agentId: string;
  baseUrl: string;
  startedAt: number | null;
  lastHeartbeatAt: number | null;
  lastHeartbeatSuccess: boolean | null;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  lastError: string | null;
  actionPollingEnabled: boolean;
  actionPollingIntervalMs: number;
  isActionExecuting: boolean;
  lastActionAt: number | null;
  totalActionsExecuted: number;
  totalActionsSucceeded: number;
  totalActionsFailed: number;
}
