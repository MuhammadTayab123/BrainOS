import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { assertSafeTestEnvironment, TEST_DATABASE_NAME } from "./safety";

process.env.NODE_ENV = "test";

dotenv.config();

const testEnvPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath, override: true });
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (process.env.DATABASE_URL) {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    const dbName = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    if (dbName === "brainos" || dbName === "brainos_db") {
      parsed.pathname = `/${TEST_DATABASE_NAME}`;
      process.env.DATABASE_URL = parsed.toString();
    }
  } catch {
    // Leave invalid URL for assertSafeTestEnvironment to reject
  }
}

process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_placeholder";
process.env.CLERK_SECRET_KEY ??= "sk_test_placeholder";
process.env.CLERK_WEBHOOK_SECRET ??= "whsec_test_placeholder";
process.env.OLLAMA_HOST ??= "http://localhost:11434";
process.env.OLLAMA_CHAT_MODEL ??= "qwen2.5:3b";
process.env.OLLAMA_EMBEDDING_MODEL ??= "nomic-embed-text";
process.env.LOG_LEVEL ??= "error";

assertSafeTestEnvironment();
