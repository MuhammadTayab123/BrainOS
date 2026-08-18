import { Router } from "express";

import { askAssistant } from "../controllers/assistant/assistant.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/ask", requireAuth, askAssistant);

export default router;