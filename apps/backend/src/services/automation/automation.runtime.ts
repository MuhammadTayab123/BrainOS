import { TaskRepository } from "../tasks/repositories/task.repository";
import { TaskService } from "../tasks/task.service";

import { ReminderRepository } from "../reminders/repositories/reminder.repository";
import { ReminderService } from "../reminders/reminder.service";

import { AutomationRepository } from "./repositories/automation.repository";
import { AutomationExecutionRepository } from "./repositories/automation-execution.repository";

import { AutomationWorker } from "./execution/automation.worker";
import { AutomationScheduler } from "./automation.scheduler";

export function createAutomationScheduler(): AutomationScheduler {
  const taskRepository = new TaskRepository();

  const taskService = new TaskService(taskRepository);

  const reminderRepository = new ReminderRepository();

  const reminderService = new ReminderService(reminderRepository);

  const automationRepository = new AutomationRepository();

  const executionRepository = new AutomationExecutionRepository();

  const worker = new AutomationWorker(
    automationRepository,
    executionRepository,
    taskService,
    reminderService,
  );

  return new AutomationScheduler(worker);
}
