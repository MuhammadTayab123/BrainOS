import { NotFoundError } from "../../errors";

import { ReminderRepository } from "./repositories/reminder.repository";
import {
  ReminderDelivery,
  ReminderDeliveryProvider,
} from "./reminder-delivery.provider";

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 50;

export interface ProcessDueRemindersOptions {
  now?: Date;
  limit?: number;
}

export interface ProcessDueRemindersResult {
  found: number;
  processed: number;
  delivered: number;
  failed: number;
  skipped: number;
}

export class ReminderWorker {
  constructor(
    private readonly reminderRepository: ReminderRepository,
    private readonly deliveryProvider: ReminderDeliveryProvider,
  ) {}

  async processDueReminders(
    options: ProcessDueRemindersOptions = {},
  ): Promise<ProcessDueRemindersResult> {
    const now = options.now ?? new Date();
    const limit =
      options.limit ?? DEFAULT_BATCH_SIZE;

    this.validateNow(now);
    this.validateLimit(limit);

    const reminders =
      await this.reminderRepository.findDuePending(
        now,
        limit,
      );

    const result: ProcessDueRemindersResult = {
      found: reminders.length,
      processed: 0,
      delivered: 0,
      failed: 0,
      skipped: 0,
    };

    for (const reminder of reminders) {
      try {
        await this.reminderRepository.markProcessing(
          reminder.id,
        );
      } catch (error) {
        /*
         * Another worker may have claimed the reminder
         * between findDuePending() and markProcessing().
         */
        if (error instanceof NotFoundError) {
          result.skipped += 1;
          continue;
        }

        throw error;
      }

      result.processed += 1;

      const delivery: ReminderDelivery = {
        id: reminder.id,
        userId: reminder.userId,
        taskId: reminder.taskId,
        message: reminder.message,
        scheduledFor: reminder.scheduledFor,
      };

      try {
        await this.deliveryProvider.deliver(
          delivery,
        );

        await this.reminderRepository.markDelivered(
          reminder.id,
        );

        result.delivered += 1;
      } catch (error) {
        result.failed += 1;

        const lastError =
          error instanceof Error
            ? error.message
            : "Reminder delivery failed.";

        try {
          await this.reminderRepository.markFailed(
            reminder.id,
            lastError,
          );
        } catch {
          /*
           * Preserve the original delivery error.
           */
        }
      }
    }

    return result;
  }

  private validateNow(now: Date): void {
    if (
      !(now instanceof Date) ||
      Number.isNaN(now.getTime())
    ) {
      throw new Error(
        "Reminder worker time must be a valid date.",
      );
    }
  }

  private validateLimit(limit: number): void {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_BATCH_SIZE
    ) {
      throw new Error(
        `Reminder worker limit must be an integer between 1 and ${MAX_BATCH_SIZE}.`,
      );
    }
  }
}
