import { describe, expect, it } from "vitest";

import { LocalComputerAgent } from "../../src/services/computer/agent/local-computer-agent";

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
      applications: true,
      files: false,
      browser: false,
    });
  });
});
