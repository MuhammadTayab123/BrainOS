import { ComputerAgentGateway } from "../computer/agent/computer-agent.gateway";
import { LocalComputerAgent } from "../computer/agent/local-computer-agent";

import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const computerAgentGateway =
  new ComputerAgentGateway(
    new LocalComputerAgent(),
  );

export const getComputerStatusTool: ToolDefinition = {
  name: "computer_get_status",

  description:
    "Get safe, read-only information about the computer running BrainOS.",

  parameters: {
    type: "object",
    properties: {},
  },

  async execute(
    _input: unknown,
    _context: ToolContext,
  ) {
    return computerAgentGateway.getInfo();
  },
};