export type ToolAuditOutcome =
  | "SUCCEEDED"
  | "FAILED"
  | "UNAUTHORIZED";

export interface ToolAuditEvent {
  toolName: string;
  userId: string;
  outcome: ToolAuditOutcome;
  durationMs: number;
  computerTool: boolean;
  authorizationRequired: boolean;
  error?: string;
}