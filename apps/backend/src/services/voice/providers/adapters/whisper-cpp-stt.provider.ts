import * as childProcess from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AudioChunk, STTOptions, STTResult } from "../../voice.types";
import { STTProvider } from "../stt.provider";

export const MAX_STDERR_BUFFER_BYTES = 8 * 1024; // 8 KB limit

export interface WhisperCppSTTConfig {
  binaryPath: string;
  modelPath: string;
  threads?: number;
  timeoutMs?: number;
  tempDir?: string;
  spawnFn?: typeof childProcess.spawn;
  unlinkFn?: (path: string) => Promise<void>;
}

export class WhisperCppSTTProvider implements STTProvider {
  private readonly spawnFn: typeof childProcess.spawn;
  private readonly unlinkFn: (path: string) => Promise<void>;

  constructor(private readonly config: WhisperCppSTTConfig) {
    this.spawnFn = config.spawnFn ?? childProcess.spawn;
    this.unlinkFn = config.unlinkFn ?? unlink;
    if (!config.binaryPath || config.binaryPath.trim().length === 0) {
      throw new Error("WhisperCppSTTProvider requires a non-empty binaryPath.");
    }

    if (!config.modelPath || config.modelPath.trim().length === 0) {
      throw new Error("WhisperCppSTTProvider requires a non-empty modelPath.");
    }

    if (
      config.threads !== undefined &&
      (!Number.isInteger(config.threads) || config.threads <= 0)
    ) {
      throw new Error("WhisperCppSTTProvider threads must be a positive integer.");
    }

    if (
      config.timeoutMs !== undefined &&
      (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
    ) {
      throw new Error("WhisperCppSTTProvider timeoutMs must be a positive integer.");
    }
  }

  async transcribe(
    audio: AudioChunk,
    options?: STTOptions,
  ): Promise<STTResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    if (!audio.data || audio.data.length === 0) {
      throw new Error("Audio data cannot be empty for transcription.");
    }

    const tempDir = this.config.tempDir || os.tmpdir();
    const tempFileName = `brainos-whisper-${randomUUID()}.wav`;
    const tempFilePath = path.join(tempDir, tempFileName);

    let tempFileCreated = false;

    try {
      await writeFile(tempFilePath, audio.data);
      tempFileCreated = true;

      if (options?.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const args: string[] = [
        "-m",
        this.config.modelPath,
        "-f",
        tempFilePath,
        "-nt",
        "-np",
      ];

      if (this.config.threads) {
        args.push("-t", String(this.config.threads));
      }

      if (options?.language) {
        args.push("-l", options.language);
      }

      return await new Promise<STTResult>((resolve, reject) => {
        let settled = false;

        const child = this.spawnFn(this.config.binaryPath, args, {
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let stderrBytes = 0;

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => {
          if (stderrBytes < MAX_STDERR_BUFFER_BYTES) {
            const remaining = MAX_STDERR_BUFFER_BYTES - stderrBytes;
            const slice =
              chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
            stderrChunks.push(slice);
            stderrBytes += slice.length;
          }
        });

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
                  `whisper.cpp process timed out after ${this.config.timeoutMs}ms.`,
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
            reject(new Error(`Failed to execute whisper.cpp process: ${err.message}`));
          }
        });

        child.on("close", (code) => {
          if (settled) return;
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          cleanup();

          if (code !== 0) {
            const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
            reject(
              new Error(
                `whisper.cpp process exited with code ${code}${stderr ? `: ${stderr}` : "."}`,
              ),
            );
            return;
          }

          const transcript = Buffer.concat(stdoutChunks).toString("utf-8").trim();

          if (!transcript || transcript.length === 0) {
            reject(new Error("whisper.cpp returned an empty transcript."));
            return;
          }

          resolve({
            transcript,
            isFinal: true,
            language: options?.language,
          });
        });
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
