import { TTSOptions, TTSResult } from "../voice.types";

/**
 * ============================================================================
 * BrainOS Text-To-Speech (TTS) Provider Contract
 * ============================================================================
 */

export interface TTSProvider {
  synthesize(text: string, options?: TTSOptions): Promise<TTSResult>;
}
