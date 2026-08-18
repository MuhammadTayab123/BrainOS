import { ToolRegistry } from "./tool.registry";
import { testTool } from "./test.tool";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(testTool);

  return registry;
}