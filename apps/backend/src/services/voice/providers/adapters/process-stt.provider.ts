import { spawn } from "node:child_process";
import { AudioChunk, STTOptions, STTResult } from "../../voice.types";
import { STTProvider } from "../stt.provider";

export interface ProcessSTTConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export class ProcessSTTProvider implements STTProvider {
  constructor(private readonly config: ProcessSTTConfig) {
    if (!config.command || config.command.trim().length === 0) {
      throw new Error("ProcessSTTProvider requires a non-empty executable command.");
    }
  }

  async transcribe(
    audio: AudioChunk,
    options?: STTOptions,
  ): Promise<STTResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const command = this.config.command;
    const args = [...(this.config.args ?? [])];

    if (options?.language) {
      args.push("--language", options.language);
    }

    return new Promise<STTResult>((resolve, reject) => {
      let settled = false;

      const child = spawn(command, args, {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

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
            reject(new Error(`STT process timed out after ${this.config.timeoutMs}ms.`));
          }
        }, this.config.timeoutMs);
      }

      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          cleanup();
          reject(new Error(`Failed to execute STT process: ${err.message}`));
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
              `STT process exited with code ${code}${stderr ? `: ${stderr}` : "."}`,
            ),
          );
          return;
        }

        const transcript = Buffer.concat(stdoutChunks).toString("utf-8").trim();
        resolve({
          transcript,
          isFinal: true,
          language: options?.language,
        });
      });

      // Pipe audio data to child stdin
      try {
        if (audio.data && audio.data.length > 0) {
          child.stdin.write(audio.data);
        }
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
  }
}
