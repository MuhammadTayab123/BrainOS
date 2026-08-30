import { describe, expect, it, vi } from "vitest";

import { ComputerAgentGateway } from "../../src/services/computer/agent/computer-agent.gateway";
import {
  ComputerAgent,
  ComputerAgentInfo,
} from "../../src/services/computer/agent/computer-agent.types";

const agentInfo: ComputerAgentInfo = {
  agentId: "local-test",
  status: "ONLINE",
  platform: "win32",
  architecture: "x64",
  capabilities: {
    status: true,
    applications: false,
    files: false,
    browser: false,
  },
};

describe("ComputerAgentGateway", () => {
  it("returns information from the computer agent", async () => {
    const agent: ComputerAgent = {
      getInfo: vi.fn().mockResolvedValue(agentInfo),
    };

    const gateway = new ComputerAgentGateway(agent);

    await expect(gateway.getInfo()).resolves.toEqual(
      agentInfo,
    );

    expect(agent.getInfo).toHaveBeenCalledTimes(1);
  });

  it("reports the agent as online", async () => {
    const agent: ComputerAgent = {
      getInfo: vi.fn().mockResolvedValue(agentInfo),
    };

    const gateway = new ComputerAgentGateway(agent);

    await expect(gateway.isOnline()).resolves.toBe(true);
  });

  it("reports the agent as offline", async () => {
    const offlineInfo: ComputerAgentInfo = {
      ...agentInfo,
      status: "OFFLINE",
    };

    const agent: ComputerAgent = {
      getInfo: vi.fn().mockResolvedValue(offlineInfo),
    };

    const gateway = new ComputerAgentGateway(agent);

    await expect(gateway.isOnline()).resolves.toBe(false);
  });

  it("propagates agent errors", async () => {
    const agentError = new Error(
      "Computer agent unavailable.",
    );

    const agent: ComputerAgent = {
      getInfo: vi.fn().mockRejectedValue(agentError),
    };

    const gateway = new ComputerAgentGateway(agent);

    await expect(gateway.getInfo()).rejects.toThrow(
      "Computer agent unavailable.",
    );

    await expect(gateway.isOnline()).rejects.toThrow(
      "Computer agent unavailable.",
    );
  });
});
