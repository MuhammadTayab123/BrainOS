import { Reminder } from "@prisma/client";

export interface ReminderDeliveryProvider {
  deliver(reminder: Reminder): Promise<void>;
}