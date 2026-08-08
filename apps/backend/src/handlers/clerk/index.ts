import { ClerkWebhookEvent } from "../../types/clerk";
import { logger } from "../../logger";
import { handleUserCreated } from "./user-created.handler";
import { handleUserUpdated } from "./user-updated.handler";
import { handleUserDeleted } from "./user-deleted.handler";

export async function dispatchClerkEvent(
  event: ClerkWebhookEvent
) {
  switch (event.type) {
    case "user.created":
      await handleUserCreated(event);
      break;

    case "user.updated":
      await handleUserUpdated(event);
      break;

    case "user.deleted":
      await handleUserDeleted(event);
      break;

    default:
      logger.info(`Ignored Clerk event: ${event.type}`);
  }
}