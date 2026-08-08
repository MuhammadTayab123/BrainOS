import { Webhook } from "svix";
import { env } from "../../config/env";

export function verifyClerkWebhook(
  body: Buffer,
  headers: {
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
  }
) {
const webhookSecret = env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const webhook = new Webhook(webhookSecret);

  return webhook.verify(body, {
    "svix-id": headers.svixId,
    "svix-timestamp": headers.svixTimestamp,
    "svix-signature": headers.svixSignature,
  }) as any;
}