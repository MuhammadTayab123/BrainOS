import { describe, expect, it, vi } from "vitest";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import {
  createTTSProvider,
  PiperTTSProvider,
  MAX_PIPER_STDERR_BUFFER_BYTES,
} from "../../src/services/voice";

interface MockChildProcess extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: ReturnType<typeof vi.fn>;
}

function createMockChildProcess(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn();
  return child;
}

describe("PiperTTSProvider", () => {
  describe("Constructor & Config Validation", () => {
    it("fails closed when binaryPath is missing or whitespace", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "",
            modelPath: "model.onnx",
          }),
      ).toThrow("PiperTTSProvider requires a non-empty binaryPath.");

      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "   ",
            modelPath: "model.onnx",
          }),
      ).toThrow("PiperTTSProvider requires a non-empty binaryPath.");
    });

    it("fails closed when modelPath is missing or whitespace", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "",
          }),
      ).toThrow("PiperTTSProvider requires a non-empty modelPath.");

      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "  ",
          }),
      ).toThrow("PiperTTSProvider requires a non-empty modelPath.");
    });

    it("fails closed when speaker is negative or not an integer", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            speaker: -1,
          }),
      ).toThrow("PiperTTSProvider speaker must be a non-negative integer.");

      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            speaker: 2.5,
          }),
      ).toThrow("PiperTTSProvider speaker must be a non-negative integer.");
    });

    it("fails closed when lengthScale is non-positive or invalid", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            lengthScale: 0,
          }),
      ).toThrow("PiperTTSProvider lengthScale must be a positive number.");

      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            lengthScale: -1.2,
          }),
      ).toThrow("PiperTTSProvider lengthScale must be a positive number.");

      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            lengthScale: NaN,
          }),
      ).toThrow("PiperTTSProvider lengthScale must be a positive number.");
    });

    it("fails closed when noiseScale is non-positive", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            noiseScale: 0,
          }),
      ).toThrow("PiperTTSProvider noiseScale must be a positive number.");
    });

    it("fails closed when noiseW is non-positive", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            noiseW: -0.5,
          }),
      ).toThrow("PiperTTSProvider noiseW must be a positive number.");
    });

    it("fails closed when sentenceSilenceSeconds is negative", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            sentenceSilenceSeconds: -0.1,
          }),
      ).toThrow("PiperTTSProvider sentenceSilenceSeconds must be a non-negative number.");
    });

    it("fails closed when timeoutMs is non-positive or not an integer", () => {
      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            timeoutMs: 0,
          }),
      ).toThrow("PiperTTSProvider timeoutMs must be a positive integer.");

      expect(
        () =>
          new PiperTTSProvider({
            binaryPath: "piper",
            modelPath: "model.onnx",
            timeoutMs: -500,
          }),
      ).toThrow("PiperTTSProvider timeoutMs must be a positive integer.");
    });
  });

  describe("Text Input Validation", () => {
    it("fails closed when text is empty or whitespace", async () => {
      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
      });

      await expect(provider.synthesize("")).rejects.toThrow(
        "Text cannot be empty for speech synthesis.",
      );
      await expect(provider.synthesize("   ")).rejects.toThrow(
        "Text cannot be empty for speech synthesis.",
      );
    });
  });

  describe("CLI Execution, Temp File Handling & WAV Output", () => {
    it("executes Piper CLI with spawn shell:false, writes text to stdin, and cleans up WAV file", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      let observedTempFile = "";
      let capturedStdin = "";
      const mockChild = createMockChildProcess();

      mockChild.stdin.on("data", (chunk: Buffer) => {
        capturedStdin += chunk.toString("utf-8");
      });

      const mockSpawn = vi.fn((command, args, options) => {
        expect(command).toBe("custom-piper-bin");
        expect(options).toEqual({
          shell: false,
          stdio: ["pipe", "ignore", "pipe"],
        });

        const argList = args as string[];
        expect(argList).toContain("--model");
        expect(argList[argList.indexOf("--model") + 1]).toBe("voices/en.onnx");
        expect(argList).toContain("--output_file");
        observedTempFile = argList[argList.indexOf("--output_file") + 1];
        expect(observedTempFile).toContain("brainos-piper-");
        expect(observedTempFile.endsWith(".wav")).toBe(true);

        expect(argList).toContain("--config");
        expect(argList[argList.indexOf("--config") + 1]).toBe("voices/en.onnx.json");
        expect(argList).toContain("--speaker");
        expect(argList[argList.indexOf("--speaker") + 1]).toBe("3");
        expect(argList).toContain("--noise-scale");
        expect(argList[argList.indexOf("--noise-scale") + 1]).toBe("0.667");
        expect(argList).toContain("--noise-w");
        expect(argList[argList.indexOf("--noise-w") + 1]).toBe("0.8");
        expect(argList).toContain("--sentence-silence");
        expect(argList[argList.indexOf("--sentence-silence") + 1]).toBe("0.2");

        // Simulate Piper writing WAV file and closing
        setImmediate(async () => {
          const fakeWav = Buffer.from("RIFF1234WAVEfmt ");
          await writeFile(observedTempFile, fakeWav);
          mockChild.emit("close", 0);
        });

        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "custom-piper-bin",
          modelPath: "voices/en.onnx",
          configPath: "voices/en.onnx.json",
          speaker: 3,
          noiseScale: 0.667,
          noiseW: 0.8,
          sentenceSilenceSeconds: 0.2,
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        const text = "Hello from Piper TTS!";
        const result = await provider.synthesize(text);

        expect(mockSpawn).toHaveBeenCalledTimes(1);
        expect(capturedStdin).toBe(text);
        expect(result.mimeType).toBe("audio/wav");
        expect(result.characterCount).toBe(text.length);
        expect(result.audio).toEqual(Buffer.from("RIFF1234WAVEfmt "));
        // Verified temp file was cleaned up in finally
        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("prepends custom command args (such as python.exe -m piper) before Piper arguments", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      let observedTempFile = "";
      let capturedArgs: string[] = [];
      const mockChild = createMockChildProcess();

      const mockSpawn = vi.fn((command, args) => {
        expect(command).toBe("python.exe");
        capturedArgs = args as string[];
        observedTempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(observedTempFile, Buffer.from("RIFF1234WAVEfmt "));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "python.exe",
          args: ["-m", "piper"],
          modelPath: "models/voice.onnx",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await provider.synthesize("Hello python piper");

        expect(mockSpawn).toHaveBeenCalledTimes(1);
        expect(capturedArgs.slice(0, 2)).toEqual(["-m", "piper"]);
        expect(capturedArgs).toContain("--model");
        expect(capturedArgs[capturedArgs.indexOf("--model") + 1]).toBe("models/voice.onnx");
        expect(capturedArgs).toContain("--output_file");
        expect(existsSync(observedTempFile)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed when Piper returns empty audio output", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.alloc(0));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "piper",
          modelPath: "model.onnx",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(provider.synthesize("Hello world")).rejects.toThrow(
          "Piper returned empty audio output.",
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed when Piper returns invalid WAV output without RIFF/WAVE header", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "piper",
          modelPath: "model.onnx",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(provider.synthesize("Hello world")).rejects.toThrow(
          "Piper produced invalid WAV output: missing RIFF/WAVE header.",
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed when Piper returns audio shorter than 12 bytes", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.from("RIFF"));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "piper",
          modelPath: "model.onnx",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        await expect(provider.synthesize("Hello world")).rejects.toThrow(
          "Piper produced invalid WAV output: missing RIFF/WAVE header.",
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed on non-zero exit code with captured stderr", async () => {
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn(() => {
        setImmediate(() => {
          mockChild.stderr.write("Model file corrupted\n");
          mockChild.stderr.end();
          mockChild.emit("close", 1);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
        spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
      });

      await expect(provider.synthesize("Hello world")).rejects.toThrow(
        "Piper process exited with code 1: Model file corrupted",
      );
    });

    it("bounds captured stderr to 8 KB on error output", async () => {
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn(() => {
        setImmediate(() => {
          const largeStderr = "E".repeat(16 * 1024);
          mockChild.stderr.write(largeStderr);
          mockChild.stderr.end();
          mockChild.emit("close", 2);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
        spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
      });

      let caughtError: Error | null = null;
      try {
        await provider.synthesize("Hello world");
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError).not.toBeNull();
      const prefix = "Piper process exited with code 2: ";
      expect(caughtError!.message.startsWith(prefix)).toBe(true);
      const stderrContent = caughtError!.message.slice(prefix.length);
      expect(stderrContent.length).toBe(MAX_PIPER_STDERR_BUFFER_BYTES);
      expect(stderrContent).toBe("E".repeat(MAX_PIPER_STDERR_BUFFER_BYTES));
    });

    it("fails closed when spawn emits an error (e.g. binary not found)", async () => {
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn(() => {
        setImmediate(() => {
          mockChild.emit("error", new Error("spawn ENOENT"));
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const provider = new PiperTTSProvider({
        binaryPath: "nonexistent-piper",
        modelPath: "model.onnx",
        spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
      });

      await expect(provider.synthesize("Hello")).rejects.toThrow(
        "Failed to execute Piper process: spawn ENOENT",
      );
    });

    it("fails closed when temp file cleanup fails with a non-ENOENT error", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      const mockChild = createMockChildProcess();
      const mockSpawn = vi.fn((_cmd, args) => {
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.from("RIFF1234WAVEfmt "));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const epermError = new Error("EPERM: operation not permitted");
      (epermError as unknown as { code: string }).code = "EPERM";
      const mockUnlink = vi.fn().mockRejectedValue(epermError);

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "piper",
          modelPath: "model.onnx",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
          unlinkFn: mockUnlink,
        });

        await expect(provider.synthesize("Hello")).rejects.toThrow(
          /Failed to clean up temporary audio file: EPERM/,
        );
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });

  describe("Voice / Speaker, Speed, Pitch, and Format Mapping & Validation", () => {
    it("fails closed for unsupported format (anything other than audio/wav)", async () => {
      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
      });

      await expect(
        provider.synthesize("Hello", { format: "audio/mp3" }),
      ).rejects.toThrow('PiperTTSProvider only supports "audio/wav" format.');

      await expect(
        provider.synthesize("Hello", { format: "audio/ogg" }),
      ).rejects.toThrow('PiperTTSProvider only supports "audio/wav" format.');
    });

    it("fails closed for unsupported pitch option", async () => {
      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
      });

      await expect(
        provider.synthesize("Hello", { pitch: 1.2 }),
      ).rejects.toThrow("PiperTTSProvider does not support pitch adjustment.");
    });

    it("fails closed for non-numeric or negative voiceId", async () => {
      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
      });

      await expect(
        provider.synthesize("Hello", { voiceId: "speaker-amy" }),
      ).rejects.toThrow("PiperTTSProvider voiceId must be a non-negative integer string.");

      await expect(
        provider.synthesize("Hello", { voiceId: "-1" }),
      ).rejects.toThrow("PiperTTSProvider voiceId must be a non-negative integer string.");

      await expect(
        provider.synthesize("Hello", { voiceId: "1.5" }),
      ).rejects.toThrow("PiperTTSProvider voiceId must be a non-negative integer string.");
    });

    it("maps TTSOptions.voiceId to --speaker, overriding config speaker", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      const mockChild = createMockChildProcess();
      let capturedArgs: string[] = [];

      const mockSpawn = vi.fn((_cmd, args) => {
        capturedArgs = args as string[];
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.from("RIFF1234WAVEfmt "));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "piper",
          modelPath: "model.onnx",
          speaker: 1, // default speaker in config
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        // Call with voiceId override: "5"
        await provider.synthesize("Testing voice mapping", { voiceId: "5" });

        expect(capturedArgs).toContain("--speaker");
        expect(capturedArgs[capturedArgs.indexOf("--speaker") + 1]).toBe("5");
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("translates generic speed to Piper --length-scale correctly", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      let capturedArgs: string[] = [];

      const mockSpawn = vi.fn((_cmd, args) => {
        capturedArgs = args as string[];
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        const child = createMockChildProcess();
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.from("RIFF1234WAVEfmt "));
          child.emit("close", 0);
        });
        return child as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = new PiperTTSProvider({
          binaryPath: "piper",
          modelPath: "model.onnx",
          tempDir,
          spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
        });

        // Speed 2.0x (faster speech) -> lengthScale 0.5 (half duration)
        await provider.synthesize("Fast speech", { speed: 2.0 });
        expect(capturedArgs).toContain("--length-scale");
        expect(capturedArgs[capturedArgs.indexOf("--length-scale") + 1]).toBe("0.5");

        // Speed 0.5x (slower speech) -> lengthScale 2.0 (double duration)
        await provider.synthesize("Slow speech", { speed: 0.5 });
        expect(capturedArgs).toContain("--length-scale");
        expect(capturedArgs[capturedArgs.indexOf("--length-scale") + 1]).toBe("2");

        // Speed 1.0x (normal speech) -> lengthScale 1.0
        await provider.synthesize("Normal speech", { speed: 1.0 });
        expect(capturedArgs).toContain("--length-scale");
        expect(capturedArgs[capturedArgs.indexOf("--length-scale") + 1]).toBe("1");
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("rejects non-positive or invalid speed option", async () => {
      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
      });

      await expect(
        provider.synthesize("Text", { speed: 0 }),
      ).rejects.toThrow("TTS speed must be a positive number.");

      await expect(
        provider.synthesize("Text", { speed: -1 }),
      ).rejects.toThrow("TTS speed must be a positive number.");

      await expect(
        provider.synthesize("Text", { speed: NaN }),
      ).rejects.toThrow("TTS speed must be a positive number.");
    });
  });

  describe("Cancellation & Timeout Handling", () => {
    it("rejects pre-aborted signal immediately before spawn", async () => {
      const controller = new AbortController();
      controller.abort();

      const mockSpawn = vi.fn();
      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
        spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
      });

      await expect(
        provider.synthesize("Hello", { signal: controller.signal }),
      ).rejects.toThrow("The operation was aborted.");

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("terminates child process with SIGTERM on in-flight abort", async () => {
      const controller = new AbortController();
      const mockChild = createMockChildProcess();

      const mockSpawn = vi.fn(() => {
        mockChild.kill.mockImplementation(() => {
          mockChild.emit("close", null);
        });
        setImmediate(() => {
          controller.abort();
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
        spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
      });

      const promise = provider.synthesize("Speaking text", {
        signal: controller.signal,
      });

      await expect(promise).rejects.toThrow("The operation was aborted.");
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("terminates child process with SIGTERM and fails closed on timeout", async () => {
      const mockChild = createMockChildProcess();

      const mockSpawn = vi.fn(() => {
        mockChild.kill.mockImplementation(() => {
          mockChild.emit("close", null);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      const provider = new PiperTTSProvider({
        binaryPath: "piper",
        modelPath: "model.onnx",
        timeoutMs: 50,
        spawnFn: mockSpawn as unknown as typeof childProcess.spawn,
      });

      await expect(provider.synthesize("Speaking text")).rejects.toThrow(
        "Piper process timed out after 50ms.",
      );
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });

  describe("Factory Integration", () => {
    it("creates PiperTTSProvider via createTTSProvider with canonical name piper", () => {
      const provider = createTTSProvider("piper", {
        binaryPath: "piper",
        modelPath: "voices/en-us.onnx",
        speaker: 2,
      });

      expect(provider).toBeInstanceOf(PiperTTSProvider);
    });

    it("passes args array to PiperTTSProvider from factory config", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "piper-test-"));
      const mockChild = createMockChildProcess();
      let capturedCommand = "";
      let capturedArgs: string[] = [];

      const mockSpawn = vi.fn((command, args) => {
        capturedCommand = command;
        capturedArgs = args as string[];
        const tempFile = (args as string[])[(args as string[]).indexOf("--output_file") + 1];
        setImmediate(async () => {
          await writeFile(tempFile, Buffer.from("RIFF1234WAVEfmt "));
          mockChild.emit("close", 0);
        });
        return mockChild as unknown as childProcess.ChildProcess;
      });

      try {
        const provider = createTTSProvider("piper", {
          binaryPath: "python.exe",
          args: ["-m", "piper"],
          modelPath: "voices/en-us.onnx",
          tempDir,
          spawnFn: mockSpawn,
        });

        expect(provider).toBeInstanceOf(PiperTTSProvider);
        await (provider as PiperTTSProvider).synthesize("Hello from factory");
        expect(capturedCommand).toBe("python.exe");
        expect(capturedArgs.slice(0, 2)).toEqual(["-m", "piper"]);
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    it("fails closed when piper is chosen but required binaryPath or modelPath are missing", () => {
      expect(() => createTTSProvider("piper", { binaryPath: "" })).toThrow(
        "PiperTTSProvider requires a non-empty binaryPath.",
      );

      expect(() =>
        createTTSProvider("piper", { binaryPath: "piper", modelPath: "" }),
      ).toThrow("PiperTTSProvider requires a non-empty modelPath.");
    });
  });
});
