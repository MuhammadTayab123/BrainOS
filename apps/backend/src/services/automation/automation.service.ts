import { NotFoundError } from "../../errors";

import { AutomationRepository } from "./repositories/automation.repository";

import {
  AutomationActionType,
  AutomationConfig,
  AutomationStatus,
  AutomationTriggerType,
  CreateAutomationInput,
  ListAutomationsOptions,
  UpdateAutomationInput,
} from "./automation.types";

import {
  AutomationRecurrence,
  calculateNextRunAt,
} from "./automation.recurrence";

const DEFAULT_AUTOMATION_LIST_LIMIT = 50;
const MAX_AUTOMATION_LIST_LIMIT = 50;

export class AutomationService {
  constructor(
    private readonly automationRepository: AutomationRepository,
  ) {}

  async createAutomation(input: CreateAutomationInput) {
    this.validateUserId(input.userId);
    this.validateName(input.name);
    this.validateTriggerType(input.triggerType);
    this.validateActionType(input.actionType);
    this.validateConfig(input.config);

    const config = this.applyTriggerSpecificConfig(
      input.triggerType,
      input.config,
    );

    const recurrence = this.getRecurrence(config);

    let nextRunAt = input.nextRunAt;

    /*
     * Scheduled recurring automations must have a next run
     * that actually matches their recurrence rule.
     *
     * The backend is authoritative here. We do not allow the
     * frontend to accidentally create:
     *
     *   Recurrence: Friday
     *   nextRunAt: Thursday
     */
    if (
      input.triggerType === AutomationTriggerType.SCHEDULE &&
      recurrence
    ) {
      if (nextRunAt === undefined) {
        nextRunAt = calculateNextRunAt(
          recurrence,
          new Date(),
        );
      } else {
        this.validateDate(
          nextRunAt,
          "Automation next run time",
        );

        this.validateNextRunMatchesRecurrence(
          nextRunAt,
          recurrence,
        );
      }
    } else if (nextRunAt !== undefined) {
      this.validateDate(
        nextRunAt,
        "Automation next run time",
      );
    }

    return this.automationRepository.create({
      userId: input.userId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      actionType: input.actionType,
      config,
      nextRunAt,
    });
  }

  async listAutomations(options: ListAutomationsOptions) {
    this.validateUserId(options.userId);

    const limit = options.limit ?? DEFAULT_AUTOMATION_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_AUTOMATION_LIST_LIMIT
    ) {
      throw new Error(
        `Automation list limit must be an integer between 1 and ${MAX_AUTOMATION_LIST_LIMIT}.`,
      );
    }

    return this.automationRepository.listByUser({
      ...options,
      limit,
    });
  }

  async getAutomation(
    automationId: string,
    userId: string,
  ) {
    this.validateUserId(userId);
    this.validateId(automationId, "Automation ID");

    const automation =
      await this.automationRepository.findByIdForUser(
        automationId,
        userId,
      );

    if (!automation) {
      throw new NotFoundError(
        "Automation not found for the authenticated user.",
      );
    }

    return automation;
  }

  async updateAutomation(
    automationId: string,
    userId: string,
    data: UpdateAutomationInput,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(automationId, "Automation ID");

    if (data.name !== undefined) {
      this.validateName(data.name);
    }

    if (data.config !== undefined) {
      this.validateConfig(data.config);
    }

    if (
      data.nextRunAt !== undefined &&
      data.nextRunAt !== null
    ) {
      this.validateDate(
        data.nextRunAt,
        "Automation next run time",
      );

      /*
       * If the update includes recurrence, make sure the
       * supplied next run matches it.
       */
      if (data.config !== undefined) {
        const recurrence = this.getRecurrence(
          data.config,
        );

        if (recurrence) {
          this.validateNextRunMatchesRecurrence(
            data.nextRunAt,
            recurrence,
          );
        }
      }
    }

    if (
      data.status === AutomationStatus.COMPLETED &&
      data.nextRunAt !== undefined &&
      data.nextRunAt !== null
    ) {
      throw new Error(
        "Completed automation cannot have a next run time.",
      );
    }

    await this.automationRepository.updateByIdForUser(
      automationId,
      userId,
      {
        ...data,
        name:
          data.name !== undefined
            ? data.name.trim()
            : undefined,
      },
    );
  }

  async pauseAutomation(
    automationId: string,
    userId: string,
  ): Promise<void> {
    await this.updateAutomation(
      automationId,
      userId,
      {
        status: AutomationStatus.PAUSED,
      },
    );
  }

  async resumeAutomation(
    automationId: string,
    userId: string,
  ): Promise<void> {
    await this.updateAutomation(
      automationId,
      userId,
      {
        status: AutomationStatus.ACTIVE,
      },
    );
  }

  async deleteAutomation(
    automationId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(
      automationId,
      "Automation ID",
    );

    await this.automationRepository.softDeleteByIdForUser(
      automationId,
      userId,
    );
  }

  private validateUserId(userId: string): void {
    if (
      !userId ||
      userId.trim().length === 0
    ) {
      throw new Error("User ID is required.");
    }
  }

  private validateId(
    value: string,
    fieldName: string,
  ): void {
    if (
      !value ||
      value.trim().length === 0
    ) {
      throw new Error(`${fieldName} is required.`);
    }
  }

  private validateName(name: string): void {
    if (
      !name ||
      name.trim().length === 0
    ) {
      throw new Error(
        "Automation name is required.",
      );
    }
  }

  private validateTriggerType(
    triggerType: AutomationTriggerType,
  ): void {
    if (
      !Object.values(
        AutomationTriggerType,
      ).includes(triggerType)
    ) {
      throw new Error(
        "Invalid automation trigger type.",
      );
    }
  }

  private validateActionType(
    actionType: AutomationActionType,
  ): void {
    if (
      !Object.values(
        AutomationActionType,
      ).includes(actionType)
    ) {
      throw new Error(
        "Invalid automation action type.",
      );
    }
  }

  private validateConfig(
    config: AutomationConfig,
  ): void {
    if (
      config === null ||
      typeof config !== "object" ||
      Array.isArray(config)
    ) {
      throw new Error(
        "Automation config must be an object.",
      );
    }
  }

  private applyTriggerSpecificConfig(
    triggerType: AutomationTriggerType,
    config: AutomationConfig,
  ): AutomationConfig {
    if (
      triggerType ===
      AutomationTriggerType.TASK_DUE
    ) {
      const taskId = config.taskId;

      if (
        typeof taskId !== "string" ||
        taskId.trim().length === 0
      ) {
        throw new Error(
          "Task due automation requires a valid taskId.",
        );
      }

      return {
        ...config,
        taskId: taskId.trim(),
      };
    }

    return config;
  }

  private getRecurrence(
    config: AutomationConfig,
  ): AutomationRecurrence | null {
    const recurrence = config.recurrence;

    if (
      recurrence === null ||
      typeof recurrence !== "object" ||
      Array.isArray(recurrence)
    ) {
      return null;
    }

    const value =
      recurrence as Record<string, unknown>;

    if (value.type === "DAILY") {
      if (
        typeof value.hour !== "number" ||
        typeof value.minute !== "number"
      ) {
        throw new Error(
          "Daily recurrence requires a valid hour and minute.",
        );
      }

      return {
        type: "DAILY",
        hour: value.hour,
        minute: value.minute,
      };
    }

    if (value.type === "WEEKLY") {
      if (
        typeof value.dayOfWeek !== "number" ||
        typeof value.hour !== "number" ||
        typeof value.minute !== "number"
      ) {
        throw new Error(
          "Weekly recurrence requires a valid day, hour, and minute.",
        );
      }

      return {
        type: "WEEKLY",
        dayOfWeek: value.dayOfWeek,
        hour: value.hour,
        minute: value.minute,
      };
    }

    return null;
  }

  private validateNextRunMatchesRecurrence(
    nextRunAt: Date,
    recurrence: AutomationRecurrence,
  ): void {
    if (recurrence.type === "DAILY") {
      if (
        nextRunAt.getHours() !== recurrence.hour ||
        nextRunAt.getMinutes() !== recurrence.minute
      ) {
        throw new Error(
          "Next run time does not match the daily recurrence.",
        );
      }

      return;
    }

    if (
      nextRunAt.getDay() !== recurrence.dayOfWeek ||
      nextRunAt.getHours() !== recurrence.hour ||
      nextRunAt.getMinutes() !== recurrence.minute
    ) {
      throw new Error(
        "Next run date/time does not match the weekly recurrence.",
      );
    }
  }

  private validateDate(
    value: Date,
    fieldName: string,
  ): void {
    if (
      !(value instanceof Date) ||
      Number.isNaN(value.getTime())
    ) {
      throw new Error(
        `${fieldName} must be a valid date.`,
      );
    }
  }
}