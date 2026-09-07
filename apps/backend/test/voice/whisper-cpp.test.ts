import { describe, expect, it, vi } from "vitest";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import {
  createSTTProvider,
  WhisperCppSTTProvider,
} from "../../src/services/voice";

interface MockChildProcess extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createMockChildProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe("WhisperCppSTTProvider", () => {
  describe("Constructor & Config Validation", () => {
    it("fails closed when binaryPath is missing or whitespace", () => {
      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "",
            modelPath: "model.bin",
          }),
      ).toThrow("WhisperCppSTTProvider requires a non-empty binaryPath.");

      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "   ",
            modelPath: "model.bin",
          }),
      ).toThrow("WhisperCppSTTProvider requires a non-empty binaryPath.");
    });

    it("fails closed when modelPath is missing or whitespace", () => {
      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "",
          }),
      ).toThrow("WhisperCppSTTProvider requires a non-empty modelPath.");

      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "  ",
          }),
      ).toThrow("WhisperCppSTTProvider requires a non-empty modelPath.");
    });

    it("fails closed when threads is non-positive or not an integer", () => {
      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "model.bin",
            threads: 0,
          }),
      ).toThrow("WhisperCppSTTProvider threads must be a positive integer.");

      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "model.bin",
            threads: -4,
          }),
      ).toThrow("WhisperCppSTTProvider threads must be a positive integer.");

      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "model.bin",
            threads: 2.5,
          }),
      ).toThrow("WhisperCppSTTProvider threads must be a positive integer.");
    });

    it("fails closed when timeoutMs is non-positive or not an integer", () => {
      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "model.bin",
            timeoutMs: 0,
          }),
      ).toThrow("WhisperCppSTTProvider timeoutMs must be a positive integer.");

      expect(
        () =>
          new WhisperCppSTTProvider({
            binaryPath: "whisper-cli",
            modelPath: "model.bin",
            timeoutMs: -500,
          }),
      ).toThrow("WhisperCppSTTProvider timeoutMs must be a positive integer.");
    });
  });

  describe("Audio Input Validation", () => {
    it("fails closed when audio data is empty", async () => {
      const provider = new WhisperCppSTTProvider({
        binaryPath: "whisper-cli",
        modelPath: "model.bin",
      });

      await expect(
        provider.transcribe({ data: Buffer.alloc(0) }),
      ).rejects.toThrow("Audio data cannot be empty for transcription.");
    });
  });

  describe("Argument Construction, Execution & Temp File Cleanup", () => {
    it("executes CLI with correct arguments and cleans up temporary wav file on success", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      let observedTempFile = "";

      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((command, args, options) => {
        expect(command).toBe("custom-whisper-bin");
        expect(options).toEqual({
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });

        // Check arguments
        const argList = args as string[];
        expect(argList).toContain("-m");
        expect(argList[argList.indexOf("-m") + 1]).toBe("models/base.bin");
        expect(argList).toContain("-f");
        observedTempFile = argList[argList.indexOf("-f") + 1];
        expect(observedTempFile).toContain("brainos-whisper-");
        expect(observedTempFile.endsWith(".wav")).toBe(true);
        expect(existsSync(observedTempFile)).toBe(true);

        expect(argList).toContain("-nt");
        expect(argList).toContain("-np");
        expect(argList).toContain("-t");
        expect(argList[argList.indexOf("-t") + 1]).toBe("4");
        expect(argList).toContain("-l");
        expect(argList[argList.indexOf("-l") + 1]).toBe("en");

        // Simulate whisper.cpp stdout output and clean exit
        setImmediate(() => {
          mockChild.stdout.write("  This is transcribed speech from whisper.cpp  \n");
          mockChild.stdout.end();
          mockChild.emit("close", 0);
        });

        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "custom-whisper-bin",
          modelPath: "models/base.bin",
          threads: 4,
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        const result = await provider.transcribe(
          { data: Buffer.from("RIFF....WAVEfmt ") },
          { language: "en" },
        );

        expect(mockSpawn).toHaveBeenCalledTimes(1);
        expect(result.transcript).toBe(
          "This is transcribed speech from whisper.cpp",
        );
        expect(result.isFinal).toBe(true);
        expect(result.language).toBe("en");

        // Verify temp file was cleaned up in finally
        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed when whisper.cpp returns empty transcript and still cleans up temp file", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      let observedTempFile = "";

      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        observedTempFile = (args as string[])[(args as string[]).indexOf("-f") + 1];
        setImmediate(() => {
          mockChild.stdout.write("   \n\t  ");
          mockChild.stdout.end();
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(
          provider.transcribe({ data: Buffer.from([1, 2, 3]) }),
        ).rejects.toThrow("whisper.cpp returned an empty transcript.");

        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed on non-zero exit code and cleans up temp file", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      let observedTempFile = "";

      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        observedTempFile = (args as string[])[(args as string[]).indexOf("-f") + 1];
        setImmediate(() => {
          mockChild.stderr.write("failed to load model\n");
          mockChild.stderr.end();
          mockChild.emit("close", 1);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(
          provider.transcribe({ data: Buffer.from([1, 2, 3]) }),
        ).rejects.toThrow(/whisper\.cpp process exited with code 1: failed to load model/);

        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("bounds captured stderr to 8 KB on error output", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, _args) => {
        setImmediate(() => {
          // Send 16 KB of stderr data
          const largeStderr = "E".repeat(16 * 1024);
          mockChild.stderr.write(largeStderr);
          mockChild.stderr.end();
          mockChild.emit("close", 1);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        let caughtError: Error | null = null;
        try {
          await provider.transcribe({ data: Buffer.from([1, 2, 3]) });
        } catch (err) {
          caughtError = err as Error;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError!.message).toContain("whisper.cpp process exited with code 1: ");
        // The prefix is "whisper.cpp process exited with code 1: " (40 chars)
        // The stderr part should be exactly 8192 characters of 'E'
        const stderrPart = caughtError!.message.replace("whisper.cpp process exited with code 1: ", "");
        expect(stderrPart.length).toBe(8 * 1024);
        expect(stderrPart).toBe("E".repeat(8 * 1024));
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed when temporary file cleanup fails with a non-ENOENT error", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, _args) => {
        setImmediate(() => {
          mockChild.stdout.write("valid transcription");
          mockChild.stdout.end();
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const epermError = new Error("EPERM: operation not permitted");
      (epermError as unknown as { code: string }).code = "EPERM";
      const mockUnlink = vi.fn().mockRejectedValue(epermError);

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
          unlinkFn: mockUnlink,
        });

        await expect(
          provider.transcribe({ data: Buffer.from([1, 2, 3]) }),
        ).rejects.toThrow(/Failed to clean up temporary audio file: EPERM/);
        expect(mockUnlink).toHaveBeenCalledTimes(1);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("ignores ENOENT error during cleanup and succeeds if transcription succeeded", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, _args) => {
        setImmediate(() => {
          mockChild.stdout.write("valid transcription");
          mockChild.stdout.end();
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const enoentError = new Error("ENOENT: no such file or directory");
      (enoentError as unknown as { code: string }).code = "ENOENT";
      const mockUnlink = vi.fn().mockRejectedValue(enoentError);

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
          unlinkFn: mockUnlink,
        });

        const result = await provider.transcribe({ data: Buffer.from([1, 2, 3]) });
        expect(result.transcript).toBe("valid transcription");
        expect(mockUnlink).toHaveBeenCalledTimes(1);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed on spawn failure (ENOENT) and cleans up temp file", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      let observedTempFile = "";

      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        observedTempFile = (args as string[])[(args as string[]).indexOf("-f") + 1];
        setImmediate(() => {
          mockChild.emit("error", new Error("spawn ENOENT"));
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "invalid-bin",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(
          provider.transcribe({ data: Buffer.from([1, 2, 3]) }),
        ).rejects.toThrow("Failed to execute whisper.cpp process: spawn ENOENT");

        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });

  describe("Cancellation & Timeout Handling", () => {
    it("rejects pre-aborted signal immediately before spawn and cleans up temp file", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      const controller = new AbortController();
      controller.abort();

      const mockSpawn = vi.fn();

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(
          provider.transcribe(
            { data: Buffer.from([1, 2, 3]) },
            { signal: controller.signal },
          ),
        ).rejects.toThrow("The operation was aborted.");

        expect(mockSpawn).not.toHaveBeenCalled();

        const readdir = await import("node:fs/promises").then((m) =>
          m.readdir(tempDir),
        );
        expect(readdir).toHaveLength(0);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("terminates child process with SIGTERM and cleans up temp file on in-flight abort", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      const controller = new AbortController();
      let observedTempFile = "";

      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        observedTempFile = (args as string[])[(args as string[]).indexOf("-f") + 1];
        mockChild.kill.mockImplementation(() => {
          mockChild.emit("close", null);
        });
        setImmediate(() => {
          controller.abort();
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        const promise = provider.transcribe(
          { data: Buffer.from([1, 2, 3]) },
          { signal: controller.signal },
        );

        await expect(promise).rejects.toThrow("The operation was aborted.");
        expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("terminates child process and cleans up temp file on timeout", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "whisper-test-"));
      let observedTempFile = "";

      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        observedTempFile = (args as string[])[(args as string[]).indexOf("-f") + 1];
        mockChild.kill.mockImplementation(() => {
          mockChild.emit("close", null);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new WhisperCppSTTProvider({
          binaryPath: "whisper-cli",
          modelPath: "model.bin",
          timeoutMs: 50,
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(
          provider.transcribe({ data: Buffer.from([1, 2, 3]) }),
        ).rejects.toThrow("whisper.cpp process timed out after 50ms.");

        expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });

  describe("Factory Integration", () => {
    it("creates WhisperCppSTTProvider via createSTTProvider with canonical name whisper-cpp", () => {
      const provider = createSTTProvider("whisper-cpp", {
        binaryPath: "whisper-cli",
        modelPath: "models/ggml-base.bin",
        threads: 4,
      });

      expect(provider).toBeInstanceOf(WhisperCppSTTProvider);
    });

    it("fails closed when whisper-cpp is chosen but required paths are missing", () => {
      expect(() => createSTTProvider("whisper-cpp", {})).toThrow(
        "WhisperCppSTTProvider requires a non-empty binaryPath.",
      );
    });
  });
});
