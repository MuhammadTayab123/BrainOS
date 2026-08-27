import { Prisma } from "@prisma/client";

import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
} from "@prisma/client";

export { AutomationActionType, AutomationStatus, AutomationTriggerType };

export type AutomationConfig = Record<string, Prisma.InputJsonValue>;
export interface CreateAutomationInput {
  userId: string;
  name: string;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  config: AutomationConfig;
  nextRunAt?: Date;
}

export interface UpdateAutomationInput {
  name?: string;
  status?: AutomationStatus;
  config?: AutomationConfig;
  nextRunAt?: Date | null;
}

export interface ListAutomationsOptions {
  userId: string;
  status?: AutomationStatus;
  limit?: number;
}

export interface AutomationListResult {
  id: string;
  userId: string;
  name: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  config: unknown;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DueAutomation {
  id: string;
  userId: string;
  name: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType;
  actionType: AutomationActionType;
  config: unknown;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}
