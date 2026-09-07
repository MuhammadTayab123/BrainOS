import { VADFrame, VADResult } from "../../voice.types";
import { VADProvider } from "../vad.provider";

export class MockVADProvider implements VADProvider {
  public recordedFrames: VADFrame[] = [];
  public speechProbability: number = 0.95;
  public isSpeech: boolean = true;

  async processFrame(frame: VADFrame): Promise<VADResult> {
    this.recordedFrames.push(frame);

    return {
      isSpeech: this.isSpeech,
      probability: this.speechProbability,
      speechStart: this.recordedFrames.length === 1,
      speechEnd: false,
    };
  }

  reset(): void {
    this.recordedFrames = [];
  }
}
