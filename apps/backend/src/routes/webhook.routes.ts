import { Router } from "express";
import { clerkWebhook } from "../controllers/webhook/clerk.controler";

const router = Router();

router.post("/clerk", clerkWebhook);

export default router;