import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileEntry,
  ComputerFileWriteResult,
} from "./computer-agent.types";

export class ComputerAgentGateway {
  constructor(
    private readonly agent: ComputerAgent,
  ) {}

  async getInfo(): Promise<ComputerAgentInfo> {
    return this.agent.getInfo();
  }

  async isOnline(): Promise<boolean> {
    const info = await this.agent.getInfo();

    return info.status === "ONLINE";
  }

  async listApplications(): Promise<ComputerApplication[]> {
    return this.agent.listApplications();
  }

  async launchApplication(
    appId: string,
  ): Promise<{ success: boolean; appId: string }> {
    return this.agent.launchApplication(appId);
  }

  async listFiles(
    path?: string,
  ): Promise<ComputerFileEntry[]> {
    return this.agent.listFiles(path);
  }

  async readFile(path: string) {
    return this.agent.readFile(path);
  }
  async writeFile(
    path: string,
    content: string,
  ): Promise<ComputerFileWriteResult> {
    return this.agent.writeFile(path, content);
  }
}