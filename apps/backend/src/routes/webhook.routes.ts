import { Router } from "express";
import { clerkWebhook } from "../controllers/webhook/clerk-webhook.controller";
const router = Router();

router.post("/clerk", clerkWebhook);

export default router;