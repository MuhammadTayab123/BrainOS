
import {
  getComputerStatusTool,
  listComputerApplicationsTool,
  launchComputerApplicationTool,
  listComputerFilesTool,
} from "./computer.tools";

import { ToolRegistry } from "./tool.registry";
import { testTool } from "./test.tool";

import {
  createTaskTool,
  listTasksTool,
  getTaskTool,
  updateTaskTool,
  completeTaskTool,
  deleteTaskTool,
} from "./task.tools";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(testTool);

  registry.register(createTaskTool);
  registry.register(listTasksTool);
  registry.register(getTaskTool);
  registry.register(updateTaskTool);
  registry.register(completeTaskTool);
  registry.register(deleteTaskTool);

  registry.register(getComputerStatusTool);
registry.register(listComputerApplicationsTool);
registry.register(launchComputerApplicationTool);
registry.register(listComputerFilesTool);
  return registry;
}
