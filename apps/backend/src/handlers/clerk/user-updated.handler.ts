import { ClerkWebhookEvent } from "../../types/clerk";
import { logger } from "../../logger";
export async function handleUserUpdated(
  event: ClerkWebhookEvent
) {
  logger.info(`User updated: ${event.data.id}`);
}