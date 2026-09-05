import { AutomationService } from "../automation/automation.service";
import { ComputerAgentGateway } from "../computer/agent/computer-agent.gateway";
import { LocalComputerAgent } from "../computer/agent/local-computer-agent";
import { MemoryService } from "../memory/memory.service";
import { ReminderService } from "../reminders/reminder.service";
import {
  createAutomationTools,
  createCreateAutomationTool,
  createDeleteAutomationTool,
  createGetAutomationTool,
  createListAutomationsTool,
  createUpdateAutomationTool,
} from "./automation.tools";
import { createComputerTools } from "./computer.tools";
import { DocumentRetrievalService } from "../documents/retrieval/document-retrieval.service";
import { DocumentService } from "../documents/document.service";
import {
  createDeleteDocumentTool,
  createDocumentSearchTool,
  createDocumentTools,
  createGetDocumentTool,
  createListDocumentsTool,
  documentSearchTool,
} from "./document.tools";
import {
  createDeleteMemoryTool,
  createGetMemoryTool,
  createListMemoriesTool,
  createMemoryTools,
  createSearchMemoriesTool,
  createStoreMemoryTool,
} from "./memory.tools";
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
  automationService?: AutomationService;
  computerAgentGateway?: ComputerAgentGateway;
  documentRetrievalService?: DocumentRetrievalService;
  documentService?: DocumentService;
  memoryService?: MemoryService;
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

  const documentTools =
    options.documentRetrievalService || options.documentService
      ? createDocumentTools(
          options.documentRetrievalService,
          options.documentService,
        )
      : [
          documentSearchTool,
          createListDocumentsTool(),
          createGetDocumentTool(),
          createDeleteDocumentTool(),
        ];

  for (const tool of documentTools) {
    registry.register(tool);
  }


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

  const memoryTools = options.memoryService
    ? createMemoryTools(options.memoryService)
    : [
        createStoreMemoryTool(),
        createSearchMemoriesTool(),
        createListMemoriesTool(),
        createGetMemoryTool(),
        createDeleteMemoryTool(),
      ];

  for (const tool of memoryTools) {
    registry.register(tool);
  }

  const automationTools = options.automationService
    ? createAutomationTools(options.automationService)
    : [
        createCreateAutomationTool(),
        createListAutomationsTool(),
        createGetAutomationTool(),
        createUpdateAutomationTool(),
        createDeleteAutomationTool(),
      ];

  for (const tool of automationTools) {
    registry.register(tool);
  }

  return registry;
}
