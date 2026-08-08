import { ClerkWebhookEvent } from "../../types/clerk";
import { logger } from "../../logger";
export async function handleUserDeleted(
  event: ClerkWebhookEvent
) {
  logger.info(`User deleted: ${event.data.id}`);
}