export interface ComputerAgentCliConfig {
  agentId: string;
  apiUrl: string;
  credential: string;
  heartbeatIntervalMs?: number;
  actionPollingIntervalMs?: number;
  actionPollingEnabled?: boolean;
  timeoutMs?: number;
}

export type ParseCliResult =
  | { type: "config"; config: ComputerAgentCliConfig }
  | { type: "help"; helpText: string }
  | { type: "version"; versionText: string };

export interface RunComputerAgentCliOptions {
  env?: NodeJS.ProcessEnv;
  stdout?: (msg: string) => void;
  stderr?: (msg: string) => void;
  fetch?: typeof fetch;
  shutdownTimeoutMs?: number;
  onRunnerCreated?: (runner: import("./computer-agent-runner").ComputerAgentRunner) => void;
  signalTarget?: {
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
  };
}
