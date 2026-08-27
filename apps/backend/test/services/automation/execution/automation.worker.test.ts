import { describe, expect, it, vi } from "vitest";

import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
  TaskStatus,
} from "@prisma/client";
import { NotFoundError } from "../../../../src/errors";
import { AutomationWorker } from "../../../../src/services/automation/execution/automation.worker";

describe("AutomationWorker", () => {
  const now = new Date("2026-08-26T20:00:00.000Z");

  const createAutomationRepository = () => ({
    findDueActive: vi.fn(),
    claimDue: vi.fn(),
    findActiveTaskDueAutomations: vi.fn(),
    claimActiveTaskDue: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    reschedule: vi.fn(),
  });

  const createExecutionRepository = () => ({
    createRunning: vi.fn(),
    markSucceeded: vi.fn(),
    markFailed: vi.fn(),
  });

  const createTaskService = () => ({
    createTask: vi.fn(),
    getTask: vi.fn(),
  });

  const createReminderService = () => ({
    createReminder: vi.fn(),
  });

  const createAutomation = (overrides: Record<string, unknown> = {}) => ({
    id: "automation-1",
    userId: "user-1",
    name: "Test automation",
    status: AutomationStatus.ACTIVE,
    triggerType: AutomationTriggerType.SCHEDULE,
    actionType: AutomationActionType.CREATE_TASK,
    config: {
      title: "Generated task",
    },
    nextRunAt: now,
    lastRunAt: null,
    ...overrides,
  });

  it("creates a task and marks the automation completed", async () => {
    const automationRepository = createAutomationRepository();

    const executionRepository = createExecutionRepository();

    const taskService = createTaskService();

    const reminderService = createReminderService();

    automationRepository.findDueActive.mockResolvedValue([createAutomation()]);

    automationRepository.claimDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-1",
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processDueAutomations({
      now,
    });

    expect(taskService.createTask).toHaveBeenCalledWith({
      userId: "user-1",
      title: "Generated task",
      description: undefined,
      dueAt: undefined,
    });

    expect(executionRepository.markSucceeded).toHaveBeenCalledWith(
      "execution-1",
      now,
    );

    expect(automationRepository.markCompleted).toHaveBeenCalledWith(
      "automation-1",
      now,
    );

    expect(result).toEqual({
      found: 1,
      processed: 1,
      completed: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it("creates a reminder and marks the automation completed", async () => {
    const automationRepository = createAutomationRepository();

    const executionRepository = createExecutionRepository();

    const taskService = createTaskService();

    const reminderService = createReminderService();

    automationRepository.findDueActive.mockResolvedValue([
      createAutomation({
        actionType: AutomationActionType.CREATE_REMINDER,
        config: {
          message: "Take a break",
          scheduledFor: "2026-08-26T21:00:00.000Z",
        },
      }),
    ]);

    automationRepository.claimDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-2",
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processDueAutomations({
      now,
    });

    expect(reminderService.createReminder).toHaveBeenCalledWith({
      userId: "user-1",
      message: "Take a break",
      scheduledFor: new Date("2026-08-26T21:00:00.000Z"),
      taskId: undefined,
    });

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("marks execution and automation failed when action fails", async () => {
    const automationRepository = createAutomationRepository();

    const executionRepository = createExecutionRepository();

    const taskService = createTaskService();

    const reminderService = createReminderService();

    automationRepository.findDueActive.mockResolvedValue([createAutomation()]);

    automationRepository.claimDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-3",
    });

    taskService.createTask.mockRejectedValue(
      new Error("Task creation failed."),
    );

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processDueAutomations({
      now,
    });

    expect(executionRepository.markFailed).toHaveBeenCalledWith(
      "execution-3",
      "Task creation failed.",
      now,
    );

    expect(automationRepository.markFailed).toHaveBeenCalledWith(
      "automation-1",
      now,
    );

    expect(result).toEqual({
      found: 1,
      processed: 1,
      completed: 0,
      failed: 1,
      skipped: 0,
    });
  });

  it("skips an automation that another worker already claimed", async () => {
    const automationRepository = createAutomationRepository();

    const executionRepository = createExecutionRepository();

    const taskService = createTaskService();

    const reminderService = createReminderService();

    automationRepository.findDueActive.mockResolvedValue([createAutomation()]);

    automationRepository.claimDue.mockResolvedValue(false);

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processDueAutomations({
      now,
    });

    expect(result).toEqual({
      found: 1,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 1,
    });

    expect(executionRepository.createRunning).not.toHaveBeenCalled();

    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  it("rejects an invalid worker limit", async () => {
    const worker = new AutomationWorker(
      createAutomationRepository() as any,
      createExecutionRepository() as any,
      createTaskService() as any,
      createReminderService() as any,
    );

    await expect(
      worker.processDueAutomations({
        now,
        limit: 51,
      }),
    ).rejects.toThrow(
      "Automation worker limit must be an integer between 1 and 50.",
    );
  });

  it("rejects an invalid worker date", async () => {
    const worker = new AutomationWorker(
      createAutomationRepository() as any,
      createExecutionRepository() as any,
      createTaskService() as any,
      createReminderService() as any,
    );

    await expect(
      worker.processDueAutomations({
        now: new Date("invalid"),
      }),
    ).rejects.toThrow("Automation worker time must be a valid date.");
  });
  it("reschedules a recurring daily automation after successful execution", async () => {
    const automationRepository = createAutomationRepository();

    const executionRepository = createExecutionRepository();

    const taskService = createTaskService();

    const reminderService = createReminderService();

    automationRepository.findDueActive.mockResolvedValue([
      createAutomation({
        config: {
          title: "Daily planning",
          recurrence: {
            type: "DAILY",
            hour: 8,
            minute: 0,
          },
        },
      }),
    ]);

    automationRepository.claimDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-recurring-1",
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processDueAutomations({
      now,
    });

    expect(executionRepository.markSucceeded).toHaveBeenCalledWith(
      "execution-recurring-1",
      now,
    );

    expect(automationRepository.reschedule).toHaveBeenCalledWith(
      "automation-1",
      new Date("2026-08-27T08:00:00"),
      now,
    );

    expect(automationRepository.markCompleted).not.toHaveBeenCalled();

    expect(result).toEqual({
      found: 1,
      processed: 1,
      completed: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it("marks a recurring automation failed when recurrence configuration is invalid", async () => {
    const automationRepository = createAutomationRepository();

    const executionRepository = createExecutionRepository();

    const taskService = createTaskService();

    const reminderService = createReminderService();

    automationRepository.findDueActive.mockResolvedValue([
      createAutomation({
        config: {
          title: "Daily planning",
          recurrence: {
            type: "DAILY",
            hour: 24,
            minute: 0,
          },
        },
      }),
    ]);

    automationRepository.claimDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-recurring-2",
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processDueAutomations({
      now,
    });

    expect(executionRepository.markFailed).toHaveBeenCalledWith(
      "execution-recurring-2",
      "Automation recurrence hour must be between 0 and 23.",
      now,
    );

    expect(automationRepository.markFailed).toHaveBeenCalledWith(
      "automation-1",
      now,
    );

    expect(automationRepository.reschedule).not.toHaveBeenCalled();

    expect(result).toEqual({
      found: 1,
      processed: 1,
      completed: 0,
      failed: 1,
      skipped: 0,
    });
  });
  it("creates a task when a TASK_DUE automation fires", async () => {
    const automationRepository = createAutomationRepository();
    const executionRepository = createExecutionRepository();
    const taskService = createTaskService();
    const reminderService = createReminderService();

    automationRepository.findActiveTaskDueAutomations.mockResolvedValue([
      createAutomation({
        triggerType: AutomationTriggerType.TASK_DUE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {
          taskId: "task-1",
          title: "Follow up",
        },
        nextRunAt: null,
      }),
    ]);

    taskService.getTask.mockResolvedValue({
      id: "task-1",
      userId: "user-1",
      status: TaskStatus.TODO,
      dueAt: new Date("2026-08-26T19:00:00.000Z"),
    });

    automationRepository.claimActiveTaskDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-task-due-1",
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processTaskDueAutomations({
      now,
    });

    expect(taskService.createTask).toHaveBeenCalledWith({
      userId: "user-1",
      title: "Follow up",
      description: undefined,
      dueAt: undefined,
    });

    expect(executionRepository.markSucceeded).toHaveBeenCalledWith(
      "execution-task-due-1",
      now,
    );

    expect(automationRepository.markCompleted).toHaveBeenCalledWith(
      "automation-1",
      now,
    );

    expect(result).toEqual({
      found: 1,
      processed: 1,
      completed: 1,
      failed: 0,
      skipped: 0,
    });
  });

  it("skips a TASK_DUE automation when the task is not due", async () => {
    const automationRepository = createAutomationRepository();
    const executionRepository = createExecutionRepository();
    const taskService = createTaskService();
    const reminderService = createReminderService();

    automationRepository.findActiveTaskDueAutomations.mockResolvedValue([
      createAutomation({
        triggerType: AutomationTriggerType.TASK_DUE,
        config: {
          taskId: "task-1",
          title: "Follow up",
        },
        nextRunAt: null,
      }),
    ]);

    taskService.getTask.mockResolvedValue({
      id: "task-1",
      userId: "user-1",
      status: TaskStatus.TODO,
      dueAt: new Date("2026-08-26T21:00:00.000Z"),
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processTaskDueAutomations({
      now,
    });

    expect(result).toEqual({
      found: 1,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 1,
    });

    expect(automationRepository.claimActiveTaskDue).not.toHaveBeenCalled();
    expect(executionRepository.createRunning).not.toHaveBeenCalled();
  });

  it("skips a TASK_DUE automation when the task is completed", async () => {
    const automationRepository = createAutomationRepository();
    const executionRepository = createExecutionRepository();
    const taskService = createTaskService();
    const reminderService = createReminderService();

    automationRepository.findActiveTaskDueAutomations.mockResolvedValue([
      createAutomation({
        triggerType: AutomationTriggerType.TASK_DUE,
        config: {
          taskId: "task-1",
          title: "Follow up",
        },
        nextRunAt: null,
      }),
    ]);

    taskService.getTask.mockResolvedValue({
      id: "task-1",
      userId: "user-1",
      status: TaskStatus.COMPLETED,
      dueAt: new Date("2026-08-26T19:00:00.000Z"),
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processTaskDueAutomations({
      now,
    });

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);

    expect(automationRepository.claimActiveTaskDue).not.toHaveBeenCalled();
    expect(executionRepository.createRunning).not.toHaveBeenCalled();
  });

  it("fails a TASK_DUE automation when the referenced task is missing", async () => {
    const automationRepository = createAutomationRepository();
    const executionRepository = createExecutionRepository();
    const taskService = createTaskService();
    const reminderService = createReminderService();

    automationRepository.findActiveTaskDueAutomations.mockResolvedValue([
      createAutomation({
        triggerType: AutomationTriggerType.TASK_DUE,
        config: {
          taskId: "missing-task",
          title: "Follow up",
        },
        nextRunAt: null,
      }),
    ]);

    taskService.getTask.mockRejectedValue(new NotFoundError("Task not found."));

    automationRepository.claimActiveTaskDue.mockResolvedValue(true);

    executionRepository.createRunning.mockResolvedValue({
      id: "execution-task-due-2",
    });

    const worker = new AutomationWorker(
      automationRepository as any,
      executionRepository as any,
      taskService as any,
      reminderService as any,
    );

    const result = await worker.processTaskDueAutomations({
      now,
    });

    expect(executionRepository.markFailed).toHaveBeenCalledWith(
      "execution-task-due-2",
      "Referenced task was not found.",
      now,
    );

    expect(automationRepository.markFailed).toHaveBeenCalledWith(
      "automation-1",
      now,
    );

    expect(result).toEqual({
      found: 1,
      processed: 1,
      completed: 0,
      failed: 1,
      skipped: 0,
    });
  });
});
