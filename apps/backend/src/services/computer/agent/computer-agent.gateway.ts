import {
  ComputerAgent,
  ComputerAgentInfo,
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
}
