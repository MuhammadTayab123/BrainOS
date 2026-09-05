import {
  getComputerActionRisk,
  isComputerTool,
  requiresComputerAuthorization,
} from "../../security/computer-action.policy";
import { ToolAuditService } from "../../security/tool-audit.service";
import { ProtocolErrorCode } from "../protocol/computer-agent-protocol.types";
import {
  ComputerActionAuthorizationDecision,
  ComputerActionAuthorizer,
  ComputerActionPermissionProvider,
  ComputerAgentActionContext,
} from "./computer-agent-dispatch.types";

/**
 * Minimal server-side in-memory permission provider.
 * Manages trusted action grants strictly on the server; client requests cannot grant themselves permissions.
 */
export class InMemoryComputerActionPermissionProvider
  implements ComputerActionPermissionProvider
{
  private readonly grants = new Map<string, Set<string>>(); // agentId or `${userId}:${agentId}` -> Set<action>

  constructor(initialGrants: Record<string, readonly string[]> = {}) {
    for (const [key, actions] of Object.entries(initialGrants)) {
      this.grants.set(key, new Set(actions));
    }
  }

  grant(targetId: string, action: string): void {
    const current = this.grants.get(targetId) ?? new Set();
    current.add(action);
    this.grants.set(targetId, current);
  }

  revoke(targetId: string, action: string): void {
    const current = this.grants.get(targetId);
    if (current) {
      current.delete(action);
    }
  }

  isActionPermitted(
    action: string,
    context: ComputerAgentActionContext,
  ): boolean {
    // 1. Check agentId grants
    const agentGrants = this.grants.get(context.agentId);
    if (agentGrants?.has(action)) {
      return true;
    }

    // 2. Check compound userId:agentId grants
    const compoundKey = `${context.userId}:${context.agentId}`;
    const userAgentGrants = this.grants.get(compoundKey);
    if (userAgentGrants?.has(action)) {
      return true;
    }

    return false;
  }
}

export interface ComputerAgentActionAuthorizerOptions {
  permissionProvider?: ComputerActionPermissionProvider;
  auditService?: ToolAuditService;
  clock?: () => number;
}

/**
 * Authorizes computer actions against the BrainOS security policy and authenticated context.
 *
 * Security rules:
 * 1. Fails closed on missing or empty server-derived userId.
 * 2. Fails closed on missing or empty authenticated agentId.
 * 3. Fails closed on unmapped or non-computer actions.
 * 4. Read-only actions (computer_get_status, computer_read_file, etc.) are authorized for authenticated agents.
 * 5. State-modifying actions (computer_write_file, computer_launch_application) require trusted
 *    server-side grants from a ComputerActionPermissionProvider. Client requests CANNOT grant permissions.
 * 6. Audit events are recorded on authorization failures to preserve existing audit invariants.
 */
export class ComputerAgentActionAuthorizer implements ComputerActionAuthorizer {
  private readonly permissionProvider: ComputerActionPermissionProvider;
  private readonly auditService: ToolAuditService;
  private readonly clock: () => number;

  constructor(options: ComputerAgentActionAuthorizerOptions = {}) {
    this.permissionProvider =
      options.permissionProvider ??
      new InMemoryComputerActionPermissionProvider();
    this.auditService = options.auditService ?? new ToolAuditService();
    this.clock = options.clock ?? (() => Date.now());
  }

  async authorize(
    action: string,
    context: ComputerAgentActionContext,
  ): Promise<ComputerActionAuthorizationDecision> {
    const startedAt = this.clock();

    // 1. Context validation: server-derived userId and agentId are required
    if (!context || typeof context !== "object") {
      return {
        authorized: false,
        status: "UNAUTHORIZED",
        action: typeof action === "string" ? action : "",
        authorizationRequired: false,
        reason: "Invalid dispatch context.",
        error: {
          code: ProtocolErrorCode.UNAUTHORIZED,
          message: "Invalid dispatch context.",
        },
      };
    }

    if (
      !context.userId ||
      typeof context.userId !== "string" ||
      context.userId.trim().length === 0
    ) {
      return {
        authorized: false,
        status: "UNAUTHORIZED",
        action: typeof action === "string" ? action : "",
        authorizationRequired: false,
        reason: "Server-derived user ID is required for action authorization.",
        error: {
          code: ProtocolErrorCode.UNAUTHORIZED,
          message: "Server-derived user ID is required for action authorization.",
        },
      };
    }

    if (
      !context.agentId ||
      typeof context.agentId !== "string" ||
      context.agentId.trim().length === 0
    ) {
      return {
        authorized: false,
        status: "UNAUTHORIZED",
        action: typeof action === "string" ? action : "",
        authorizationRequired: false,
        reason: "Authenticated agent ID is required for action authorization.",
        error: {
          code: ProtocolErrorCode.UNAUTHORIZED,
          message: "Authenticated agent ID is required for action authorization.",
        },
      };
    }

    // 2. Validate action name
    if (!action || typeof action !== "string" || action.trim().length === 0) {
      return {
        authorized: false,
        status: "UNAUTHORIZED",
        action: "",
        authorizationRequired: false,
        reason: "Action name must be a non-empty string.",
        error: {
          code: ProtocolErrorCode.ACTION_FAILED,
          message: "Action name must be a non-empty string.",
        },
      };
    }

    const cleanAction = action.trim();
    const isKnownComputerTool = isComputerTool(cleanAction);

    if (!isKnownComputerTool) {
      return {
        authorized: false,
        status: "UNAUTHORIZED",
        action: cleanAction,
        authorizationRequired: false,
        reason: `Unknown computer action "${cleanAction}".`,
        error: {
          code: ProtocolErrorCode.ACTION_FAILED,
          message: `Unknown computer action "${cleanAction}".`,
          details: { action: cleanAction },
        },
      };
    }

    const risk = getComputerActionRisk(cleanAction);
    const authorizationRequired = requiresComputerAuthorization(cleanAction);

    // 3. Safe read-only actions are automatically authorized for authenticated agents
    if (!authorizationRequired) {
      return {
        authorized: true,
        status: "AUTHORIZED",
        action: cleanAction,
        risk,
        authorizationRequired: false,
      };
    }

    // 4. Privileged actions require trusted server-side authorization
    const isGranted = await this.permissionProvider.isActionPermitted(
      cleanAction,
      context,
    );

    if (!isGranted) {
      const durationMs = Math.max(0, this.clock() - startedAt);

      // Record audit failure matching ToolExecutor convention
      this.auditService.record({
        toolName: cleanAction,
        userId: context.userId.trim(),
        outcome: "UNAUTHORIZED",
        durationMs,
        computerTool: true,
        authorizationRequired: true,
        error: `Computer action "${cleanAction}" requires authorization.`,
      });

      return {
        authorized: false,
        status: "UNAUTHORIZED",
        action: cleanAction,
        risk,
        authorizationRequired: true,
        reason: `Computer action "${cleanAction}" requires authorization.`,
        error: {
          code: ProtocolErrorCode.UNAUTHORIZED,
          message: `Computer action "${cleanAction}" requires authorization.`,
          details: {
            action: cleanAction,
            risk,
            authorizationRequired: true,
          },
        },
      };
    }

    return {
      authorized: true,
      status: "AUTHORIZED",
      action: cleanAction,
      risk,
      authorizationRequired: true,
    };
  }
}
