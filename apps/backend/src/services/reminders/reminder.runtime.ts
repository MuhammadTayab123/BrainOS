import { ReminderRepository } from "./repositories/reminder.repository";
import { ReminderWorker } from "./reminder.worker";
import { ReminderScheduler } from "./reminder.scheduler";
import { ConsoleReminderDeliveryProvider } from "./providers/console-reminder.delivery";

export function createReminderScheduler(): ReminderScheduler {
  const repository =
    new ReminderRepository();

  const deliveryProvider =
    new ConsoleReminderDeliveryProvider();

  const worker =
    new ReminderWorker(
      repository,
      deliveryProvider,
    );

  return new ReminderScheduler(
    worker,
  );
}
