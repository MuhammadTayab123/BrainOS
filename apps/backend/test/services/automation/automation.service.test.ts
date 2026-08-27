import { describe, expect, it, vi } from "vitest";

import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
} from "@prisma/client";

import { NotFoundError } from "../../../src/errors";
import { AutomationService } from "../../../src/services/automation/automation.service";

describe("AutomationService", () => {
  const createRepository = () => ({
    create: vi.fn().mockResolvedValue({
      id: "automation-1",
    }),
    listByUser: vi.fn().mockResolvedValue([]),
    findByIdForUser: vi.fn(),
    updateByIdForUser: vi.fn().mockResolvedValue(undefined),
    softDeleteByIdForUser: vi.fn().mockResolvedValue(undefined),
  });

  it("creates an automation with trimmed name", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await service.createAutomation({
      userId: "user-1",
      name: "  Morning reminder  ",
      triggerType: AutomationTriggerType.SCHEDULE,
      actionType: AutomationActionType.CREATE_REMINDER,
      config: {
        message: "Good morning",
      },
    });

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Morning reminder",
      triggerType: AutomationTriggerType.SCHEDULE,
      actionType: AutomationActionType.CREATE_REMINDER,
      config: {
        message: "Good morning",
      },
      nextRunAt: undefined,
    });
  });

  it("rejects a missing user ID", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await expect(
      service.createAutomation({
        userId: "",
        name: "Reminder",
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_REMINDER,
        config: {},
      }),
    ).rejects.toThrow("User ID is required.");
  });

  it("rejects an empty automation name", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await expect(
      service.createAutomation({
        userId: "user-1",
        name: "   ",
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_REMINDER,
        config: {},
      }),
    ).rejects.toThrow("Automation name is required.");
  });

  it("rejects an invalid next run date", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await expect(
      service.createAutomation({
        userId: "user-1",
        name: "Reminder",
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_REMINDER,
        config: {},
        nextRunAt: new Date("invalid"),
      }),
    ).rejects.toThrow("Automation next run time must be a valid date.");
  });

  it("lists automations using the default limit", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await service.listAutomations({
      userId: "user-1",
    });

    expect(repository.listByUser).toHaveBeenCalledWith({
      userId: "user-1",
      limit: 50,
    });
  });

  it("rejects a list limit above the maximum", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await expect(
      service.listAutomations({
        userId: "user-1",
        limit: 51,
      }),
    ).rejects.toThrow(
      "Automation list limit must be an integer between 1 and 50.",
    );
  });

  it("returns an owned automation", async () => {
    const repository = createRepository();

    repository.findByIdForUser.mockResolvedValue({
      id: "automation-1",
      userId: "user-1",
    });

    const service = new AutomationService(repository as any);

    const result = await service.getAutomation("automation-1", "user-1");

    expect(result).toEqual({
      id: "automation-1",
      userId: "user-1",
    });
  });

  it("throws when the automation does not exist", async () => {
    const repository = createRepository();

    repository.findByIdForUser.mockResolvedValue(null);

    const service = new AutomationService(repository as any);

    await expect(
      service.getAutomation("missing", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates an automation with a trimmed name", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await service.updateAutomation("automation-1", "user-1", {
      name: "  Updated automation  ",
      status: AutomationStatus.PAUSED,
    });

    expect(repository.updateByIdForUser).toHaveBeenCalledWith(
      "automation-1",
      "user-1",
      {
        name: "Updated automation",
        status: AutomationStatus.PAUSED,
      },
    );
  });

  it("pauses an automation", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await service.pauseAutomation("automation-1", "user-1");

    expect(repository.updateByIdForUser).toHaveBeenCalledWith(
      "automation-1",
      "user-1",
      {
        status: AutomationStatus.PAUSED,
      },
    );
  });

  it("resumes an automation", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await service.resumeAutomation("automation-1", "user-1");

    expect(repository.updateByIdForUser).toHaveBeenCalledWith(
      "automation-1",
      "user-1",
      {
        status: AutomationStatus.ACTIVE,
      },
    );
  });

  it("rejects a completed automation with a next run", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await expect(
      service.updateAutomation("automation-1", "user-1", {
        status: AutomationStatus.COMPLETED,
        nextRunAt: new Date(),
      }),
    ).rejects.toThrow("Completed automation cannot have a next run time.");
  });

  it("deletes an automation", async () => {
    const repository = createRepository();
    const service = new AutomationService(repository as any);

    await service.deleteAutomation("automation-1", "user-1");

    expect(repository.softDeleteByIdForUser).toHaveBeenCalledWith(
      "automation-1",
      "user-1",
    );
  });
});
