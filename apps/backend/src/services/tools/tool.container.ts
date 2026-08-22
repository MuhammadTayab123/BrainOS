import { ToolRegistry } from "./tool.registry";
import { testTool } from "./test.tool";
import {
  createTaskTool,
  listTasksTool,
  completeTaskTool,
  deleteTaskTool,
} from "./task.tools";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(testTool);

  registry.register(createTaskTool);
  registry.register(listTasksTool);
  registry.register(completeTaskTool);
  registry.register(deleteTaskTool);

  return registry;
}