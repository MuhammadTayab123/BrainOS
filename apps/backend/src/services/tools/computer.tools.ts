import { ComputerAgentGateway } from "../computer/agent/computer-agent.gateway";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

export function createGetComputerStatusTool(
  gateway: ComputerAgentGateway,
): ToolDefinition {
  return {
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
      return gateway.getInfo();
    },
  };
}

export function createListComputerApplicationsTool(
  gateway: ComputerAgentGateway,
): ToolDefinition {
  return {
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
      return gateway.listApplications();
    },
  };
}

export function createLaunchComputerApplicationTool(
  gateway: ComputerAgentGateway,
): ToolDefinition {
  return {
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
        typeof (input as Record<string, unknown>).appId !== "string"
      ) {
        throw new Error("appId is required.");
      }

      return gateway.launchApplication(
        (input as Record<string, unknown>).appId as string,
      );
    },
  };
}

export function createListComputerFilesTool(
  gateway: ComputerAgentGateway,
): ToolDefinition {
  return {
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
          typeof (input as Record<string, unknown>).path !== "string"
        ) {
          throw new Error("path must be a string.");
        }

        requestedPath = (input as Record<string, unknown>).path as string;
      }

      return gateway.listFiles(
        requestedPath,
      );
    },
  };
}

export function createReadComputerFileTool(
  gateway: ComputerAgentGateway,
): ToolDefinition {
  return {
    name: "computer_read_file",

    description:
      "Read a UTF-8 text file inside the local user's home directory. Read-only.",

    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path to the text file relative to the user's home directory.",
        },
      },
      required: ["path"],
    },

    async execute(
      input: unknown,
      _context: ToolContext,
    ) {
      if (
        typeof input !== "object" ||
        input === null ||
        !("path" in input) ||
        typeof (input as Record<string, unknown>).path !== "string"
      ) {
        throw new Error("path is required.");
      }

      return gateway.readFile(
        (input as Record<string, unknown>).path as string,
      );
    },
  };
}

export function createWriteComputerFileTool(
  gateway: ComputerAgentGateway,
): ToolDefinition {
  return {
    name: "computer_write_file",

    description:
      "Write UTF-8 text content to a file inside the local user's home directory.",

    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Path to the file relative to the user's home directory.",
        },
        content: {
          type: "string",
          description:
            "UTF-8 text content to write to the file.",
        },
      },
      required: ["path", "content"],
    },

    async execute(
      input: unknown,
      _context: ToolContext,
    ) {
      if (
        typeof input !== "object" ||
        input === null ||
        !("path" in input) ||
        typeof (input as Record<string, unknown>).path !== "string"
      ) {
        throw new Error("path is required.");
      }

      if (
        !("content" in input) ||
        typeof (input as Record<string, unknown>).content !== "string"
      ) {
        throw new Error("content is required.");
      }

      return gateway.writeFile(
        (input as Record<string, unknown>).path as string,
        (input as Record<string, unknown>).content as string,
      );
    },
  };
}

export function createComputerTools(
  gateway: ComputerAgentGateway,
): ToolDefinition[] {
  return [
    createGetComputerStatusTool(gateway),
    createListComputerApplicationsTool(gateway),
    createLaunchComputerApplicationTool(gateway),
    createListComputerFilesTool(gateway),
    createReadComputerFileTool(gateway),
    createWriteComputerFileTool(gateway),
  ];
}