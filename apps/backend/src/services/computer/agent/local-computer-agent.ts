import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileContent,
  ComputerFileEntry,
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
        files: true,
        browser: false,
      },
    };
  }
    async listFiles(
    requestedPath?: string,
  ): Promise<ComputerFileEntry[]> {
    const homeDirectory = os.homedir();

    const targetPath = path.resolve(
      homeDirectory,
      requestedPath ?? ".",
    );

    const relativePath = path.relative(
      homeDirectory,
      targetPath,
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(
        "File access is restricted to the user home directory.",
      );
    }

    const entries = await readdir(targetPath, {
      withFileTypes: true,
    });

    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
      type: entry.isDirectory() ? "directory" : "file",
    }));
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

  async launchApplication(
    appId: string,
  ): Promise<{ success: boolean; appId: string }> {
    if (os.platform() !== "win32") {
      return {
        success: false,
        appId,
      };
    }

    if (
      typeof appId !== "string" ||
      appId.trim().length === 0
    ) {
      return {
        success: false,
        appId,
      };
    }

    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Start-Process explorer.exe -ArgumentList ('shell:AppsFolder\\' + $args[0])",
        appId,
      ],
      {
        windowsHide: true,
      },
    );

    return {
      success: true,
      appId,
    };
  }
      async readFile(
    requestedPath: string,
  ): Promise<ComputerFileContent> {
    const homeDirectory = os.homedir();

    if (
      typeof requestedPath !== "string" ||
      requestedPath.trim().length === 0
    ) {
      throw new Error("File path is required.");
    }

    const targetPath = path.resolve(
      homeDirectory,
      requestedPath,
    );

    const relativePath = path.relative(
      homeDirectory,
      targetPath,
    );

    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(
        "File access is restricted to the user home directory.",
      );
    }

    const fileContent = await readFile(
      targetPath,
      "utf8",
    );

    return {
      path: targetPath,
      content: fileContent,
    };
  }
}