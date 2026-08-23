import { NotFoundError } from "../../errors";

import { ReminderRepository } from "./repositories/reminder.repository";
import {
  CreateReminderInput,
  ListRemindersOptions,
  UpdateReminderFailureData,
} from "./reminder.types";

const MAX_REMINDER_LIST_LIMIT = 50;

export class ReminderService {
  constructor(
    private readonly reminderRepository: ReminderRepository,
  ) {}

  async createReminder(
    input: CreateReminderInput,
  ) {
    this.validateUserId(input.userId);
    this.validateMessage(input.message);
    this.validateScheduledFor(
      input.scheduledFor,
    );

    if (input.taskId !== undefined) {
      this.validateId(
        input.taskId,
        "Task ID",
      );
    }

    return this.reminderRepository.create({
      userId: input.userId,
      taskId: input.taskId,
      message: input.message.trim(),
      scheduledFor: input.scheduledFor,
    });
  }

  async listReminders(
    options: ListRemindersOptions,
  ) {
    this.validateUserId(options.userId);

    const limit =
      options.limit ??
      MAX_REMINDER_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_REMINDER_LIST_LIMIT
    ) {
      throw new Error(
        `Reminder list limit must be an integer between 1 and ${MAX_REMINDER_LIST_LIMIT}.`,
      );
    }

    return this.reminderRepository.listByUser({
      ...options,
      limit,
    });
  }

  async getReminder(
    reminderId: string,
    userId: string,
  ) {
    this.validateUserId(userId);
    this.validateId(
      reminderId,
      "Reminder ID",
    );

    const reminder =
      await this.reminderRepository.findByIdForUser(
        reminderId,
        userId,
      );

    if (!reminder) {
      throw new NotFoundError(
        "Reminder not found for the authenticated user.",
      );
    }

    return reminder;
  }

  async markProcessing(
    reminderId: string,
  ): Promise<void> {
    this.validateId(
      reminderId,
      "Reminder ID",
    );

    await this.reminderRepository.markProcessing(
      reminderId,
    );
  }

  async markDelivered(
    reminderId: string,
  ): Promise<void> {
    this.validateId(
      reminderId,
      "Reminder ID",
    );

    await this.reminderRepository.markDelivered(
      reminderId,
    );
  }

  async markFailed(
    reminderId: string,
    data: UpdateReminderFailureData,
  ): Promise<void> {
    this.validateId(
      reminderId,
      "Reminder ID",
    );

    if (
      !data.lastError ||
      data.lastError.trim().length === 0
    ) {
      throw new Error(
        "Reminder failure error is required.",
      );
    }

    await this.reminderRepository.markFailed(
      reminderId,
      data.lastError.trim(),
    );
  }

  async cancelReminder(
    reminderId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(
      reminderId,
      "Reminder ID",
    );

    await this.reminderRepository.cancel(
      reminderId,
      userId,
    );
  }

  async deleteReminder(
    reminderId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(
      reminderId,
      "Reminder ID",
    );

    await this.reminderRepository.softDeleteByIdForUser(
      reminderId,
      userId,
    );
  }

  private validateUserId(
    userId: string,
  ): void {
    if (
      !userId ||
      userId.trim().length === 0
    ) {
      throw new Error(
        "User ID is required.",
      );
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
      throw new Error(
        `${fieldName} is required.`,
      );
    }
  }

  private validateMessage(
    message: string,
  ): void {
    if (
      !message ||
      message.trim().length === 0
    ) {
      throw new Error(
        "Reminder message is required.",
      );
    }
  }

  private validateScheduledFor(
    scheduledFor: Date,
  ): void {
    if (
      !(scheduledFor instanceof Date) ||
      Number.isNaN(
        scheduledFor.getTime(),
      )
    ) {
      throw new Error(
        "Reminder scheduled time is required.",
      );
    }
  }
}