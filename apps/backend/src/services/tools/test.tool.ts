import { ToolDefinition } from "./tool.types";

export const testTool: ToolDefinition = {
  name: "test_tool",

  description: "A development tool used to verify BrainOS tool execution.",

  async execute(input, context) {
    return {
      success: true,
      message: "BrainOS tool execution is working.",
      input,
      userId: context.userId,
    };
  },
};