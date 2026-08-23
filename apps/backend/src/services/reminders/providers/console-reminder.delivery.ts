import { ReminderDeliveryProvider } from "../reminder.delivery";

export class ConsoleReminderDeliveryProvider
  implements ReminderDeliveryProvider
{
  async deliver(reminder: {
    id: string;
    userId: string;
    message: string;
  }): Promise<void> {
    console.log(
      `[Reminder] ${reminder.id} | user=${reminder.userId} | ${reminder.message}`,
    );
  }
}