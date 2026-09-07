import { TTSOptions, TTSResult } from "../../voice.types";
import { TTSProvider } from "../tts.provider";

export interface HttpTTSConfig {
  endpointUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  defaultVoiceId?: string;
  defaultFormat?: string;
  timeoutMs?: number;
}

export class HttpTTSProvider implements TTSProvider {
  constructor(private readonly config: HttpTTSConfig) {
    if (!config.endpointUrl || config.endpointUrl.trim().length === 0) {
      throw new Error("HttpTTSProvider requires a non-empty endpoint URL.");
    }
  }

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<TTSResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.config.headers ?? {}),
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const format = options?.format ?? this.config.defaultFormat ?? "audio/wav";
    const voiceId = options?.voiceId ?? this.config.defaultVoiceId;

    const payload = {
      text,
      voice: voiceId,
      format,
      speed: options?.speed,
      pitch: options?.pitch,
    };

    let signal = options?.signal;
    let timeoutId: NodeJS.Timeout | undefined;

    if (this.config.timeoutMs && this.config.timeoutMs > 0) {
      const timeoutController = new AbortController();
      timeoutId = setTimeout(() => {
        timeoutController.abort(new Error(`TTS request timed out after ${this.config.timeoutMs}ms.`));
      }, this.config.timeoutMs);

      if (signal) {
        signal.addEventListener("abort", () => timeoutController.abort(signal?.reason));
      }
      signal = timeoutController.signal;
    }

    try {
      const response = await fetch(this.config.endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `HTTP TTS endpoint returned status ${response.status}${errorText ? `: ${errorText}` : "."}`,
        );
      }

      const mimeType = response.headers.get("content-type") || format;
      const arrayBuffer = await response.arrayBuffer();
      const audio = Buffer.from(arrayBuffer);

      return {
        audio,
        mimeType,
        characterCount: text.length,
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
