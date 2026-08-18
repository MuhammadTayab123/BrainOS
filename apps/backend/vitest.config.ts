import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  root: __dirname,

  test: {
    environment: "node",

    setupFiles: [path.resolve(__dirname, "test/setup.ts")],

    include: ["test/**/*.test.ts"],

    clearMocks: true,
    restoreMocks: true,
  },
});
