import { NotFoundError } from "../../errors";

import { AutomationRepository } from "./repositories/automation.repository";

import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
  CreateAutomationInput,
  ListAutomationsOptions,
  UpdateAutomationInput,
} from "./automation.types";

const DEFAULT_AUTOMATION_LIST_LIMIT = 50;
const MAX_AUTOMATION_LIST_LIMIT = 50;

export class AutomationService {
  constructor(private readonly automationRepository: AutomationRepository) {}

  async createAutomation(input: CreateAutomationInput) {
    this.validateUserId(input.userId);
    this.validateName(input.name);
    this.validateTriggerType(input.triggerType);
    this.validateActionType(input.actionType);
    this.validateConfig(input.config);

    if (input.nextRunAt !== undefined) {
      this.validateDate(input.nextRunAt, "Automation next run time");
    }

    return this.automationRepository.create({
      userId: input.userId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      actionType: input.actionType,
      config: input.config,
      nextRunAt: input.nextRunAt,
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

  async getAutomation(automationId: string, userId: string) {
    this.validateUserId(userId);
    this.validateId(automationId, "Automation ID");

    const automation = await this.automationRepository.findByIdForUser(
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

    if (data.nextRunAt !== undefined && data.nextRunAt !== null) {
      this.validateDate(data.nextRunAt, "Automation next run time");
    }

    if (
      data.status === AutomationStatus.COMPLETED &&
      data.nextRunAt !== undefined &&
      data.nextRunAt !== null
    ) {
      throw new Error("Completed automation cannot have a next run time.");
    }

    await this.automationRepository.updateByIdForUser(automationId, userId, {
      ...data,
      name: data.name !== undefined ? data.name.trim() : undefined,
    });
  }

  async pauseAutomation(automationId: string, userId: string): Promise<void> {
    await this.updateAutomation(automationId, userId, {
      status: AutomationStatus.PAUSED,
    });
  }

  async resumeAutomation(automationId: string, userId: string): Promise<void> {
    await this.updateAutomation(automationId, userId, {
      status: AutomationStatus.ACTIVE,
    });
  }

  async deleteAutomation(automationId: string, userId: string): Promise<void> {
    this.validateUserId(userId);
    this.validateId(automationId, "Automation ID");

    await this.automationRepository.softDeleteByIdForUser(automationId, userId);
  }

  private validateUserId(userId: string): void {
    if (!userId || userId.trim().length === 0) {
      throw new Error("User ID is required.");
    }
  }

  private validateId(value: string, fieldName: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error(`${fieldName} is required.`);
    }
  }

  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("Automation name is required.");
    }
  }

  private validateTriggerType(triggerType: AutomationTriggerType): void {
    if (!Object.values(AutomationTriggerType).includes(triggerType)) {
      throw new Error("Invalid automation trigger type.");
    }
  }

  private validateActionType(actionType: AutomationActionType): void {
    if (!Object.values(AutomationActionType).includes(actionType)) {
      throw new Error("Invalid automation action type.");
    }
  }

  private validateConfig(config: Record<string, unknown>): void {
    if (
      config === null ||
      typeof config !== "object" ||
      Array.isArray(config)
    ) {
      throw new Error("Automation config must be an object.");
    }
  }

  private validateDate(value: Date, fieldName: string): void {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid date.`);
    }
  }
}
