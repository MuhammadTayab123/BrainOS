import * as childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TTSOptions, TTSResult } from "../../voice.types";
import { TTSProvider } from "../tts.provider";

export const MAX_PIPER_STDERR_BUFFER_BYTES = 8 * 1024; // 8 KB limit
const MAX_STDERR_BUFFER_BYTES = MAX_PIPER_STDERR_BUFFER_BYTES;

export interface PiperTTSConfig {
  binaryPath: string;
  modelPath: string;
  args?: string[];
  configPath?: string;
  speaker?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseW?: number;
  sentenceSilenceSeconds?: number;
  timeoutMs?: number;
  tempDir?: string;
  spawnFn?: typeof childProcess.spawn;
  readFileFn?: (path: string) => Promise<Buffer>;
  unlinkFn?: (path: string) => Promise<void>;
}

export class PiperTTSProvider implements TTSProvider {
  private readonly spawnFn: typeof childProcess.spawn;
  private readonly readFileFn: (path: string) => Promise<Buffer>;
  private readonly unlinkFn: (path: string) => Promise<void>;

  constructor(private readonly config: PiperTTSConfig) {
    this.spawnFn = config.spawnFn ?? childProcess.spawn;
    this.readFileFn = config.readFileFn ?? readFile;
    this.unlinkFn = config.unlinkFn ?? unlink;

    if (!config.binaryPath || config.binaryPath.trim().length === 0) {
      throw new Error("PiperTTSProvider requires a non-empty binaryPath.");
    }

    if (!config.modelPath || config.modelPath.trim().length === 0) {
      throw new Error("PiperTTSProvider requires a non-empty modelPath.");
    }

    if (
      config.speaker !== undefined &&
      (!Number.isInteger(config.speaker) || config.speaker < 0)
    ) {
      throw new Error("PiperTTSProvider speaker must be a non-negative integer.");
    }

    if (
      config.lengthScale !== undefined &&
      (!Number.isFinite(config.lengthScale) || config.lengthScale <= 0)
    ) {
      throw new Error("PiperTTSProvider lengthScale must be a positive number.");
    }

    if (
      config.noiseScale !== undefined &&
      (!Number.isFinite(config.noiseScale) || config.noiseScale <= 0)
    ) {
      throw new Error("PiperTTSProvider noiseScale must be a positive number.");
    }

    if (
      config.noiseW !== undefined &&
      (!Number.isFinite(config.noiseW) || config.noiseW <= 0)
    ) {
      throw new Error("PiperTTSProvider noiseW must be a positive number.");
    }

    if (
      config.sentenceSilenceSeconds !== undefined &&
      (!Number.isFinite(config.sentenceSilenceSeconds) || config.sentenceSilenceSeconds < 0)
    ) {
      throw new Error("PiperTTSProvider sentenceSilenceSeconds must be a non-negative number.");
    }

    if (
      config.timeoutMs !== undefined &&
      (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
    ) {
      throw new Error("PiperTTSProvider timeoutMs must be a positive integer.");
    }
  }

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<TTSResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty for speech synthesis.");
    }

    if (options?.format !== undefined && options.format.toLowerCase() !== "audio/wav") {
      throw new Error(`PiperTTSProvider only supports "audio/wav" format.`);
    }

    if (options?.pitch !== undefined) {
      throw new Error("PiperTTSProvider does not support pitch adjustment.");
    }

    const tempDir = this.config.tempDir || os.tmpdir();
    const tempFileName = `brainos-piper-${randomUUID()}.wav`;
    const tempFilePath = path.join(tempDir, tempFileName);

    let tempFileCreated = false;

    try {
      const args: string[] = [
        ...(this.config.args ?? []),
        "--model",
        this.config.modelPath,
        "--output_file",
        tempFilePath,
      ];

      if (this.config.configPath) {
        args.push("--config", this.config.configPath);
      }

      // Map generic voiceId to Piper speaker selection where supported (must be non-negative integer string)
      if (options?.voiceId !== undefined) {
        const trimmedVoiceId = options.voiceId.trim();
        if (!/^\d+$/.test(trimmedVoiceId)) {
          throw new Error("PiperTTSProvider voiceId must be a non-negative integer string.");
        }
        args.push("--speaker", trimmedVoiceId);
      } else if (this.config.speaker !== undefined) {
        args.push("--speaker", String(this.config.speaker));
      }

      // Translate generic speed (1.0 = normal, 2.0 = 2x faster) to Piper's --length-scale
      // In Piper: lengthScale is phoneme duration scale (0.5 = 2x faster, 2.0 = half speed)
      if (options?.speed !== undefined) {
        if (!Number.isFinite(options.speed) || options.speed <= 0) {
          throw new Error("TTS speed must be a positive number.");
        }
        const calculatedScale = 1.0 / options.speed;
        const formattedScale = Number(calculatedScale.toFixed(4));
        args.push("--length-scale", String(formattedScale));
      } else if (this.config.lengthScale !== undefined) {
        args.push("--length-scale", String(this.config.lengthScale));
      }

      if (this.config.noiseScale !== undefined) {
        args.push("--noise-scale", String(this.config.noiseScale));
      }

      if (this.config.noiseW !== undefined) {
        args.push("--noise-w", String(this.config.noiseW));
      }

      if (this.config.sentenceSilenceSeconds !== undefined) {
        args.push("--sentence-silence", String(this.config.sentenceSilenceSeconds));
      }

      return await new Promise<TTSResult>((resolve, reject) => {
        let settled = false;

        const child = this.spawnFn(this.config.binaryPath, args, {
          shell: false,
          stdio: ["pipe", "ignore", "pipe"],
        });

        const stderrChunks: Buffer[] = [];
        let stderrBytes = 0;

        child.stderr.on("data", (chunk: Buffer) => {
          if (stderrBytes < MAX_STDERR_BUFFER_BYTES) {
            const remaining = MAX_STDERR_BUFFER_BYTES - stderrBytes;
            const slice =
              chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
            stderrChunks.push(slice);
            stderrBytes += slice.length;
          }
        });

        // Avoid unhandled EPIPE if the child process exits before/during stdin write
        child.stdin.on("error", () => {});

        const cleanup = () => {
          if (options?.signal && abortHandler) {
            options.signal.removeEventListener("abort", abortHandler);
          }
        };

        const abortHandler = () => {
          if (!settled) {
            settled = true;
            cleanup();
            try {
              child.kill("SIGTERM");
            } catch {
              // ignore
            }
            reject(new DOMException("The operation was aborted.", "AbortError"));
          }
        };

        if (options?.signal) {
          options.signal.addEventListener("abort", abortHandler);
        }

        let timeoutId: NodeJS.Timeout | undefined;
        if (this.config.timeoutMs && this.config.timeoutMs > 0) {
          timeoutId = setTimeout(() => {
            if (!settled) {
              settled = true;
              cleanup();
              try {
                child.kill("SIGTERM");
              } catch {
                // ignore
              }
              reject(
                new Error(
                  `Piper process timed out after ${this.config.timeoutMs}ms.`,
                ),
              );
            }
          }, this.config.timeoutMs);
        }

        child.on("error", (err) => {
          if (!settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            cleanup();
            reject(new Error(`Failed to execute Piper process: ${err.message}`));
          }
        });

        child.on("close", async (code) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          cleanup();

          if (code !== 0) {
            const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
            reject(
              new Error(
                `Piper process exited with code ${code}${stderr ? `: ${stderr}` : "."}`,
              ),
            );
            return;
          }

          tempFileCreated = true;
          let audio: Buffer;
          try {
            audio = await this.readFileFn(tempFilePath);
          } catch (readErr) {
            reject(
              new Error(
                `Failed to read synthesized audio file: ${readErr instanceof Error ? readErr.message : String(readErr)}`,
              ),
            );
            return;
          }

          if (!audio || audio.length === 0) {
            reject(new Error("Piper returned empty audio output."));
            return;
          }

          if (
            audio.length < 12 ||
            audio.subarray(0, 4).toString("ascii") !== "RIFF" ||
            audio.subarray(8, 12).toString("ascii") !== "WAVE"
          ) {
            reject(
              new Error(
                "Piper produced invalid WAV output: missing RIFF/WAVE header.",
              ),
            );
            return;
          }

          resolve({
            audio,
            mimeType: "audio/wav",
            characterCount: text.length,
          });
        });

        try {
          child.stdin.write(text, "utf-8");
          child.stdin.end();
        } catch (err) {
          if (!settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            cleanup();
            reject(err);
          }
        }
      });
    } finally {
      if (tempFileCreated) {
        try {
          await this.unlinkFn(tempFilePath);
        } catch (err: unknown) {
          const nodeErr = err as { code?: string };
          if (nodeErr?.code !== "ENOENT") {
            throw new Error(
              `Failed to clean up temporary audio file: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }
  }
}
