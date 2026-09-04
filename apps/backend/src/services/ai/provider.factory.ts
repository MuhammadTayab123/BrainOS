import { env } from "../../config/env";
import { LLMProvider } from "./provider.interface";
import { OmniRouteLLMProvider } from "./providers/omniroute.provider";
import { OllamaLLMProvider } from "./providers/ollama.provider";

export function createLLMProvider(
  provider: string = env.LLM_PROVIDER,
): LLMProvider {
  switch (provider) {
    case "omniroute":
      return new OmniRouteLLMProvider();

    case "ollama":
      return new OllamaLLMProvider();

    default:
      throw new Error(
        `Unsupported LLM provider: ${provider}`,
      );
  }
}