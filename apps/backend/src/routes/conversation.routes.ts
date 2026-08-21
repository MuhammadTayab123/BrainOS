import { Router } from "express";

import {
  createConversation,
  deleteConversationById,
  getConversationById,
  listConversations,
} from "../controllers/conversation/conversation.controller";

import {
  createMessage,
  listMessages,
} from "../controllers/conversation/message.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createConversation);
router.get("/", requireAuth, listConversations);

router.post(
  "/:id/messages",
  requireAuth,
  createMessage,
);

router.get(
  "/:id/messages",
  requireAuth,
  listMessages,
);

router.get("/:id", requireAuth, getConversationById);

router.delete(
  "/:id",
  requireAuth,
  deleteConversationById,
);

export default router;