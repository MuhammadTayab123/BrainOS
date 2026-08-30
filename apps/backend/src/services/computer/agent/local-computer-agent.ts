import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
} from "./computer-agent.types";

const execFileAsync = promisify(execFile);

export class LocalComputerAgent implements ComputerAgent {
  async getInfo(): Promise<ComputerAgentInfo> {
    return {
      agentId: `local-${os.hostname()}`,
      status: "ONLINE",
      platform: os.platform(),
      architecture: os.arch(),
      capabilities: {
        status: true,
        applications: os.platform() === "win32",
        files: false,
        browser: false,
      },
    };
  }

  async listApplications(): Promise<ComputerApplication[]> {
    if (os.platform() !== "win32") {
      return [];
    }

    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress",
      ],
      {
        windowsHide: true,
      },
    );

    if (!stdout.trim()) {
      return [];
    }

    const parsed = JSON.parse(stdout) as
      | { Name: string; AppID: string }
      | { Name: string; AppID: string }[];

    const applications = Array.isArray(parsed)
      ? parsed
      : [parsed];

    return applications
      .filter(
        (application) =>
          typeof application.Name === "string" &&
          typeof application.AppID === "string",
      )
      .map((application) => ({
        name: application.Name,
        appId: application.AppID,
      }));
  }
}
