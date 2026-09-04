import { describe, expect, it } from "vitest";

import { createGetComputerStatusTool } from "../../src/services/tools/computer.tools";
import { ComputerAgentGateway } from "../../src/services/computer/agent/computer-agent.gateway";
import { LocalComputerAgent } from "../../src/services/computer/agent/local-computer-agent";

describe("computer_get_status tool", () => {
  it("returns computer agent information using injected gateway", async () => {
    const gateway = new ComputerAgentGateway(new LocalComputerAgent());
    const tool = createGetComputerStatusTool(gateway);

    const result = await tool.execute(
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
        applications: true,
        files: true,
        browser: false,
      },
    });
  });
});
