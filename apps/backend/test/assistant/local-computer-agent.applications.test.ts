import { describe, expect, it, vi } from "vitest";
import { LocalComputerAgent } from "../../src/services/computer/agent/local-computer-agent";

describe("LocalComputerAgent Application Management", () => {
  describe("listApplications", () => {
    it("lists applications on Windows using PowerShell Get-StartApps", async () => {
      const execRunner = vi.fn().mockResolvedValue({
        stdout: JSON.stringify([
          {
            Name: "Calculator",
            AppID: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
          },
          {
            Name: "Notepad",
            AppID: "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
          },
        ]),
        stderr: "",
      });

      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const applications = await agent.listApplications();

      expect(execRunner).toHaveBeenCalledWith(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress",
        ],
        { windowsHide: true },
      );

      expect(applications).toEqual([
        {
          name: "Calculator",
          appId: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App",
        },
        {
          name: "Notepad",
          appId: "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App",
        },
      ]);
    });

    it("returns an empty array on non-Windows platforms", async () => {
      const execRunner = vi.fn();
      const agent = new LocalComputerAgent({
        execRunner,
        platform: "linux",
      });

      const applications = await agent.listApplications();
      expect(applications).toEqual([]);
      expect(execRunner).not.toHaveBeenCalled();
    });
  });

  describe("launchApplication", () => {
    it("launches a packaged/UWP application through shell:AppsFolder", async () => {
      const execRunner = vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
      });

      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const appId = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App";
      const result = await agent.launchApplication(appId);

      expect(execRunner).toHaveBeenCalledTimes(1);
      const [file, args, options] = execRunner.mock.calls[0];

      expect(file).toBe("powershell.exe");
      expect(args[0]).toBe("-NoProfile");
      expect(args[1]).toBe("-NonInteractive");
      expect(args[2]).toBe("-EncodedCommand");
      expect(options).toEqual({ windowsHide: true });

      // Decode the Base64 UTF-16LE EncodedCommand to verify safety and syntax
      const decodedScript = Buffer.from(args[3], "base64").toString("utf16le");
      expect(decodedScript).toBe(
        'Start-Process explorer.exe -ArgumentList "shell:AppsFolder\\Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"',
      );

      expect(result).toEqual({
        success: true,
        appId,
      });
    });

    it("launches an absolute .exe path directly without shell:AppsFolder (Spotify-style)", async () => {
      const execRunner = vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
      });

      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const appId = "C:\\Users\\Laptop\\AppData\\Roaming\\Spotify\\Spotify.exe";
      const result = await agent.launchApplication(appId);

      expect(result.success).toBe(true);
      const decodedScript = Buffer.from(
        execRunner.mock.calls[0][1][3],
        "base64",
      ).toString("utf16le");

      expect(decodedScript).toBe(
        'Start-Process -FilePath "C:\\Users\\Laptop\\AppData\\Roaming\\Spotify\\Spotify.exe"',
      );
    });

    it("launches an absolute .lnk shortcut path directly", async () => {
      const execRunner = vi.fn().mockResolvedValue({
        stdout: "",
        stderr: "",
      });

      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const appId =
        "C:\\Users\\Laptop\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk";
      const result = await agent.launchApplication(appId);

      expect(result.success).toBe(true);
      const decodedScript = Buffer.from(
        execRunner.mock.calls[0][1][3],
        "base64",
      ).toString("utf16le");

      expect(decodedScript).toBe(
        'Start-Process -FilePath "C:\\Users\\Laptop\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk"',
      );
    });

    it("rejects empty or whitespace application IDs without calling process runner", async () => {
      const execRunner = vi.fn();
      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const emptyResult = await agent.launchApplication("");
      expect(emptyResult).toEqual({ success: false, appId: "" });

      const whitespaceResult = await agent.launchApplication("   ");
      expect(whitespaceResult).toEqual({ success: false, appId: "   " });

      expect(execRunner).not.toHaveBeenCalled();
    });

    it("rejects application IDs with shell metacharacters / injection attempts", async () => {
      const execRunner = vi.fn();
      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const maliciousAppIds = [
        "calc; rm -rf /",
        "calc | Start-Process cmd.exe",
        "calc & whoami",
        "calc`rm -rf`",
        "calc$env:PATH",
        "calc\nwhoami",
        'calc" -ArgumentList "',
        "calc' -ArgumentList '",
        "calc<input.txt",
        "calc>output.txt",
      ];

      for (const maliciousId of maliciousAppIds) {
        const result = await agent.launchApplication(maliciousId);
        expect(result.success).toBe(false);
      }

      expect(execRunner).not.toHaveBeenCalled();
    });

    it("handles execution failures gracefully without throwing", async () => {
      const execRunner = vi
        .fn()
        .mockRejectedValue(new Error("Process spawn error (0x80070002)"));

      const agent = new LocalComputerAgent({
        execRunner,
        platform: "win32",
      });

      const appId = "Microsoft.NonExistentApp!App";
      const result = await agent.launchApplication(appId);

      expect(result).toEqual({
        success: false,
        appId,
      });
    });

    it("returns success: false on non-Windows platforms without calling process runner", async () => {
      const execRunner = vi.fn();
      const agent = new LocalComputerAgent({
        execRunner,
        platform: "linux",
      });

      const result = await agent.launchApplication("calc");

      expect(result).toEqual({
        success: false,
        appId: "calc",
      });
      expect(execRunner).not.toHaveBeenCalled();
    });
  });
});
