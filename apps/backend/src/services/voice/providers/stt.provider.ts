import { AudioChunk, STTOptions, STTResult } from "../voice.types";

/**
 * ============================================================================
 * BrainOS Speech-To-Text (STT) Provider Contract
 * ============================================================================
 */

export interface STTProvider {
  transcribe(audio: AudioChunk, options?: STTOptions): Promise<STTResult>;
}
