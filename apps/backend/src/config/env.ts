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
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:\n");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;