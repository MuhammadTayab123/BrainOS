import { afterEach, describe, expect, it } from "vitest";

import {
  assertSafeTestEnvironment,
  TEST_DATABASE_NAME,
} from "./safety";

const originalNodeEnv = process.env.NODE_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreEnvironment(): void {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

describe("assertSafeTestEnvironment", () => {
  afterEach(restoreEnvironment);

  it("accepts the dedicated brainos_test database", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL =
      "postgresql://brainos:brainos@localhost:5432/brainos_test";

    expect(assertSafeTestEnvironment).not.toThrow();
    expect(TEST_DATABASE_NAME).toBe("brainos_test");
  });

  it.each([
    "postgresql://brainos:brainos@localhost:5432/brainos",
    "postgresql://brainos:brainos@localhost:5432/brainos_db",
    "postgresql://brainos:brainos@localhost:5432/my-test-production",
    "postgresql://brainos:brainos@localhost:5432/brainos_test_backup",
    "postgresql://brainos:brainos@localhost:5432/production_test",
  ])("rejects a non-dedicated database URL: %s", (databaseUrl) => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = databaseUrl;

    expect(assertSafeTestEnvironment).toThrow(
      "DATABASE_URL targets brainos_test",
    );
  });

  it("rejects a non-test NODE_ENV", () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL =
      "postgresql://brainos:brainos@localhost:5432/brainos_test";

    expect(assertSafeTestEnvironment).toThrow(
      "Tests must run with NODE_ENV=test.",
    );
  });

  it("rejects a missing DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;

    expect(assertSafeTestEnvironment).toThrow(
      "DATABASE_URL is required for test runs.",
    );
  });

  it("rejects an invalid DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "not-a-database-url";

    expect(assertSafeTestEnvironment).toThrow(
      "DATABASE_URL must be a valid PostgreSQL URL for test runs.",
    );
  });
});
