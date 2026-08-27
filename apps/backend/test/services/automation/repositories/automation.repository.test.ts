import { describe, expect, it, vi } from "vitest";

import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
} from "@prisma/client";

import { NotFoundError } from "../../../../src/errors";
import { AutomationRepository } from "../../../../src/services/automation/repositories/automation.repository";

describe("AutomationRepository", () => {
  it("creates an automation with the supplied data", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "automation-1",
      userId: "user-1",
      name: "Morning briefing",
      status: AutomationStatus.ACTIVE,
      triggerType: AutomationTriggerType.SCHEDULE,
      actionType: AutomationActionType.CREATE_REMINDER,
      config: {
        message: "Good morning",
      },
      nextRunAt: null,
      lastRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const db = {
      automation: {
        create,
      },
    } as any;

    const repository = new AutomationRepository(db);

    const nextRunAt = new Date("2026-08-27T08:00:00.000Z");

    await repository.create({
      userId: "user-1",
      name: "Morning briefing",
      triggerType: AutomationTriggerType.SCHEDULE,
      actionType: AutomationActionType.CREATE_REMINDER,
      config: {
        message: "Good morning",
      },
      nextRunAt,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: "user-1",
          name: "Morning briefing",
          triggerType: AutomationTriggerType.SCHEDULE,
          actionType: AutomationActionType.CREATE_REMINDER,
          config: {
            message: "Good morning",
          },
          nextRunAt,
        },
      }),
    );
  });

  it("lists active automations for a user", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const db = {
      automation: {
        findMany,
      },
    } as any;

    const repository = new AutomationRepository(db);

    await repository.listByUser({
      userId: "user-1",
      status: AutomationStatus.ACTIVE,
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          deletedAt: null,
          status: AutomationStatus.ACTIVE,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
    );
  });

  it("finds an automation owned by the user", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "automation-1",
      userId: "user-1",
    });

    const db = {
      automation: {
        findFirst,
      },
    } as any;

    const repository = new AutomationRepository(db);

    const result = await repository.findByIdForUser("automation-1", "user-1");

    expect(result).toEqual({
      id: "automation-1",
      userId: "user-1",
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "automation-1",
          userId: "user-1",
          deletedAt: null,
        },
      }),
    );
  });

  it("updates an automation owned by the user", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 1,
    });

    const db = {
      automation: {
        updateMany,
      },
    } as any;

    const repository = new AutomationRepository(db);

    await repository.updateByIdForUser("automation-1", "user-1", {
      status: AutomationStatus.PAUSED,
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "automation-1",
        userId: "user-1",
        deletedAt: null,
      },
      data: {
        status: AutomationStatus.PAUSED,
      },
    });
  });

  it("throws when updating a missing automation", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 0,
    });

    const db = {
      automation: {
        updateMany,
      },
    } as any;

    const repository = new AutomationRepository(db);

    await expect(
      repository.updateByIdForUser("missing", "user-1", {
        status: AutomationStatus.PAUSED,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("soft deletes an automation owned by the user", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 1,
    });

    const db = {
      automation: {
        updateMany,
      },
    } as any;

    const repository = new AutomationRepository(db);

    await repository.softDeleteByIdForUser("automation-1", "user-1");

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "automation-1",
          userId: "user-1",
          deletedAt: null,
        },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("throws when deleting a missing automation", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 0,
    });

    const db = {
      automation: {
        updateMany,
      },
    } as any;

    const repository = new AutomationRepository(db);

    await expect(
      repository.softDeleteByIdForUser("missing", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("finds due active automations", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const db = {
      automation: {
        findMany,
      },
    } as any;

    const repository = new AutomationRepository(db);

    const now = new Date("2026-08-27T10:00:00.000Z");

    await repository.findDueActive(now, 25);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          status: AutomationStatus.ACTIVE,
          nextRunAt: {
            lte: now,
          },
        },
        orderBy: {
          nextRunAt: "asc",
        },
        take: 25,
      }),
    );
  });
});
