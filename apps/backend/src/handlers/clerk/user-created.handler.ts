import { ClerkWebhookEvent } from "../../types/clerk";
import { createUser } from "../../services/user/user.service";
import { logger } from "../../logger";
export async function handleUserCreated(event: ClerkWebhookEvent) {
  const data = event.data;

  const primaryEmail = data.email_addresses[0]?.email_address;

  if (!primaryEmail) {
    throw new Error("User has no email address");
  }

  await createUser({
    clerkId: data.id,
    email: primaryEmail,
    firstName: data.first_name ?? undefined,
    lastName: data.last_name ?? undefined,
    imageUrl: data.image_url ?? undefined,
  });

  logger.info(
    `✅ User synchronized: ${primaryEmail} (${data.id})`
  );
}