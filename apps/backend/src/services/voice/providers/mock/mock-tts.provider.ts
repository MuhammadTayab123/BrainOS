import { TTSOptions, TTSResult } from "../../voice.types";
import { TTSProvider } from "../tts.provider";

export class MockTTSProvider implements TTSProvider {
  public recordedCalls: Array<{ text: string; options?: TTSOptions }> = [];
  public customAudio: Buffer | Uint8Array | null = null;
  public delayMs: number = 0;

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<TTSResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    this.recordedCalls.push({ text, options });

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

    const audio =
      this.customAudio ?? Buffer.from(`mock_audio_for_${text}`);

    return {
      audio,
      mimeType: options?.format ?? "audio/wav",
      durationMs: text.length * 50,
      characterCount: text.length,
    };
  }
}
