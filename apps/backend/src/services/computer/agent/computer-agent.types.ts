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
export interface ComputerFileContent {
  path: string;
  content: string;
}
export interface ComputerFileWriteResult {
  path: string;
  success: boolean;
}

export interface ComputerAgent {

  getInfo(): Promise<ComputerAgentInfo>;
  listApplications(): Promise<ComputerApplication[]>;
  launchApplication(appId: string): Promise<{
    success: boolean;
    appId: string;
  }>;
  listFiles(path?: string): Promise<ComputerFileEntry[]>;
  readFile(path: string): Promise<ComputerFileContent>;
    writeFile(
    path: string,
    content: string,
  ): Promise<ComputerFileWriteResult>;
}