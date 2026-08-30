import { logger } from "../../logger";
import { ToolAuditEvent } from "./tool-audit.types";

export class ToolAuditService {
  record(event: ToolAuditEvent): void {
    logger.info("Tool execution audit", {
      toolName: event.toolName,
      userId: event.userId,
      outcome: event.outcome,
      durationMs: event.durationMs,
      computerTool: event.computerTool,
      authorizationRequired:
        event.authorizationRequired,
      ...(event.error
        ? { error: event.error }
        : {}),
    });
  }
}