import "dotenv/config";

import { assertSafeTestEnvironment } from "./safety";

process.env.NODE_ENV = "test";

process.env.CLERK_PUBLISHABLE_KEY ??=
  "pk_test_placeholder";
process.env.CLERK_SECRET_KEY ??=
  "sk_test_placeholder";
process.env.CLERK_WEBHOOK_SECRET ??=
  "whsec_test_placeholder";
process.env.OLLAMA_HOST ??=
  "http://localhost:11434";
process.env.OLLAMA_CHAT_MODEL ??= "qwen2.5:3b";
process.env.OLLAMA_EMBEDDING_MODEL ??=
  "nomic-embed-text";
process.env.LOG_LEVEL ??= "error";

assertSafeTestEnvironment();
