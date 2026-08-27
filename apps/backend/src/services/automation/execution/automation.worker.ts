import {
  AutomationActionType,
  AutomationTriggerType,
  TaskStatus,
} from "@prisma/client";

import { NotFoundError } from "../../../errors";
import { AutomationRepository } from "../repositories/automation.repository";

import { AutomationExecutionRepository } from "../repositories/automation-execution.repository";

import { TaskService } from "../../tasks/task.service";

import { ReminderService } from "../../reminders/reminder.service";

import {
  calculateNextRunAt,
  AutomationRecurrence,
} from "../automation.recurrence";

import { DueAutomation } from "../automation.types";

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 50;

export interface ProcessAutomationsOptions {
  now?: Date;
  limit?: number;
}

export interface ProcessAutomationsResult {
  found: number;
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}

export class AutomationWorker {
  constructor(
    private readonly automationRepository: AutomationRepository,
    private readonly executionRepository: AutomationExecutionRepository,
    private readonly taskService: TaskService,
    private readonly reminderService: ReminderService,
  ) {}

  async processDueAutomations(
    options: ProcessAutomationsOptions = {},
  ): Promise<ProcessAutomationsResult> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? DEFAULT_BATCH_SIZE;

    this.validateNow(now);
    this.validateLimit(limit);

    const automations = await this.automationRepository.findDueActive(
      now,
      limit,
    );

    const result: ProcessAutomationsResult = {
      found: automations.length,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const automation of automations) {
      const claimed = await this.automationRepository.claimDue(
        automation.id,
        now,
      );

      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      result.processed += 1;

      const execution = await this.executionRepository.createRunning(
        automation.id,
      );

      try {
        await this.execute(automation);

        await this.executionRepository.markSucceeded(execution.id, now);

        const recurrence = this.getRecurrence(automation.config);

        if (recurrence) {
          const nextRunAt = calculateNextRunAt(recurrence, now);

          await this.automationRepository.reschedule(
            automation.id,
            nextRunAt,
            now,
          );
        } else {
          await this.automationRepository.markCompleted(automation.id, now);
        }

        result.completed += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Automation execution failed.";

        await this.executionRepository.markFailed(execution.id, message, now);

        await this.automationRepository.markFailed(automation.id, now);

        result.failed += 1;
      }
    }

    return result;
  }

  async processTaskDueAutomations(
    options: ProcessAutomationsOptions = {},
  ): Promise<ProcessAutomationsResult> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? DEFAULT_BATCH_SIZE;

    this.validateNow(now);
    this.validateLimit(limit);

    const automations =
      await this.automationRepository.findActiveTaskDueAutomations(limit);

    const result: ProcessAutomationsResult = {
      found: automations.length,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const automation of automations) {
      const config = this.getObjectConfig(automation.config);

      const taskId = this.getRequiredString(
        config.taskId,
        "Task due automation taskId",
      );

      let task: Awaited<ReturnType<TaskService["getTask"]>> | undefined;

      let taskMissing = false;

      try {
        task = await this.taskService.getTask(taskId, automation.userId);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }

        taskMissing = true;
      }

      if (!taskMissing && task) {
        const isDue =
          task.status === TaskStatus.TODO &&
          task.dueAt !== null &&
          task.dueAt <= now;

        if (!isDue) {
          result.skipped += 1;
          continue;
        }
      }

      const claimed = await this.automationRepository.claimActiveTaskDue(
        automation.id,
        now,
      );

      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      result.processed += 1;

      const execution = await this.executionRepository.createRunning(
        automation.id,
      );

      if (taskMissing) {
        await this.executionRepository.markFailed(
          execution.id,
          "Referenced task was not found.",
          now,
        );

        await this.automationRepository.markFailed(automation.id, now);

        result.failed += 1;
        continue;
      }

      try {
        await this.execute(automation);

        await this.executionRepository.markSucceeded(execution.id, now);

        await this.automationRepository.markCompleted(automation.id, now);

        result.completed += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Automation execution failed.";

        await this.executionRepository.markFailed(execution.id, message, now);

        await this.automationRepository.markFailed(automation.id, now);

        result.failed += 1;
      }
    }

    return result;
  }

  private async execute(automation: DueAutomation): Promise<void> {
    if (
      automation.triggerType !== AutomationTriggerType.SCHEDULE &&
      automation.triggerType !== AutomationTriggerType.TASK_DUE
    ) {
      throw new Error(
        `Automation trigger type ${automation.triggerType} is not supported yet.`,
      );
    }

    switch (automation.actionType) {
      case AutomationActionType.CREATE_TASK:
        await this.executeCreateTask(automation);
        return;

      case AutomationActionType.CREATE_REMINDER:
        await this.executeCreateReminder(automation);
        return;

      default:
        throw new Error(
          `Automation action type ${automation.actionType} is not supported.`,
        );
    }
  }

  private async executeCreateTask(automation: DueAutomation): Promise<void> {
    const config = this.getObjectConfig(automation.config);

    const title = this.getRequiredString(config.title, "Automation task title");

    const description = this.getOptionalString(config.description);

    const dueAt = this.getOptionalDate(
      config.dueAt,
      "Automation task due time",
    );

    await this.taskService.createTask({
      userId: automation.userId,
      title,
      description,
      dueAt,
    });
  }

  private async executeCreateReminder(
    automation: DueAutomation,
  ): Promise<void> {
    const config = this.getObjectConfig(automation.config);

    const message = this.getRequiredString(
      config.message,
      "Automation reminder message",
    );

    const scheduledFor =
      this.getOptionalDate(
        config.scheduledFor,
        "Automation reminder scheduled time",
      ) ?? new Date();

    const taskId = this.getOptionalString(config.taskId);

    await this.reminderService.createReminder({
      userId: automation.userId,
      message,
      scheduledFor,
      taskId,
    });
  }

  private getRecurrence(config: unknown): AutomationRecurrence | undefined {
    const objectConfig = this.getObjectConfig(config);

    const recurrence = objectConfig.recurrence;

    if (recurrence === undefined) {
      return undefined;
    }

    if (
      recurrence === null ||
      typeof recurrence !== "object" ||
      Array.isArray(recurrence)
    ) {
      throw new Error("Automation recurrence must be an object.");
    }

    const value = recurrence as Record<string, unknown>;

    if (value.type === "DAILY") {
      return {
        type: "DAILY",
        hour: this.getRequiredInteger(value.hour, "Automation recurrence hour"),
        minute: this.getRequiredInteger(
          value.minute,
          "Automation recurrence minute",
        ),
      };
    }

    if (value.type === "WEEKLY") {
      return {
        type: "WEEKLY",
        dayOfWeek: this.getRequiredInteger(
          value.dayOfWeek,
          "Automation recurrence day",
        ),
        hour: this.getRequiredInteger(value.hour, "Automation recurrence hour"),
        minute: this.getRequiredInteger(
          value.minute,
          "Automation recurrence minute",
        ),
      };
    }

    throw new Error("Automation recurrence type must be DAILY or WEEKLY.");
  }

  private getObjectConfig(config: unknown): Record<string, unknown> {
    if (
      config === null ||
      typeof config !== "object" ||
      Array.isArray(config)
    ) {
      throw new Error("Automation config must be an object.");
    }

    return config as Record<string, unknown>;
  }

  private getRequiredString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${fieldName} is required.`);
    }

    return value.trim();
  }

  private getRequiredInteger(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(`${fieldName} must be an integer.`);
    }

    return value;
  }

  private getOptionalString(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(
        "Automation string configuration value must be a non-empty string.",
      );
    }

    return value.trim();
  }

  private getOptionalDate(value: unknown, fieldName: string): Date | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be an ISO date string.`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`${fieldName} must be a valid date.`);
    }

    return date;
  }

  private validateNow(now: Date): void {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
      throw new Error("Automation worker time must be a valid date.");
    }
  }

  private validateLimit(limit: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_SIZE) {
      throw new Error(
        `Automation worker limit must be an integer between 1 and ${MAX_BATCH_SIZE}.`,
      );
    }
  }
}
