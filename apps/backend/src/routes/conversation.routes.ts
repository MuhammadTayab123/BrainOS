import { Router } from "express";

import {
  createConversation,
  deleteConversationById,
  getConversationById,
  listConversations,
} from "../controllers/conversation/conversation.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createConversation);
router.get("/", requireAuth, listConversations);
router.get("/:id", requireAuth, getConversationById);
router.delete(
  "/:id",
  requireAuth,
  deleteConversationById,
);

export default router;