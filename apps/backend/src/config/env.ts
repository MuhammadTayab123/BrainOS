import { z } from "zod";

// Define environment schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required"),

  CLERK_SECRET_KEY: z
    .string()
    .min(1, "CLERK_SECRET_KEY is required"),

  CLERK_WEBHOOK_SECRET: z
    .string()
    .min(1, "CLERK_WEBHOOK_SECRET is required"),

  // Reserved for future phases
  OLLAMA_BASE_URL: z.string().optional(),

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