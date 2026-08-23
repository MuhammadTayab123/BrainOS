import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  CreateReminderInput,
  ListRemindersOptions,
} from "../reminder.types";

export class ReminderRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(data: CreateReminderInput) {
    return this.db.reminder.create({
      data: {
        userId: data.userId,
        taskId: data.taskId,
        message: data.message,
        scheduledFor: data.scheduledFor,
      },
    });
  }

  async listByUser(
    options: ListRemindersOptions,
  ) {
    const {
      userId,
      status,
      dueBefore,
      limit = 50,
    } = options;

    return this.db.reminder.findMany({
      where: {
        userId,
        deletedAt: null,
        status,
        scheduledFor: dueBefore
          ? {
              lte: dueBefore,
            }
          : undefined,
      },
      orderBy: {
        scheduledFor: "asc",
      },
      take: limit,
    });
  }

  async findByIdForUser(
    reminderId: string,
    userId: string,
  ) {
    return this.db.reminder.findFirst({
      where: {
        id: reminderId,
        userId,
        deletedAt: null,
      },
    });
  }

  async markProcessing(
    reminderId: string,
  ): Promise<void> {
    const result =
      await this.db.reminder.updateMany({
        where: {
          id: reminderId,
          deletedAt: null,
          status: "PENDING",
        },
        data: {
          status: "PROCESSING",
          attempts: {
            increment: 1,
          },
        },
      });

    if (result.count === 0) {
      throw new NotFoundError(
        "Pending reminder not found.",
      );
    }
  }

  async markDelivered(
    reminderId: string,
  ): Promise<void> {
    const result =
      await this.db.reminder.updateMany({
        where: {
          id: reminderId,
          deletedAt: null,
          status: "PROCESSING",
        },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          lastError: null,
        },
      });

    if (result.count === 0) {
      throw new NotFoundError(
        "Processing reminder not found.",
      );
    }
  }

  async markFailed(
    reminderId: string,
    lastError: string,
  ): Promise<void> {
    const result =
      await this.db.reminder.updateMany({
        where: {
          id: reminderId,
          deletedAt: null,
          status: "PROCESSING",
        },
        data: {
          status: "FAILED",
          lastError,
        },
      });

    if (result.count === 0) {
      throw new NotFoundError(
        "Processing reminder not found.",
      );
    }
  }

  async cancel(
    reminderId: string,
    userId: string,
  ): Promise<void> {
    const result =
      await this.db.reminder.updateMany({
        where: {
          id: reminderId,
          userId,
          deletedAt: null,
          status: {
            in: [
              "PENDING",
              "PROCESSING",
            ],
          },
        },
        data: {
          status: "CANCELLED",
        },
      });

    if (result.count === 0) {
      throw new NotFoundError(
        "Active reminder not found for the authenticated user.",
      );
    }
  }

  async softDeleteByIdForUser(
    reminderId: string,
    userId: string,
  ): Promise<void> {
    const result =
      await this.db.reminder.updateMany({
        where: {
          id: reminderId,
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

    if (result.count === 0) {
      throw new NotFoundError(
        "Reminder not found for the authenticated user.",
      );
    }
  }
}