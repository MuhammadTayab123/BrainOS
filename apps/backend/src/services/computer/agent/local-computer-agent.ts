import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";

import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileContent,
  ComputerFileEntry,
  ComputerFileWriteResult,
} from "./computer-agent.types";

import { resolveSafeComputerPath } from "../security/computer-file-path";
import {
  MAX_COMPUTER_FILE_SIZE_BYTES,
} from "../security/computer-file-limits";

const execFileAsync = promisify(execFile);

export type ProcessRunner = (
  file: string,
  args: string[],
  options?: { windowsHide?: boolean },
) => Promise<{ stdout: string; stderr: string }>;

export interface LocalComputerAgentOptions {
  execRunner?: ProcessRunner;
  platform?: NodeJS.Platform;
}

const defaultExecRunner: ProcessRunner = async (file, args, opts) => {
  const result = await execFileAsync(file, args, {
    ...opts,
    encoding: "utf8",
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

export class LocalComputerAgent
  implements ComputerAgent
{
  private readonly execRunner: ProcessRunner;
  private readonly platform: NodeJS.Platform;

  constructor(options: LocalComputerAgentOptions = {}) {
    this.execRunner = options.execRunner ?? defaultExecRunner;
    this.platform = options.platform ?? os.platform();
  }

  async getInfo(): Promise<ComputerAgentInfo> {
    return {
      agentId: `local-${os.hostname()}`,
      status: "ONLINE",
      platform: this.platform,
      architecture: os.arch(),
      capabilities: {
        status: true,
        applications: this.platform === "win32",
        files: true,
        browser: false,
      },
    };
  }

  async listFiles(
    requestedPath?: string,
  ): Promise<ComputerFileEntry[]> {
    const targetPath =
      await resolveSafeComputerPath(
        requestedPath ?? ".",
      );

    const entries = await readdir(targetPath, {
      withFileTypes: true,
    });

    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
      type: entry.isDirectory()
        ? "directory"
        : "file",
    }));
  }

  async listApplications(): Promise<ComputerApplication[]> {
    if (this.platform !== "win32") {
      return [];
    }

    const { stdout } = await this.execRunner(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
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
    if (this.platform !== "win32") {
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
        appId: typeof appId === "string" ? appId : "",
      };
    }

    const cleanAppId = appId.trim();

    // Enforce strict character allowlist for Windows AppIDs, AUMIDs, and application paths
    // Reject any shell metacharacters (; & | ` $ " ' < > \n \r \0) and newlines
    if (!/^[a-zA-Z0-9_.!:\\ {}\-()]+$/.test(cleanAppId)) {
      return {
        success: false,
        appId: cleanAppId,
      };
    }

    const isAbsolutePath =
      /^[a-zA-Z]:[\\/]/.test(cleanAppId) ||
      cleanAppId.startsWith("\\\\") ||
      path.win32.isAbsolute(cleanAppId);

    const script = isAbsolutePath
      ? `Start-Process -FilePath "${cleanAppId}"`
      : `Start-Process explorer.exe -ArgumentList "shell:AppsFolder\\${cleanAppId}"`;
    const encodedCommand = Buffer.from(script, "utf16le").toString("base64");

    try {
      await this.execRunner(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          encodedCommand,
        ],
        {
          windowsHide: true,
        },
      );

      return {
        success: true,
        appId: cleanAppId,
      };
    } catch {
      return {
        success: false,
        appId: cleanAppId,
      };
    }
  }

  async readFile(
    requestedPath: string,
  ): Promise<ComputerFileContent> {
    const targetPath =
      await resolveSafeComputerPath(
        requestedPath,
      );

    const fileStats = await stat(targetPath);

    if (!fileStats.isFile()) {
      throw new Error(
        "The requested path is not a file.",
      );
    }

    if (
      fileStats.size >
      MAX_COMPUTER_FILE_SIZE_BYTES
    ) {
      throw new Error(
        "File exceeds the maximum allowed size.",
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

  async writeFile(
    requestedPath: string,
    content: string,
  ): Promise<ComputerFileWriteResult> {
    if (typeof content !== "string") {
      throw new Error(
        "File content must be a string.",
      );
    }

    const contentSize =
      Buffer.byteLength(content, "utf8");

    if (
      contentSize >
      MAX_COMPUTER_FILE_SIZE_BYTES
    ) {
      throw new Error(
        "File content exceeds the maximum allowed size.",
      );
    }

    const targetPath =
      await resolveSafeComputerPath(
        requestedPath,
      );

    try {
      const existingStats = await stat(
        targetPath,
      );

      if (!existingStats.isFile()) {
        throw new Error(
          "The requested path is not a file.",
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "The requested path is not a file."
      ) {
        throw error;
      }

      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }

    await writeFile(
      targetPath,
      content,
      "utf8",
    );

    return {
      path: targetPath,
      success: true,
    };
  }
}