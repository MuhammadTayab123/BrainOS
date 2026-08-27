import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";

import { AutomationExecutionStatus } from "@prisma/client";

export class AutomationExecutionRepository {
  constructor(private readonly db: DatabaseClient = prisma) {}

  async createRunning(automationId: string) {
    return this.db.automationExecution.create({
      data: {
        automationId,
        status: AutomationExecutionStatus.RUNNING,
      },
    });
  }

  async markSucceeded(
    executionId: string,
    finishedAt: Date = new Date(),
  ): Promise<void> {
    await this.db.automationExecution.update({
      where: {
        id: executionId,
      },
      data: {
        status: AutomationExecutionStatus.SUCCEEDED,
        finishedAt,
        error: null,
      },
    });
  }

  async markFailed(
    executionId: string,
    error: string,
    finishedAt: Date = new Date(),
  ): Promise<void> {
    await this.db.automationExecution.update({
      where: {
        id: executionId,
      },
      data: {
        status: AutomationExecutionStatus.FAILED,
        finishedAt,
        error,
      },
    });
  }
}
