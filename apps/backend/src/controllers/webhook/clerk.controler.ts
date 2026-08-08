import { Request, Response } from "express";
import { verifyClerkWebhook } from "../../services/webhook/clerk.service";
import { ClerkWebhookEvent } from "../../types/clerk";
import { dispatchClerkEvent } from "../../handlers/clerk";

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

    await dispatchClerkEvent(event);

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