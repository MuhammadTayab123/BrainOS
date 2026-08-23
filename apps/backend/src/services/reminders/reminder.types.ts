import { ReminderStatus } from "@prisma/client";

export {
  ReminderStatus,
};

export interface CreateReminderInput {
  userId: string;
  message: string;
  scheduledFor: Date;
  taskId?: string;
}

export interface ListRemindersOptions {
  userId: string;
  status?: ReminderStatus;
  dueBefore?: Date;
  limit?: number;
}

export interface UpdateReminderFailureData {
  lastError: string;
}

export interface ReminderProcessingResult {
  id: string;
  status: ReminderStatus;
}