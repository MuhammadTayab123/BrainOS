import { AudioChunk, STTOptions, STTResult } from "../../voice.types";
import { STTProvider } from "../stt.provider";

export class MockSTTProvider implements STTProvider {
  public recordedCalls: Array<{ audio: AudioChunk; options?: STTOptions }> = [];
  public customTranscript: string | null = null;
  public delayMs: number = 0;

  async transcribe(
    audio: AudioChunk,
    options?: STTOptions,
  ): Promise<STTResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    this.recordedCalls.push({ audio, options });

    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, this.delayMs);
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            clearTimeout(timeout);
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }
      });
    }

    const transcript =
      this.customTranscript ??
      (audio.data.length > 0 ? "Mock transcribed speech" : "");

    return {
      transcript,
      confidence: 0.98,
      isFinal: audio.isFinal ?? true,
      language: options?.language ?? "en",
      durationMs: 1200,
    };
  }
}
