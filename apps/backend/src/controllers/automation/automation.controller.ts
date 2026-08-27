import { Request, Response } from "express";

import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
} from "@prisma/client";

import { AutomationService } from "../../services/automation/automation.service";
import { AutomationRepository } from "../../services/automation/repositories/automation.repository";

const automationService = new AutomationService(new AutomationRepository());

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  });
}

function getId(req: Request): string | null {
  const rawId = req.params.id;

  if (typeof rawId !== "string") {
    return null;
  }

  const id = rawId.trim();

  return id.length > 0 ? id : null;
}

function parseDate(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

export async function createAutomation(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { name, triggerType, actionType, config, nextRunAt } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_NAME",
        message: "Automation name is required.",
      },
    });
  }

  if (!Object.values(AutomationTriggerType).includes(triggerType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TRIGGER_TYPE",
        message: "Invalid automation trigger type.",
      },
    });
  }

  if (!Object.values(AutomationActionType).includes(actionType)) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ACTION_TYPE",
        message: "Invalid automation action type.",
      },
    });
  }

  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONFIG",
        message: "Automation config must be an object.",
      },
    });
  }

  let parsedNextRunAt: Date | undefined;

  try {
    parsedNextRunAt = parseDate(nextRunAt, "Automation next run time");
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_NEXT_RUN_AT",
        message:
          error instanceof Error
            ? error.message
            : "Automation next run time must be a valid date.",
      },
    });
  }

  const automation = await automationService.createAutomation({
    userId: req.user.id,
    name: name.trim(),
    triggerType,
    actionType,
    config,
    nextRunAt: parsedNextRunAt,
  });

  return res.status(201).json({
    success: true,
    data: automation,
  });
}

export async function listAutomations(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const rawLimit = req.query.limit;
  const rawStatus = req.query.status;

  let limit: number | undefined;

  if (rawLimit !== undefined) {
    if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: "Limit must be an integer between 1 and 50.",
        },
      });
    }

    limit = Number.parseInt(rawLimit, 10);

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: "Limit must be an integer between 1 and 50.",
        },
      });
    }
  }

  let status: AutomationStatus | undefined;

  if (rawStatus !== undefined) {
    if (
      typeof rawStatus !== "string" ||
      !Object.values(AutomationStatus).includes(rawStatus as AutomationStatus)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Invalid automation status.",
        },
      });
    }

    status = rawStatus as AutomationStatus;
  }

  const automations = await automationService.listAutomations({
    userId: req.user.id,
    status,
    limit,
  });

  return res.status(200).json({
    success: true,
    data: automations,
  });
}

export async function getAutomationById(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const automationId = getId(req);

  if (!automationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AUTOMATION_ID",
        message: "Automation ID is required.",
      },
    });
  }

  const automation = await automationService.getAutomation(
    automationId,
    req.user.id,
  );

  return res.status(200).json({
    success: true,
    data: automation,
  });
}

export async function updateAutomation(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const automationId = getId(req);

  if (!automationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AUTOMATION_ID",
        message: "Automation ID is required.",
      },
    });
  }

  const { name, status, config, nextRunAt } = req.body;

  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_NAME",
        message: "Automation name must be a non-empty string.",
      },
    });
  }

  if (
    status !== undefined &&
    !Object.values(AutomationStatus).includes(status)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATUS",
        message: "Invalid automation status.",
      },
    });
  }

  if (
    config !== undefined &&
    (config === null || typeof config !== "object" || Array.isArray(config))
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONFIG",
        message: "Automation config must be an object.",
      },
    });
  }

  let parsedNextRunAt: Date | null | undefined;

  if (nextRunAt === null) {
    parsedNextRunAt = null;
  } else if (nextRunAt !== undefined) {
    try {
      parsedNextRunAt = parseDate(nextRunAt, "Automation next run time");
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_NEXT_RUN_AT",
          message:
            error instanceof Error
              ? error.message
              : "Automation next run time must be a valid date.",
        },
      });
    }
  }

  await automationService.updateAutomation(automationId, req.user.id, {
    name: typeof name === "string" ? name.trim() : undefined,
    status,
    config,
    nextRunAt: parsedNextRunAt,
  });

  return res.status(200).json({
    success: true,
    data: {
      id: automationId,
    },
  });
}

export async function pauseAutomation(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const automationId = getId(req);

  if (!automationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AUTOMATION_ID",
        message: "Automation ID is required.",
      },
    });
  }

  await automationService.pauseAutomation(automationId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: automationId,
      status: AutomationStatus.PAUSED,
    },
  });
}

export async function resumeAutomation(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const automationId = getId(req);

  if (!automationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AUTOMATION_ID",
        message: "Automation ID is required.",
      },
    });
  }

  await automationService.resumeAutomation(automationId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: automationId,
      status: AutomationStatus.ACTIVE,
    },
  });
}

export async function deleteAutomation(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const automationId = getId(req);

  if (!automationId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AUTOMATION_ID",
        message: "Automation ID is required.",
      },
    });
  }

  await automationService.deleteAutomation(automationId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: automationId,
    },
  });
}
