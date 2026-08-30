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

export const listComputerApplicationsTool: ToolDefinition = {
  name: "computer_list_applications",

  description:
    "List applications installed or registered on the local computer.",

  parameters: {
    type: "object",
    properties: {},
  },

  async execute(
    _input: unknown,
    _context: ToolContext,
  ) {
    return computerAgentGateway.listApplications();
  },
};

export const launchComputerApplicationTool: ToolDefinition = {
  name: "computer_launch_application",

  description:
    "Launch a local application using its discovered application ID.",

  parameters: {
    type: "object",
    properties: {
      appId: {
        type: "string",
        description:
          "The application ID returned by computer_list_applications.",
      },
    },
    required: ["appId"],
  },

  async execute(
    input: unknown,
    _context: ToolContext,
  ) {
    if (
      typeof input !== "object" ||
      input === null ||
      !("appId" in input) ||
      typeof input.appId !== "string"
    ) {
      throw new Error("appId is required.");
    }

    return computerAgentGateway.launchApplication(
      input.appId,
    );
  },
};
export const listComputerFilesTool: ToolDefinition = {
  name: "computer_list_files",

  description:
    "List files and directories inside the local user's home directory. Read-only.",

  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Optional path relative to the user's home directory.",
      },
    },
  },

  async execute(
    input: unknown,
    _context: ToolContext,
  ) {
    if (
      input !== undefined &&
      input !== null &&
      typeof input !== "object"
    ) {
      throw new Error("Input must be an object.");
    }

    let requestedPath: string | undefined;

    if (
      typeof input === "object" &&
      input !== null &&
      "path" in input
    ) {
      if (
        typeof input.path !== "string"
      ) {
        throw new Error("path must be a string.");
      }

      requestedPath = input.path;
    }

    return computerAgentGateway.listFiles(
      requestedPath,
    );
  },
};