import { env } from "../../../config/env";
import { OllamaClient } from "../../ai/clients/ollama.client";
import { EmbeddingProvider } from "./embedding.provider";
import { EmbeddingResult } from "../memory.types";

interface OllamaEmbeddingResponse {
  embeddings: number[][];
}

export class OllamaProvider implements EmbeddingProvider {
  constructor(
    private readonly client = new OllamaClient()
  ) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const response =
      await this.client.post<OllamaEmbeddingResponse>(
        "/api/embed",
        {
          model: env.OLLAMA_EMBEDDING_MODEL,
          input: text,
        }
      );

    const vector = response.embeddings[0];

    return {
      vector,
      dimensions: vector.length,
      provider: "ollama",
      model: env.OLLAMA_EMBEDDING_MODEL,
    };
  }
}