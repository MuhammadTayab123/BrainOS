export type ComputerAgentStatus =
  | "ONLINE"
  | "OFFLINE"
  | "ERROR";

export interface ComputerAgentCapabilities {
  status: boolean;
  applications: boolean;
  files: boolean;
  browser: boolean;
}

export interface ComputerAgentInfo {
  agentId: string;
  status: ComputerAgentStatus;
  platform: string;
  architecture: string;
  capabilities: ComputerAgentCapabilities;
}

export interface ComputerAgent {
  getInfo(): Promise<ComputerAgentInfo>;
}
