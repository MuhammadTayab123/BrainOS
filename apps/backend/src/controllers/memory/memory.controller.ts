import { Request, Response } from "express";
import { EmbeddingsService } from "../../services/memory/embeddings.service";
import { MemoryService } from "../../services/memory/memory.service";
import { OllamaProvider } from "../../services/memory/providers";

const memoryService = new MemoryService(
  new EmbeddingsService(new OllamaProvider()),
);

export async function createMemory(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const user = req.user;
  const { content, importance } = req.body;

  if (typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_CONTENT",
        message: "Memory content is required.",
      },
    });
  }

  if (
    importance !== undefined &&
    (typeof importance !== "number" ||
      !Number.isFinite(importance) ||
      importance < 0 ||
      importance > 1)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_IMPORTANCE",
        message: "Importance must be a number between 0 and 1.",
      },
    });
  }

  const memory = await memoryService.createMemory({
    userId: user.id,
    content: content.trim(),
    importance,
  });

  return res.status(201).json({
    success: true,
    data: memory,
  });
}

export async function searchMemories(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const user = req.user;
  const { query, limit } = req.body;

  if (typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_QUERY",
        message: "Search query is required.",
      },
    });
  }

  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || limit < 1 || limit > 50)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_LIMIT",
        message: "Limit must be an integer between 1 and 50.",
      },
    });
  }

  const memories = await memoryService.searchMemories({
    userId: user.id,
    query: query.trim(),
    limit,
  });

  return res.status(200).json({
    success: true,
    data: memories,
  });
}