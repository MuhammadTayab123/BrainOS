import { AudioChunk, STTOptions, STTResult } from "../../voice.types";
import { STTProvider } from "../stt.provider";

export interface HttpSTTConfig {
  endpointUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class HttpSTTProvider implements STTProvider {
  constructor(private readonly config: HttpSTTConfig) {
    if (!config.endpointUrl || config.endpointUrl.trim().length === 0) {
      throw new Error("HttpSTTProvider requires a non-empty endpoint URL.");
    }
  }

  async transcribe(
    audio: AudioChunk,
    options?: STTOptions,
  ): Promise<STTResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const headers: Record<string, string> = {
      ...(this.config.headers ?? {}),
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    // Determine content type
    const mimeType = audio.mimeType ?? "application/octet-stream";
    headers["Content-Type"] = mimeType;

    if (options?.language) {
      headers["X-Audio-Language"] = options.language;
    }

    let signal = options?.signal;
    let timeoutId: NodeJS.Timeout | undefined;

    if (this.config.timeoutMs && this.config.timeoutMs > 0) {
      const timeoutController = new AbortController();
      timeoutId = setTimeout(() => {
        timeoutController.abort(new Error(`STT request timed out after ${this.config.timeoutMs}ms.`));
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
        body: new Uint8Array(audio.data),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `HTTP STT endpoint returned status ${response.status}${errorText ? `: ${errorText}` : "."}`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      let transcript = "";

      if (contentType.includes("application/json")) {
        const data = (await response.json()) as Record<string, unknown>;
        transcript =
          (typeof data.transcript === "string" ? data.transcript : "") ||
          (typeof data.text === "string" ? data.text : "");
      } else {
        transcript = await response.text();
      }

      return {
        transcript: transcript.trim(),
        isFinal: true,
        language: options?.language,
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
