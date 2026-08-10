import { Request, Response } from "express";
import { EmbeddingsService } from "../services/memory/embeddings.service";
import { OllamaProvider } from "../services/memory/providers";

export class DevController {
  async testEmbedding(_req: Request, res: Response) {
    try {
      const embeddings = new EmbeddingsService(
        new OllamaProvider()
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
        error: error instanceof Error ? error.message : error,
      });
    }
  }
}