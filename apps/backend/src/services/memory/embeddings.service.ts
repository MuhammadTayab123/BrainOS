import { EmbeddingProvider } from "./providers/embedding.provider";
import { EmbeddingResult } from "./memory.types";

export class EmbeddingsService {
  constructor(
    private readonly provider: EmbeddingProvider
  ) {}

  async generate(text: string): Promise<EmbeddingResult> {
    return this.provider.embed(text);
  }
}