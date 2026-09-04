import { describe, expect, it } from "vitest";

import { createLLMProvider } from "../../src/services/ai/provider.factory";
import { OllamaLLMProvider } from "../../src/services/ai/providers/ollama.provider";
import { OmniRouteLLMProvider } from "../../src/services/ai/providers/omniroute.provider";

describe("createLLMProvider", () => {
  it("creates an OmniRoute provider when configured", () => {
    const provider = createLLMProvider("omniroute");

    expect(provider).toBeInstanceOf(OmniRouteLLMProvider);
  });

  it("creates an Ollama provider when configured", () => {
    const provider = createLLMProvider("ollama");

    expect(provider).toBeInstanceOf(OllamaLLMProvider);
  });

  it("throws for an unsupported LLM provider", () => {
    expect(() => createLLMProvider("unsupported_provider")).toThrow(
      "Unsupported LLM provider: unsupported_provider",
    );
  });
});
