import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import { assertSafeTestEnvironment, TEST_DATABASE_NAME } from "./safety";

process.env.NODE_ENV = "test";

const backendRoot = path.resolve(__dirname, "..");
const envPath = path.join(backendRoot, ".env");
const testEnvPath = path.join(backendRoot, ".env.test");

// Load normal environment first.
if (fs.existsSync(envPath)) {
  dotenv.config({
    path: envPath,
  });
}

// Load test environment and explicitly override normal values.
if (fs.existsSync(testEnvPath)) {
  dotenv.config({
    path: testEnvPath,
    override: true,
  });
}

// TEST_DATABASE_URL is the authoritative database URL for integration tests.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required for integration tests.");
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Test-safe defaults.
process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_placeholder";
process.env.CLERK_SECRET_KEY ??= "sk_test_placeholder";
process.env.CLERK_WEBHOOK_SECRET ??= "whsec_test_placeholder";
process.env.OLLAMA_HOST ??= "http://localhost:11434";
process.env.OLLAMA_CHAT_MODEL ??= "qwen2.5:3b";
process.env.OLLAMA_EMBEDDING_MODEL ??= "nomic-embed-text";
process.env.LOG_LEVEL ??= "error";
// Final safety check.
assertSafeTestEnvironment();
