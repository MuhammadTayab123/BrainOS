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
   * Callback invoked when a heartbeat ping completes successfully.
   */
  onHeartbeatSuccess?: (event: HeartbeatSuccessEvent) => void;

  /**
   * Callback invoked when a heartbeat ping fails.
   */
  onHeartbeatError?: (event: HeartbeatErrorEvent) => void;

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
}
