import { describe, expect, it } from "vitest";

import { getComputerStatusTool } from "../../src/services/tools/computer.tools";

describe("computer_get_status tool", () => {
  it("returns computer agent information", async () => {
    const result = await getComputerStatusTool.execute(
      {},
      {
        userId: "test-user",
      },
    );

    expect(result).toMatchObject({
      agentId: expect.stringContaining("local-"),
      status: "ONLINE",
      platform: expect.any(String),
      architecture: expect.any(String),
      capabilities: {
        status: true,
        applications: false,
        files: false,
        browser: false,
      },
    });
  });
});
