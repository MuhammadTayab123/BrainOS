import { describe, expect, it, vi } from "vitest";
import {
  createSTTProvider,
  createTTSProvider,
  createVADProvider,
  HttpSTTProvider,
  HttpTTSProvider,
  MockSTTProvider,
  MockTTSProvider,
  MockVADProvider,
  ProcessSTTProvider,
  ProcessTTSProvider,
} from "../../src/services/voice";

describe("Voice Provider Adapters & Factory", () => {
  describe("ProcessSTTProvider", () => {
    it("rejects an empty command in the constructor", () => {
      expect(() => new ProcessSTTProvider({ command: "" })).toThrow(
        "ProcessSTTProvider requires a non-empty executable command.",
      );
      expect(() => new ProcessSTTProvider({ command: "   " })).toThrow(
        "ProcessSTTProvider requires a non-empty executable command.",
      );
    });

    it("executes child process and returns stdout transcript", async () => {
      const provider = new ProcessSTTProvider({
        command: process.execPath,
        args: ["-e", 'console.log("Hello from process STT")'],
      });

      const result = await provider.transcribe({
        data: Buffer.from([1, 2, 3]),
      });

      expect(result.transcript).toBe("Hello from process STT");
      expect(result.isFinal).toBe(true);
    });

    it("fails closed when the child process exits with a non-zero code", async () => {
      const provider = new ProcessSTTProvider({
        command: process.execPath,
        args: ["-e", 'console.error("Transcription crashed"); process.exit(2)'],
      });

      await expect(
        provider.transcribe({ data: Buffer.from([1, 2, 3]) }),
      ).rejects.toThrow(/STT process exited with code 2/);
    });

    it("rejects immediately if signal is already aborted", async () => {
      const provider = new ProcessSTTProvider({
        command: process.execPath,
        args: ["-e", 'console.log("Should not run")'],
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        provider.transcribe(
          { data: Buffer.from([1, 2, 3]) },
          { signal: controller.signal },
        ),
      ).rejects.toThrow("The operation was aborted.");
    });

    it("terminates process on in-flight abort", async () => {
      const provider = new ProcessSTTProvider({
        command: process.execPath,
        args: [
          "-e",
          "setTimeout(() => console.log('Done'), 5000)",
        ],
      });

      const controller = new AbortController();
      const promise = provider.transcribe(
        { data: Buffer.from([1, 2, 3]) },
        { signal: controller.signal },
      );

      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow("The operation was aborted.");
    });
  });

  describe("ProcessTTSProvider", () => {
    it("rejects an empty command in the constructor", () => {
      expect(() => new ProcessTTSProvider({ command: "" })).toThrow(
        "ProcessTTSProvider requires a non-empty executable command.",
      );
    });

    it("synthesizes audio via process stdout", async () => {
      const provider = new ProcessTTSProvider({
        command: process.execPath,
        args: [
          "-e",
          'process.stdout.write(Buffer.from([0x52, 0x49, 0x46, 0x46]))',
        ],
        defaultMimeType: "audio/wav",
      });

      const result = await provider.synthesize("Synthesize this");

      expect(result.mimeType).toBe("audio/wav");
      expect(result.characterCount).toBe("Synthesize this".length);
      expect(result.audio).toBeInstanceOf(Buffer);
      expect(result.audio.length).toBe(4);
    });

    it("fails closed on non-zero process exit", async () => {
      const provider = new ProcessTTSProvider({
        command: process.execPath,
        args: ["-e", 'console.error("TTS failed"); process.exit(1)'],
      });

      await expect(provider.synthesize("Hello")).rejects.toThrow(
        /TTS process exited with code 1/,
      );
    });

    it("respects AbortSignal cancellation", async () => {
      const provider = new ProcessTTSProvider({
        command: process.execPath,
        args: [
          "-e",
          "setTimeout(() => process.stdout.write('audio'), 5000)",
        ],
      });

      const controller = new AbortController();
      const promise = provider.synthesize("Long text", {
        signal: controller.signal,
      });

      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow("The operation was aborted.");
    });
  });

  describe("HttpSTTProvider", () => {
    it("rejects an empty endpoint URL", () => {
      expect(() => new HttpSTTProvider({ endpointUrl: "" })).toThrow(
        "HttpSTTProvider requires a non-empty endpoint URL.",
      );
    });

    it("sends audio payload and parses JSON transcript with Bearer auth", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ transcript: "Transcribed from remote API" }),
      });

      vi.stubGlobal("fetch", mockFetch);

      try {
        const provider = new HttpSTTProvider({
          endpointUrl: "https://api.example.com/v1/audio/transcriptions",
          apiKey: "secret-key-123",
        });

        const result = await provider.transcribe({
          data: Buffer.from([1, 2, 3]),
          mimeType: "audio/webm",
        });

        expect(result.transcript).toBe("Transcribed from remote API");
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const [url, requestInit] = mockFetch.mock.calls[0];
        expect(url).toBe("https://api.example.com/v1/audio/transcriptions");
        expect(requestInit.method).toBe("POST");
        expect(requestInit.headers["Authorization"]).toBe("Bearer secret-key-123");
        expect(requestInit.headers["Content-Type"]).toBe("audio/webm");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("fails closed when remote HTTP STT returns a non-2xx status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized API key",
      });

      vi.stubGlobal("fetch", mockFetch);

      try {
        const provider = new HttpSTTProvider({
          endpointUrl: "https://api.example.com/v1/transcribe",
        });

        await expect(
          provider.transcribe({ data: Buffer.from([1, 2]) }),
        ).rejects.toThrow(/HTTP STT endpoint returned status 401: Unauthorized API key/);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("aborts HTTP STT request when signal is triggered", async () => {
      const controller = new AbortController();
      controller.abort();

      const provider = new HttpSTTProvider({
        endpointUrl: "https://api.example.com/v1/transcribe",
      });

      await expect(
        provider.transcribe(
          { data: Buffer.from([1]) },
          { signal: controller.signal },
        ),
      ).rejects.toThrow("The operation was aborted.");
    });
  });

  describe("HttpTTSProvider", () => {
    it("rejects an empty endpoint URL", () => {
      expect(() => new HttpTTSProvider({ endpointUrl: "" })).toThrow(
        "HttpTTSProvider requires a non-empty endpoint URL.",
      );
    });

    it("sends text JSON payload and returns audio buffer", async () => {
      const mockAudioBytes = new Uint8Array([10, 20, 30, 40]);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "audio/mp3" }),
        arrayBuffer: async () => mockAudioBytes.buffer,
      });

      vi.stubGlobal("fetch", mockFetch);

      try {
        const provider = new HttpTTSProvider({
          endpointUrl: "https://api.example.com/v1/audio/speech",
          apiKey: "tts-token",
          defaultVoiceId: "alloy",
        });

        const result = await provider.synthesize("Hello world", {
          format: "audio/mp3",
        });

        expect(result.mimeType).toBe("audio/mp3");
        expect(result.characterCount).toBe("Hello world".length);
        expect(result.audio).toBeInstanceOf(Buffer);

        const [url, requestInit] = mockFetch.mock.calls[0];
        expect(url).toBe("https://api.example.com/v1/audio/speech");
        expect(requestInit.headers["Authorization"]).toBe("Bearer tts-token");
        const parsedBody = JSON.parse(requestInit.body);
        expect(parsedBody.text).toBe("Hello world");
        expect(parsedBody.voice).toBe("alloy");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("fails closed when remote HTTP TTS returns a non-2xx status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal synthesis error",
      });

      vi.stubGlobal("fetch", mockFetch);

      try {
        const provider = new HttpTTSProvider({
          endpointUrl: "https://api.example.com/v1/audio/speech",
        });

        await expect(provider.synthesize("Fail me")).rejects.toThrow(
          /HTTP TTS endpoint returned status 500: Internal synthesis error/,
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("Voice Provider Factory", () => {
    it("creates MockSTTProvider by default", () => {
      const provider = createSTTProvider("mock");
      expect(provider).toBeInstanceOf(MockSTTProvider);
    });

    it("creates ProcessSTTProvider when type is process", () => {
      const provider = createSTTProvider("process", {
        command: "whisper",
        args: ["--model", "tiny"],
      });
      expect(provider).toBeInstanceOf(ProcessSTTProvider);
    });

    it("creates HttpSTTProvider when type is http", () => {
      const provider = createSTTProvider("http", {
        endpointUrl: "https://api.example.com/stt",
      });
      expect(provider).toBeInstanceOf(HttpSTTProvider);
    });

    it("fails closed on unsupported STT provider type", () => {
      expect(() => createSTTProvider("unknown-vendor")).toThrow(
        "Unsupported Voice STT provider: unknown-vendor",
      );
    });

    it("creates MockTTSProvider by default", () => {
      const provider = createTTSProvider("mock");
      expect(provider).toBeInstanceOf(MockTTSProvider);
    });

    it("creates ProcessTTSProvider when type is process", () => {
      const provider = createTTSProvider("process", {
        command: "piper",
      });
      expect(provider).toBeInstanceOf(ProcessTTSProvider);
    });

    it("creates HttpTTSProvider when type is http", () => {
      const provider = createTTSProvider("http", {
        endpointUrl: "https://api.example.com/tts",
      });
      expect(provider).toBeInstanceOf(HttpTTSProvider);
    });

    it("fails closed on unsupported TTS provider type", () => {
      expect(() => createTTSProvider("unknown-vendor")).toThrow(
        "Unsupported Voice TTS provider: unknown-vendor",
      );
    });

    it("creates MockVADProvider by default", () => {
      const provider = createVADProvider("mock");
      expect(provider).toBeInstanceOf(MockVADProvider);
    });

    it("fails closed on unsupported VAD provider type", () => {
      expect(() => createVADProvider("unknown-vad")).toThrow(
        "Unsupported Voice VAD provider: unknown-vad",
      );
    });
  });
});
