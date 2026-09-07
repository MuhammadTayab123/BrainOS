import { env } from "../../config/env";
import { STTProvider } from "./providers/stt.provider";
import { TTSProvider } from "./providers/tts.provider";
import { VADProvider } from "./providers/vad.provider";
import { MockSTTProvider } from "./providers/mock/mock-stt.provider";
import { MockTTSProvider } from "./providers/mock/mock-tts.provider";
import { MockVADProvider } from "./providers/mock/mock-vad.provider";
import {
  HttpSTTConfig,
  HttpSTTProvider,
  HttpTTSConfig,
  HttpTTSProvider,
  ProcessSTTConfig,
  ProcessSTTProvider,
  ProcessTTSConfig,
  ProcessTTSProvider,
  WhisperCppSTTConfig,
  WhisperCppSTTProvider,
} from "./providers/adapters";

export type VoiceProviderType = "mock" | "process" | "http" | "whisper-cpp";

export function createSTTProvider(
  type: string = env.VOICE_STT_PROVIDER ?? "mock",
  config?: Record<string, unknown>,
): STTProvider {
  switch (type.toLowerCase()) {
    case "mock":
      return new MockSTTProvider();

    case "process": {
      const processConfig: ProcessSTTConfig = {
        command:
          (config?.command as string) ??
          env.VOICE_STT_PROCESS_COMMAND ??
          "",
        args:
          (config?.args as string[]) ??
          (env.VOICE_STT_PROCESS_ARGS
            ? env.VOICE_STT_PROCESS_ARGS.split(" ").filter(Boolean)
            : []),
        cwd: config?.cwd as string | undefined,
        timeoutMs: config?.timeoutMs as number | undefined,
      };
      return new ProcessSTTProvider(processConfig);
    }

    case "http": {
      const httpConfig: HttpSTTConfig = {
        endpointUrl:
          (config?.endpointUrl as string) ??
          env.VOICE_STT_HTTP_ENDPOINT ??
          "",
        apiKey:
          (config?.apiKey as string) ??
          env.VOICE_STT_HTTP_API_KEY,
        headers: config?.headers as Record<string, string> | undefined,
        timeoutMs: config?.timeoutMs as number | undefined,
      };
      return new HttpSTTProvider(httpConfig);
    }

    case "whisper-cpp": {
      const whisperConfig: WhisperCppSTTConfig = {
        binaryPath:
          (config?.binaryPath as string) ??
          env.VOICE_WHISPER_BIN_PATH ??
          "",
        modelPath:
          (config?.modelPath as string) ??
          env.VOICE_WHISPER_MODEL_PATH ??
          "",
        threads:
          (config?.threads as number) ??
          env.VOICE_WHISPER_THREADS,
        timeoutMs: config?.timeoutMs as number | undefined,
        tempDir: config?.tempDir as string | undefined,
      };
      return new WhisperCppSTTProvider(whisperConfig);
    }

    default:
      throw new Error(`Unsupported Voice STT provider: ${type}`);
  }
}

export function createTTSProvider(
  type: string = env.VOICE_TTS_PROVIDER ?? "mock",
  config?: Record<string, unknown>,
): TTSProvider {
  switch (type.toLowerCase()) {
    case "mock":
      return new MockTTSProvider();

    case "process": {
      const processConfig: ProcessTTSConfig = {
        command:
          (config?.command as string) ??
          env.VOICE_TTS_PROCESS_COMMAND ??
          "",
        args:
          (config?.args as string[]) ??
          (env.VOICE_TTS_PROCESS_ARGS
            ? env.VOICE_TTS_PROCESS_ARGS.split(" ").filter(Boolean)
            : []),
        cwd: config?.cwd as string | undefined,
        defaultMimeType: config?.defaultMimeType as string | undefined,
        passTextAsArg: config?.passTextAsArg as boolean | undefined,
        timeoutMs: config?.timeoutMs as number | undefined,
      };
      return new ProcessTTSProvider(processConfig);
    }

    case "http": {
      const httpConfig: HttpTTSConfig = {
        endpointUrl:
          (config?.endpointUrl as string) ??
          env.VOICE_TTS_HTTP_ENDPOINT ??
          "",
        apiKey:
          (config?.apiKey as string) ??
          env.VOICE_TTS_HTTP_API_KEY,
        headers: config?.headers as Record<string, string> | undefined,
        defaultVoiceId: config?.defaultVoiceId as string | undefined,
        defaultFormat: config?.defaultFormat as string | undefined,
        timeoutMs: config?.timeoutMs as number | undefined,
      };
      return new HttpTTSProvider(httpConfig);
    }

    default:
      throw new Error(`Unsupported Voice TTS provider: ${type}`);
  }
}

export function createVADProvider(
  type: string = env.VOICE_VAD_PROVIDER ?? "mock",
): VADProvider {
  switch (type.toLowerCase()) {
    case "mock":
      return new MockVADProvider();

    default:
      throw new Error(`Unsupported Voice VAD provider: ${type}`);
  }
}
