import { ToolContext } from "../../tools/tool.types";
import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileContent,
  ComputerFileEntry,
  ComputerFileWriteResult,
} from "./computer-agent.types";

export class ComputerAgentGateway {
  constructor(
    protected readonly agent: ComputerAgent,
  ) {}

  async getInfo(_context?: ToolContext): Promise<ComputerAgentInfo> {
    return this.agent.getInfo();
  }

  async isOnline(context?: ToolContext): Promise<boolean> {
    const info = await this.getInfo(context);
    return info.status === "ONLINE";
  }

  async listApplications(_context?: ToolContext): Promise<ComputerApplication[]> {
    return this.agent.listApplications();
  }

  async launchApplication(
    appId: string,
    _context?: ToolContext,
  ): Promise<{ success: boolean; appId: string }> {
    return this.agent.launchApplication(appId);
  }

  async listFiles(
    path?: string,
    _context?: ToolContext,
  ): Promise<ComputerFileEntry[]> {
    return this.agent.listFiles(path);
  }

  async readFile(
    path: string,
    _context?: ToolContext,
  ): Promise<ComputerFileContent> {
    return this.agent.readFile(path);
  }

  async writeFile(
    path: string,
    content: string,
    _context?: ToolContext,
  ): Promise<ComputerFileWriteResult> {
    return this.agent.writeFile(path, content);
  }
}