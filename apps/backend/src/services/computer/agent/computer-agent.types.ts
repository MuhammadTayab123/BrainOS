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

export interface ComputerApplication {
  name: string;
  appId: string;
}

export interface ComputerFileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

export interface ComputerAgent {
  getInfo(): Promise<ComputerAgentInfo>;
  listApplications(): Promise<ComputerApplication[]>;
  launchApplication(appId: string): Promise<{
    success: boolean;
    appId: string;
  }>;
  listFiles(path?: string): Promise<ComputerFileEntry[]>;
}