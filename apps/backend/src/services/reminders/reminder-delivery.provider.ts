export interface ReminderDelivery {
  id: string;
  userId: string;
  taskId: string | null;
  message: string;
  scheduledFor: Date;
}

export interface ReminderDeliveryProvider {
  deliver(
    reminder: ReminderDelivery,
  ): Promise<void>;
}
