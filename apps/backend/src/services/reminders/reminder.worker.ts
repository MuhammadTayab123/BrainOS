import { NotFoundError } from "../../errors";

import { ReminderDeliveryProvider } from "./reminder.delivery";
import { ReminderRepository } from "./repositories/reminder.repository";

const DEFAULT_BATCH_SIZE = 50;

export interface ReminderWorkerResult {
  scanned: number;
  claimed: number;
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
    now: Date = new Date(),
    limit: number = DEFAULT_BATCH_SIZE,
  ): Promise<ReminderWorkerResult> {
    this.validateNow(now);
    this.validateLimit(limit);

    const reminders =
      await this.reminderRepository.findDuePending(
        now,
        limit,
      );

    const result: ReminderWorkerResult = {
      scanned: reminders.length,
      claimed: 0,
      delivered: 0,
      failed: 0,
      skipped: 0,
    };

    for (const reminder of reminders) {
      let claimed = false;

      try {
        await this.reminderRepository.markProcessing(
          reminder.id,
        );

        claimed = true;
        result.claimed += 1;
      } catch (error) {
        /*
         * Another worker may have claimed the same
         * reminder between findDuePending() and
         * markProcessing().
         *
         * In that case we simply skip it.
         */
        if (error instanceof NotFoundError) {
          result.skipped += 1;
          continue;
        }

        throw error;
      }

      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      try {
        await this.deliveryProvider.deliver(
          reminder,
        );

        await this.reminderRepository.markDelivered(
          reminder.id,
        );

        result.delivered += 1;
      } catch (error) {
        const lastError =
          this.getErrorMessage(error);

        try {
          await this.reminderRepository.markFailed(
            reminder.id,
            lastError,
          );
        } catch (markFailedError) {
          /*
           * Preserve the original delivery failure.
           * A secondary persistence failure should not
           * hide the actual delivery problem.
           */
          if (
            !(markFailedError instanceof NotFoundError)
          ) {
            throw markFailedError;
          }
        }

        result.failed += 1;
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
        "Worker execution time is required.",
      );
    }
  }

  private validateLimit(limit: number): void {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > DEFAULT_BATCH_SIZE
    ) {
      throw new Error(
        `Reminder worker batch size must be an integer between 1 and ${DEFAULT_BATCH_SIZE}.`,
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}