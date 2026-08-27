import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  CreateAutomationInput,
  DueAutomation,
  ListAutomationsOptions,
  UpdateAutomationInput,
} from "../automation.types";

const automationSelect = {
  id: true,
  userId: true,
  name: true,
  status: true,
  triggerType: true,
  actionType: true,
  config: true,
  nextRunAt: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true,
};

export class AutomationRepository {
  constructor(private readonly db: DatabaseClient = prisma) {}

  async create(data: CreateAutomationInput) {
    return this.db.automation.create({
      data: {
        userId: data.userId,
        name: data.name,
        triggerType: data.triggerType,
        actionType: data.actionType,
        config: data.config,
        nextRunAt: data.nextRunAt,
      },
      select: automationSelect,
    });
  }
  async claimDue(automationId: string, now: Date): Promise<boolean> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        deletedAt: null,
        status: "ACTIVE",
        nextRunAt: {
          lte: now,
        },
      },
      data: {
        nextRunAt: null,
      },
    });

    return result.count === 1;
  }
  async markCompleted(automationId: string, lastRunAt: Date): Promise<void> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        deletedAt: null,
      },
      data: {
        status: "COMPLETED",
        lastRunAt,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError("Automation not found.");
    }
  }
  async reschedule(
    automationId: string,
    nextRunAt: Date,
    lastRunAt: Date,
  ): Promise<void> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        deletedAt: null,
        status: "ACTIVE",
        nextRunAt: null,
      },
      data: {
        nextRunAt,
        lastRunAt,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError("Active automation could not be rescheduled.");
    }
  }
  async markFailed(automationId: string, lastRunAt: Date): Promise<void> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        deletedAt: null,
      },
      data: {
        status: "FAILED",
        lastRunAt,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError("Automation not found.");
    }
  }

  async listByUser(options: ListAutomationsOptions) {
    const { userId, status, limit = 50 } = options;

    return this.db.automation.findMany({
      where: {
        userId,
        deletedAt: null,
        status,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: automationSelect,
    });
  }

  async findByIdForUser(automationId: string, userId: string) {
    return this.db.automation.findFirst({
      where: {
        id: automationId,
        userId,
        deletedAt: null,
      },
      select: automationSelect,
    });
  }

  async updateByIdForUser(
    automationId: string,
    userId: string,
    data: UpdateAutomationInput,
  ): Promise<void> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        userId,
        deletedAt: null,
      },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Automation not found for the authenticated user.",
      );
    }
  }

  async softDeleteByIdForUser(
    automationId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundError(
        "Automation not found for the authenticated user.",
      );
    }
  }

  async findDueActive(now: Date, limit = 50): Promise<DueAutomation[]> {
    return this.db.automation.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        nextRunAt: {
          lte: now,
        },
      },
      orderBy: {
        nextRunAt: "asc",
      },
      take: limit,
      select: {
        id: true,
        userId: true,
        name: true,
        status: true,
        triggerType: true,
        actionType: true,
        config: true,
        nextRunAt: true,
        lastRunAt: true,
      },
    });
  }
    async findActiveTaskDueAutomations(
    limit = 50,
  ): Promise<DueAutomation[]> {
    return this.db.automation.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        triggerType: "TASK_DUE",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
      select: {
        id: true,
        userId: true,
        name: true,
        status: true,
        triggerType: true,
        actionType: true,
        config: true,
        nextRunAt: true,
        lastRunAt: true,
      },
    });
  }

  async claimActiveTaskDue(
    automationId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.db.automation.updateMany({
      where: {
        id: automationId,
        deletedAt: null,
        status: "ACTIVE",
        triggerType: "TASK_DUE",
        claimedAt: null,
      },
      data: {
        claimedAt: now,
      },
    });

    return result.count === 1;
  }
}
