import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileEntry,
} from "./computer-agent.types";

export class ComputerAgentGateway {
  constructor(
    private readonly agent: ComputerAgent,
  ) {}
   async listFiles(
    path?: string,
  ): Promise<ComputerFileEntry[]> {
    return this.agent.listFiles(path);
  }
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
    async readFile(path: string) {
    return this.agent.readFile(path);
  }
  async launchApplication(
    appId: string,
  ): Promise<{ success: boolean; appId: string }> {
    return this.agent.launchApplication(appId);
  }
}
