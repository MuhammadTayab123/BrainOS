export const TEST_DATABASE_NAME = "brainos_test";

function getDatabaseName(databaseUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL must be a valid PostgreSQL URL for test runs.",
    );
  }

  if (
    parsedUrl.protocol !== "postgresql:" &&
    parsedUrl.protocol !== "postgres:"
  ) {
    throw new Error(
      "DATABASE_URL must use the PostgreSQL protocol for test runs.",
    );
  }

  return decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "");
}

export function assertSafeTestEnvironment(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Tests must run with NODE_ENV=test.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new Error(
      "DATABASE_URL is required for test runs.",
    );
  }

  const databaseName = getDatabaseName(databaseUrl);

  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(
      `Refusing to run tests unless DATABASE_URL targets ${TEST_DATABASE_NAME}.`,
    );
  }
}
