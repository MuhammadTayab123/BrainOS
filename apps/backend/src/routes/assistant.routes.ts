import { Router } from "express";

import {
  askAssistant,
  streamAssistant,
} from "../controllers/assistant/assistant.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/ask", requireAuth, askAssistant);
router.post("/stream", requireAuth, streamAssistant);

export default router;