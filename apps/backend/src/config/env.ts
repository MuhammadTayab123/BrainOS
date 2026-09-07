import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

// Define environment schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "CLERK_PUBLISHABLE_KEY is required"),

  CLERK_SECRET_KEY: z
    .string()
    .min(1, "CLERK_SECRET_KEY is required"),

  CLERK_WEBHOOK_SECRET: z
    .string()
    .min(1, "CLERK_WEBHOOK_SECRET is required"),

    // ==========================
  // AI Providers
  // ==========================

  LLM_PROVIDER: z
    .enum(["ollama", "omniroute"])
    .default("ollama"),

  OLLAMA_HOST: z
    .string()
    .default("http://localhost:11434"),

  OLLAMA_CHAT_MODEL: z
    .string()
    .default("qwen2.5:3b"),

  OLLAMA_EMBEDDING_MODEL: z
    .string()
    .default("nomic-embed-text"),

  OPENAI_API_KEY: z.string().optional(),

  AZURE_OPENAI_API_KEY: z.string().optional(),

  AZURE_OPENAI_ENDPOINT: z.string().optional(),

  GOOGLE_API_KEY: z.string().optional(),

  OMNIROUTE_HOST: z
    .string()
    .default("http://localhost:20128"),

  OMNIROUTE_API_KEY: z
    .string()
    .optional(),

  OMNIROUTE_MODEL: z
    .string()
    .default("BrainOS-Coding"),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),

  // ==========================
  // Voice Providers (Optional)
  // ==========================

  VOICE_STT_PROVIDER: z
    .enum(["mock", "process", "http", "whisper-cpp"])
    .default("mock"),

  VOICE_STT_PROCESS_COMMAND: z.string().optional(),

  VOICE_STT_PROCESS_ARGS: z.string().optional(),

  VOICE_STT_HTTP_ENDPOINT: z.string().optional(),

  VOICE_STT_HTTP_API_KEY: z.string().optional(),

  VOICE_WHISPER_BIN_PATH: z.string().optional(),

  VOICE_WHISPER_MODEL_PATH: z.string().optional(),

  VOICE_WHISPER_THREADS: z.coerce.number().int().positive().optional(),

  VOICE_TTS_PROVIDER: z
    .enum(["mock", "process", "http", "piper"])
    .default("mock"),

  VOICE_TTS_PROCESS_COMMAND: z.string().optional(),

  VOICE_TTS_PROCESS_ARGS: z.string().optional(),

  VOICE_TTS_HTTP_ENDPOINT: z.string().optional(),

  VOICE_TTS_HTTP_API_KEY: z.string().optional(),

  VOICE_PIPER_BIN_PATH: z.string().optional(),

  VOICE_PIPER_ARGS: z.string().optional(),

  VOICE_PIPER_MODEL_PATH: z.string().optional(),

  VOICE_PIPER_CONFIG_PATH: z.string().optional(),

  VOICE_PIPER_SPEAKER: z.coerce.number().int().nonnegative().optional(),

  VOICE_PIPER_LENGTH_SCALE: z.coerce.number().positive().optional(),

  VOICE_PIPER_NOISE_SCALE: z.coerce.number().positive().optional(),

  VOICE_PIPER_NOISE_W: z.coerce.number().positive().optional(),

  VOICE_PIPER_SENTENCE_SILENCE: z.coerce.number().nonnegative().optional(),

  VOICE_VAD_PROVIDER: z
    .enum(["mock"])
    .default("mock"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;