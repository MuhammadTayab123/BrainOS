import { describe, expect, it } from "vitest";

import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolRegistry } from "../../src/services/tools/tool.registry";
import {
  ToolDefinition,
} from "../../src/services/tools/tool.types";

describe("ToolExecutor computer authorization", () => {
  function createExecutor() {
    const registry = new ToolRegistry();

    const readTool: ToolDefinition = {
      name: "computer_read_file",
      description: "Read a file.",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        success: true,
      }),
    };

    const writeTool: ToolDefinition = {
      name: "computer_write_file",
      description: "Write a file.",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        success: true,
      }),
    };

    registry.register(readTool);
    registry.register(writeTool);

    return new ToolExecutor(registry);
  }

  it("allows read-only computer tools without authorization", async () => {
    const executor = createExecutor();

    await expect(
      executor.execute(
        "computer_read_file",
        {},
        {
          userId: "test-user",
        },
      ),
    ).resolves.toEqual({
      success: true,
    });
  });

  it("rejects computer actions without authorization", async () => {
    const executor = createExecutor();

    await expect(
      executor.execute(
        "computer_write_file",
        {},
        {
          userId: "test-user",
        },
      ),
    ).rejects.toThrow(
      'Computer action "computer_write_file" requires authorization.',
    );
  });

  it("allows an explicitly authorized computer action", async () => {
    const executor = createExecutor();

    await expect(
      executor.execute(
        "computer_write_file",
        {},
        {
          userId: "test-user",
          authorizedComputerActions: [
            "computer_write_file",
          ],
        },
      ),
    ).resolves.toEqual({
      success: true,
    });
  });

  it("does not affect non-computer tools", async () => {
    const registry = new ToolRegistry();

    const normalTool: ToolDefinition = {
      name: "test_tool",
      description: "Test tool.",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: async () => ({
        success: true,
      }),
    };

    registry.register(normalTool);

    const executor = new ToolExecutor(registry);

    await expect(
      executor.execute(
        "test_tool",
        {},
        {
          userId: "test-user",
        },
      ),
    ).resolves.toEqual({
      success: true,
    });
  });
});