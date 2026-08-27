import "dotenv/config";

import app from "./app";
import { env } from "./config/env";
import { logger } from "./logger";

import { createReminderScheduler } from "./services/reminders/reminder.runtime";

import { createAutomationScheduler } from "./services/automation/automation.runtime";

const PORT = env.PORT;

const reminderScheduler = createReminderScheduler();

const automationScheduler = createAutomationScheduler();

const server = app.listen(PORT, () => {
  logger.info(`BrainOS Backend running at http://localhost:${PORT}`);

  reminderScheduler.start();
  automationScheduler.start();
});

process.on("SIGINT", () => {
  reminderScheduler.stop();
  automationScheduler.stop();

  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  reminderScheduler.stop();
  automationScheduler.stop();

  server.close(() => {
    process.exit(0);
  });
});
