import { env } from "../config/env";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

type LogMeta = Record<string, unknown>;

class Logger {
  private write(level: LogLevel, message: string, meta?: unknown) {
    const timestamp = new Date().toISOString();

    const log = `[${level}] ${timestamp} - ${message}`;

    switch (level) {
      case "INFO":
        console.log(log, meta ?? "");
        break;

      case "WARN":
        console.warn(log, meta ?? "");
        break;

      case "ERROR":
        console.error(log, meta ?? "");
        break;

      case "DEBUG":
        if (env.NODE_ENV !== "production") {
          console.debug(log, meta ?? "");
        }
        break;
    }
  }

  info(message: string, meta?: LogMeta) {
    this.write("INFO", message, meta);
  }

  warn(message: string, meta?: LogMeta) {
    this.write("WARN", message, meta);
  }

  error(message: string, error?: unknown) {
    this.write("ERROR", message, error);
  }

  debug(message: string, meta?: LogMeta) {
    this.write("DEBUG", message, meta);
  }
}

export const logger = new Logger();