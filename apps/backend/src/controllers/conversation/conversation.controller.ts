import { Request, Response } from "express";

import { ConversationService } from "../../services/conversation/conversation.service";
import { ConversationRepository } from "../../services/conversation/repositories/conversation.repository";
const conversationService = new ConversationService(
  new ConversationRepository(),
);
const MAX_CONVERSATION_LIST_LIMIT = 100;

export async function createConversation(
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

  const { title } = req.body;

  if (
    title !== undefined &&
    (typeof title !== "string" ||
      title.trim().length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TITLE",
        message:
          "Conversation title must be a non-empty string.",
      },
    });
  }

  const conversation =
    await conversationService.createConversation({
      userId: req.user.id,
      title:
        typeof title === "string"
          ? title.trim()
          : undefined,
    });

  return res.status(201).json({
    success: true,
    data: conversation,
  });
}

export async function listConversations(
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

  const { limit } = req.query;

  let parsedLimit: number | undefined;

  if (limit !== undefined) {
    if (
      typeof limit !== "string" ||
      !/^\d+$/.test(limit)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: `Limit must be an integer between 1 and ${MAX_CONVERSATION_LIST_LIMIT}.`,
        },
      });
    }

    parsedLimit = Number.parseInt(limit, 10);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > MAX_CONVERSATION_LIST_LIMIT
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: `Limit must be an integer between 1 and ${MAX_CONVERSATION_LIST_LIMIT}.`,
        },
      });
    }
  }

  const conversations =
    await conversationService.listConversations({
      userId: req.user.id,
      limit: parsedLimit,
    });

  return res.status(200).json({
    success: true,
    data: conversations,
  });
}

export async function getConversationById(
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

  const rawConversationId = req.params.id;

  if (typeof rawConversationId !== "string") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message: "Conversation ID is required.",
      },
    });
  }

  const conversationId =
    rawConversationId.trim();

  if (conversationId.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message: "Conversation ID is required.",
      },
    });
  }

  const conversation =
    await conversationService.getConversation({
      conversationId,
      userId: req.user.id,
    });

  return res.status(200).json({
    success: true,
    data: conversation,
  });
}

export async function deleteConversationById(
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

  const rawConversationId = req.params.id;

  if (typeof rawConversationId !== "string") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message: "Conversation ID is required.",
      },
    });
  }

  const conversationId =
    rawConversationId.trim();

  if (conversationId.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONVERSATION_ID",
        message: "Conversation ID is required.",
      },
    });
  }

  await conversationService.deleteConversation({
    conversationId,
    userId: req.user.id,
  });

  return res.status(200).json({
    success: true,
    data: {
      id: conversationId,
    },
  });
}