import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { LocalComputerAgent } from "../../src/services/computer/agent/local-computer-agent";

const execFileAsync = promisify(execFile);

async function isProcessRunning(imageName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("tasklist", [
      "/FI",
      `IMAGENAME eq ${imageName}`,
    ]);
    return stdout.includes(imageName);
  } catch {
    return false;
  }
}

async function killProcess(imageName: string): Promise<void> {
  try {
    await execFileAsync("taskkill", ["/F", "/IM", imageName]);
  } catch {
    // Process already exited or not found
  }
}

async function waitForProcess(
  imageName: string,
  timeoutMs = 4000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isProcessRunning(imageName)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

describe("LocalComputerAgent", () => {
  it("reports the local agent as online", async () => {
    const agent = new LocalComputerAgent();

    const info = await agent.getInfo();

    expect(info.status).toBe("ONLINE");
    expect(info.platform).toBeTypeOf("string");
    expect(info.architecture).toBeTypeOf("string");
    expect(info.agentId).toContain("local-");

    expect(info.capabilities).toEqual({
      status: true,
      applications: os.platform() === "win32",
      files: true,
      browser: false,
    });
  });

  it(
    "discovers installed applications in the real runtime environment on Windows",
    async () => {
      if (os.platform() !== "win32") {
        return;
      }

      const agent = new LocalComputerAgent();
      const apps = await agent.listApplications();

      expect(Array.isArray(apps)).toBe(true);
      expect(apps.length).toBeGreaterThan(0);

      const firstApp = apps[0];
      expect(firstApp).toHaveProperty("name");
      expect(firstApp).toHaveProperty("appId");
      expect(typeof firstApp.name).toBe("string");
      expect(typeof firstApp.appId).toBe("string");
    },
    15_000,
  );

  it(
    "launches a real discovered packaged/UWP application and verifies observable process",
    async () => {
      if (os.platform() !== "win32") {
        return;
      }

      const agent = new LocalComputerAgent();
      const apps = await agent.listApplications();

      const calcApp = apps.find(
        (a) =>
          a.name.toLowerCase().includes("calc") ||
          a.appId.toLowerCase().includes("calculator"),
      );

      if (calcApp) {
        try {
          const result = await agent.launchApplication(calcApp.appId);
          expect(result.success).toBe(true);
          expect(result.appId).toBe(calcApp.appId);

          const observed =
            (await waitForProcess("CalculatorApp.exe", 6000)) ||
            (await waitForProcess("Calculator.exe", 6000));
          expect(observed).toBe(true);
        } finally {
          await killProcess("CalculatorApp.exe");
          await killProcess("Calculator.exe");
        }
      }
    },
    25_000,
  );

  it(
    "launches a real discovered Win32 executable application and verifies observable process",
    async () => {
      if (os.platform() !== "win32") {
        return;
      }

      const agent = new LocalComputerAgent();
      const apps = await agent.listApplications();

      // Look for Spotify or any discovered executable with an absolute path
      const win32App =
        apps.find((a) => a.name.toLowerCase().includes("spotify")) ??
        apps.find(
          (a) =>
            path.win32.isAbsolute(a.appId) &&
            a.appId.toLowerCase().endsWith(".exe"),
        );

      if (win32App) {
        const exeName = path.win32.basename(win32App.appId);
        try {
          const result = await agent.launchApplication(win32App.appId);
          expect(result.success).toBe(true);
          expect(result.appId).toBe(win32App.appId);

          const observed = await waitForProcess(exeName, 6000);
          expect(observed).toBe(true);
        } finally {
          await killProcess(exeName);
        }
      }
    },
    25_000,
  );
});
