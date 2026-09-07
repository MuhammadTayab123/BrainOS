import { spawn } from "node:child_process";
import { TTSOptions, TTSResult } from "../../voice.types";
import { TTSProvider } from "../tts.provider";

export interface ProcessTTSConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  defaultMimeType?: string;
  timeoutMs?: number;
  passTextAsArg?: boolean;
}

export class ProcessTTSProvider implements TTSProvider {
  constructor(private readonly config: ProcessTTSConfig) {
    if (!config.command || config.command.trim().length === 0) {
      throw new Error("ProcessTTSProvider requires a non-empty executable command.");
    }
  }

  async synthesize(
    text: string,
    options?: TTSOptions,
  ): Promise<TTSResult> {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const command = this.config.command;
    const args = [...(this.config.args ?? [])];

    if (options?.voiceId) {
      args.push("--voice", options.voiceId);
    }
    if (options?.speed !== undefined) {
      args.push("--speed", String(options.speed));
    }
    if (this.config.passTextAsArg) {
      args.push(text);
    }

    const mimeType = options?.format ?? this.config.defaultMimeType ?? "audio/wav";

    return new Promise<TTSResult>((resolve, reject) => {
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
            reject(new Error(`TTS process timed out after ${this.config.timeoutMs}ms.`));
          }
        }, this.config.timeoutMs);
      }

      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          if (timeoutId) clearTimeout(timeoutId);
          cleanup();
          reject(new Error(`Failed to execute TTS process: ${err.message}`));
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
              `TTS process exited with code ${code}${stderr ? `: ${stderr}` : "."}`,
            ),
          );
          return;
        }

        const audio = Buffer.concat(stdoutChunks);
        resolve({
          audio,
          mimeType,
          characterCount: text.length,
        });
      });

      // Write text to stdin if not passed as arg
      if (!this.config.passTextAsArg) {
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
      } else {
        child.stdin.end();
      }
    });
  }
}
