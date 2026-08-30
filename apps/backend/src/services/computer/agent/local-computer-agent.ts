import os from "node:os";

import {
  ComputerAgent,
  ComputerAgentInfo,
} from "./computer-agent.types";

export class LocalComputerAgent implements ComputerAgent {
  async getInfo(): Promise<ComputerAgentInfo> {
    return {
      agentId: `local-${os.hostname()}`,
      status: "ONLINE",
      platform: os.platform(),
      architecture: os.arch(),
      capabilities: {
        status: true,
        applications: false,
        files: false,
        browser: false,
      },
    };
  }
}
