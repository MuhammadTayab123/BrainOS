
import {
  getComputerStatusTool,
  listComputerApplicationsTool,
  launchComputerApplicationTool,
  listComputerFilesTool,
  readComputerFileTool,
  writeComputerFileTool,
} from "./computer.tools";
import { documentSearchTool } from "./document.tools";

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

  registry.register(documentSearchTool);

  registry.register(getComputerStatusTool);
  registry.register(listComputerApplicationsTool);
  registry.register(launchComputerApplicationTool);
  registry.register(listComputerFilesTool);
  registry.register(readComputerFileTool);
  registry.register(writeComputerFileTool);
  return registry;
}
