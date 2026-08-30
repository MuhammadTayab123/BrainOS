import { describe, expect, it, vi } from "vitest";

import { LocalComputerAgent } from "../../src/services/computer/agent/local-computer-agent";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (
        error: Error | null,
        result: { stdout: string; stderr: string },
      ) => void,
    ) => {
      callback(null, {
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
    },
  ),
}));

describe("LocalComputerAgent", () => {
  it("reports application discovery capability on Windows", async () => {
    const agent = new LocalComputerAgent();

    const info = await agent.getInfo();

    expect(info.capabilities.applications).toBe(true);
  });

  it("lists applications without launching them", async () => {
    const agent = new LocalComputerAgent();

    const applications = await agent.listApplications();

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
});
