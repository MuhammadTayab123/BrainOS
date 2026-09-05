import { ComputerAgentGateway } from "../computer/agent/computer-agent.gateway";
import { LocalComputerAgent } from "../computer/agent/local-computer-agent";
import { ReminderService } from "../reminders/reminder.service";
import { createComputerTools } from "./computer.tools";
import { documentSearchTool } from "./document.tools";
import {
  createCancelReminderTool,
  createCreateReminderTool,
  createGetReminderTool,
  createListRemindersTool,
  createReminderTools,
} from "./reminder.tools";

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

export interface ToolContainerOptions {
  computerAgentGateway?: ComputerAgentGateway;
  reminderService?: ReminderService;
}

export function createToolRegistry(
  options: ToolContainerOptions = {},
): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(testTool);

  registry.register(createTaskTool);
  registry.register(listTasksTool);
  registry.register(getTaskTool);
  registry.register(updateTaskTool);
  registry.register(completeTaskTool);
  registry.register(deleteTaskTool);

  registry.register(documentSearchTool);

  const computerAgentGateway =
    options.computerAgentGateway ??
    new ComputerAgentGateway(new LocalComputerAgent());

  const computerTools = createComputerTools(computerAgentGateway);
  for (const tool of computerTools) {
    registry.register(tool);
  }

  const reminderTools = options.reminderService
    ? createReminderTools(options.reminderService)
    : [
        createCreateReminderTool(),
        createListRemindersTool(),
        createGetReminderTool(),
        createCancelReminderTool(),
      ];

  for (const tool of reminderTools) {
    registry.register(tool);
  }

  return registry;
}
