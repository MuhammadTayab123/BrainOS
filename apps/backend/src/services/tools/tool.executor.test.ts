import { describe, expect, it } from "vitest";

import { ToolExecutor } from "./tool.executor";
import { ToolRegistry } from "./tool.registry";
import { testTool } from "./test.tool";

describe("ToolExecutor", () => {
  it("executes a registered tool", async () => {
    const registry = new ToolRegistry();

    registry.register(testTool);

    const executor = new ToolExecutor(registry);

    const result = await executor.execute(
      "test_tool",
      { hello: "BrainOS" },
      { userId: "test-user" },
    );

    expect(result).toEqual({
      success: true,
      message: "BrainOS tool execution is working.",
      input: { hello: "BrainOS" },
      userId: "test-user",
    });
  });

  it("throws when the tool is not registered", async () => {
    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry);

    await expect(
      executor.execute(
        "missing_tool",
        {},
        { userId: "test-user" },
      ),
    ).rejects.toThrow(
      'Tool "missing_tool" is not registered.',
    );
  });
});