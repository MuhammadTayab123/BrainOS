import { Request, Response } from "express";

import { EmbeddingsService } from "../services/memory/embeddings.service";
import { MemoryService } from "../services/memory/memory.service";
import { OllamaProvider } from "../services/memory/providers";

export class DevController {
  async testEmbedding(_req: Request, res: Response) {
    try {
      const embeddings = new EmbeddingsService(
        new OllamaProvider(),
      );

      const result = await embeddings.generate("Hello BrainOS");

      return res.status(200).json({
        success: true,
        provider: result.provider,
        model: result.model,
        dimensions: result.dimensions,
        preview: result.vector.slice(0, 10),
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Embedding test failed",
        error:
          error instanceof Error ? error.message : error,
      });
    }
  }

  async testMemory(req: Request, res: Response) {
    try {
      const { userId, content, importance } = req.body;

      if (
        typeof userId !== "string" ||
        userId.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "userId is required.",
        });
      }

      if (
        typeof content !== "string" ||
        content.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "content is required.",
        });
      }

      if (
        importance !== undefined &&
        (typeof importance !== "number" ||
          !Number.isFinite(importance))
      ) {
        return res.status(400).json({
          success: false,
          message: "importance must be a finite number.",
        });
      }

      const memoryService = new MemoryService(
        new EmbeddingsService(new OllamaProvider()),
      );

      const memory = await memoryService.createMemory({
        userId,
        content: content.trim(),
        importance,
      });

      return res.status(201).json({
        success: true,
        memory: {
          id: memory.id,
          userId: memory.userId,
          content: memory.content,
          importance: memory.importance,
          createdAt: memory.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "Memory persistence test failed:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Memory persistence test failed.",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }
  }
  async testMemorySearch(req: Request, res: Response) {
  try {
    const { userId, query, limit } = req.body;

    if (
      typeof userId !== "string" ||
      userId.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "userId is required.",
      });
    }

    if (
      typeof query !== "string" ||
      query.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "query is required.",
      });
    }

    if (
      limit !== undefined &&
      (typeof limit !== "number" ||
        !Number.isInteger(limit))
    ) {
      return res.status(400).json({
        success: false,
        message: "limit must be an integer.",
      });
    }

    const memoryService = new MemoryService(
      new EmbeddingsService(new OllamaProvider()),
    );

    const memories = await memoryService.searchMemories({
      userId: userId.trim(),
      query: query.trim(),
      limit,
    });

    return res.status(200).json({
      success: true,
      query: query.trim(),
      count: memories.length,
      memories,
    });
  } catch (error) {
    console.error(
      "Memory semantic search test failed:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Memory semantic search test failed.",
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
}
}