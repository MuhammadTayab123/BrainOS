import { Request, Response } from "express";
import { MessageRole } from "@prisma/client";

import { MessageService } from "../../services/conversation/message.service";
import { ConversationRepository } from "../../services/conversation/repositories/conversation.repository";
import { MessageRepository } from "../../services/conversation/repositories/message.repository";

const messageService = new MessageService(
  new MessageRepository(),
  new ConversationRepository(),
);

export async function createMessage(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const conversationId = req.params.id;

  if (
    typeof conversationId !== "string" ||
    conversationId.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message: "Conversation ID is required.",
      },
    });
  }

  const { role, content } = req.body;

  if (
    typeof role !== "string" ||
    !Object.values(MessageRole).includes(
      role as MessageRole,
    )
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MESSAGE_ROLE",
        message:
          "Message role must be USER, ASSISTANT, or SYSTEM.",
      },
    });
  }

  if (
    typeof content !== "string" ||
    content.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MESSAGE_CONTENT",
        message: "Message content is required.",
      },
    });
  }

  const message =
    await messageService.createMessage({
      conversationId: conversationId.trim(),
      userId: req.user.id,
      role: role as MessageRole,
      content,
    });

  return res.status(201).json({
    success: true,
    data: message,
  });
}

export async function listMessages(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const conversationId = req.params.id;

  if (
    typeof conversationId !== "string" ||
    conversationId.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message: "Conversation ID is required.",
      },
    });
  }

  const messages =
    await messageService.listMessages({
      conversationId: conversationId.trim(),
      userId: req.user.id,
    });

  return res.status(200).json({
    success: true,
    data: messages,
  });
}