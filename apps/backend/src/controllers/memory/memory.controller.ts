import { Request, Response } from "express";
import { EmbeddingsService } from "../../services/memory/embeddings.service";
import { MAX_MEMORY_LIST_LIMIT } from "../../services/memory/constants/memory.constants";
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

export async function listMemories(req: Request, res: Response) {
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
          message: `Limit must be an integer between 1 and ${MAX_MEMORY_LIST_LIMIT}.`,
        },
      });
    }

    parsedLimit = Number.parseInt(limit, 10);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > MAX_MEMORY_LIST_LIMIT
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: `Limit must be an integer between 1 and ${MAX_MEMORY_LIST_LIMIT}.`,
        },
      });
    }
  }

  const memories = await memoryService.listMemories({
    userId: user.id,
    limit: parsedLimit,
  });

  return res.status(200).json({
    success: true,
    data: memories,
  });
}

export async function getMemoryById(
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

  const user = req.user;
  const rawMemoryId = req.params.id;

  if (typeof rawMemoryId !== "string") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_ID",
        message: "Memory ID is required.",
      },
    });
  }

  const memoryId = rawMemoryId.trim();

  if (memoryId.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_ID",
        message: "Memory ID is required.",
      },
    });
  }

  const memory = await memoryService.getMemoryById({
    memoryId,
    userId: user.id,
  });

  return res.status(200).json({
    success: true,
    data: memory,
  });
}

export async function deleteMemoryById(
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

  const user = req.user;
  const rawMemoryId = req.params.id;

  if (typeof rawMemoryId !== "string") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_ID",
        message: "Memory ID is required.",
      },
    });
  }

  const memoryId = rawMemoryId.trim();

  if (memoryId.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_ID",
        message: "Memory ID is required.",
      },
    });
  }

  await memoryService.deleteMemory({
    memoryId,
    userId: user.id,
  });

  return res.status(200).json({
    success: true,
    data: {
      id: memoryId,
    },
  });
}

export async function updateMemoryById(
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

  const user = req.user;
  const rawMemoryId = req.params.id;

  if (typeof rawMemoryId !== "string") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_ID",
        message: "Memory ID is required.",
      },
    });
  }

  const memoryId = rawMemoryId.trim();

  if (memoryId.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MEMORY_ID",
        message: "Memory ID is required.",
      },
    });
  }

  if (
    req.body === null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_UPDATE_PAYLOAD",
        message:
          "Request body must contain updatable fields.",
      },
    });
  }

  const allowedKeys = new Set([
    "content",
    "importance",
  ]);

  const payloadKeys = Object.keys(req.body);
  const hasInvalidKeys = payloadKeys.some(
    (key) => !allowedKeys.has(key),
  );

  if (hasInvalidKeys) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_UPDATE_FIELDS",
        message:
          "Only content and importance can be updated.",
      },
    });
  }

  const hasContent = Object.prototype.hasOwnProperty.call(
    req.body,
    "content",
  );
  const hasImportance =
    Object.prototype.hasOwnProperty.call(
      req.body,
      "importance",
    );

  if (!hasContent && !hasImportance) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_UPDATE_PAYLOAD",
        message:
          "At least one updatable field is required.",
      },
    });
  }

  let nextContent: string | undefined;
  let nextImportance: number | undefined;

  if (hasContent) {
    if (
      typeof req.body.content !== "string" ||
      req.body.content.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_CONTENT",
          message: "Memory content is required.",
        },
      });
    }

    nextContent = req.body.content.trim();
  }

  if (hasImportance) {
    if (
      typeof req.body.importance !== "number" ||
      !Number.isFinite(req.body.importance) ||
      req.body.importance < 0 ||
      req.body.importance > 1
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_IMPORTANCE",
          message:
            "Importance must be a number between 0 and 1.",
        },
      });
    }

    nextImportance = req.body.importance;
  }

  const memory = await memoryService.updateMemory({
    memoryId,
    userId: user.id,
    content: nextContent,
    importance: nextImportance,
  });

  return res.status(200).json({
    success: true,
    data: memory,
  });
}