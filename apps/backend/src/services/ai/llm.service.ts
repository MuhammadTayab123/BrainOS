import {
  GenerateTextInput,
  LLMProvider,
  LLMResponse,
} from "./provider.interface";

export class LLMService {
  constructor(
    private readonly provider: LLMProvider
  ) {}

  async generate(input: GenerateTextInput): Promise<LLMResponse> {
    return this.provider.generate(input);
  }
}
