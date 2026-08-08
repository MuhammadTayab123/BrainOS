import { Request, Response } from "express";
import { verifyClerkWebhook } from "../../services/webhook/clerk.service";
import { createUser } from "../../services/user/user.service";
import { ClerkWebhookEvent } from "../../types/clerk";

export async function clerkWebhook(req: Request, res: Response) {
  const svixId = req.header("svix-id");
  const svixTimestamp = req.header("svix-timestamp");
  const svixSignature = req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({
      success: false,
      message: "Missing Svix headers",
    });
  }

  try {
    const event = verifyClerkWebhook(req.body as Buffer, {
      svixId,
      svixTimestamp,
      svixSignature,
    }) as ClerkWebhookEvent;

    console.log("✅ Verified Clerk Event:", event.type);

    if (event.type === "user.created") {
      const data = event.data;

      const primaryEmail = data.email_addresses[0]?.email_address;

      if (!primaryEmail) {
        return res.status(400).json({
          success: false,
          message: "User has no email address",
        });
      }

      await createUser({
        clerkId: data.id,
        email: primaryEmail,
        firstName: data.first_name ?? undefined,
        lastName: data.last_name ?? undefined,
        imageUrl: data.image_url ?? undefined,
      });

      console.log(`✅ User synchronized: ${primaryEmail} (${data.id})`);
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("❌ Webhook verification failed:", error);

    return res.status(400).json({
      success: false,
      message: "Invalid webhook signature",
    });
  }
}