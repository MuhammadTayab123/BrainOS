import { ComputerService } from "../computer/computer.service";

import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const computerService = new ComputerService();

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
    return computerService.getStatus();
  },
};