import { VADFrame, VADResult } from "../voice.types";

/**
 * ============================================================================
 * BrainOS Voice Activity Detection (VAD) Provider Contract
 * ============================================================================
 */

export interface VADProvider {
  processFrame(frame: VADFrame): Promise<VADResult>;
  reset?(): void;
}
