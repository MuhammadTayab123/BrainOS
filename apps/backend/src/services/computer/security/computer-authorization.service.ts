import { logger } from "../../../logger";
import {
  isComputerTool,
  requiresComputerAuthorization,
} from "../../security/computer-action.policy";
import { ComputerAgentPermissionRepository } from "../repositories/computer-agent-permission.repository";
import { ComputerAgentRepository } from "../repositories/computer-agent.repository";
import { ComputerAgentRecord } from "../computer-agent.types";

export interface ComputerAuthorizationService {
  /**
   * Resolves a trusted active Computer Agent for the authenticated user.
   * Returns:
   * - The single active agent if exactly 1 active agent exists for the user.
   * - null if 0 active agents exist.
   * - null (fail-closed) if >1 active agents exist without an explicit target agent ID.
   */
  resolveActiveAgent(userId: string): Promise<ComputerAgentRecord | null>;

  /**
   * Resolves server-granted computer actions from the database for the user's active agent.
   * Only returns recognized computer tools that require authorization.
   */
  resolveServerGrantedActions(userId: string): Promise<string[]>;

  /**
   * Intersects client-requested authorizedComputerActions with server-granted permissions.
   * Client-provided actions can only narrow permissions, never grant them.
   */
  resolveEffectiveActions(
    userId: string,
    requestedActions?: string[],
  ): Promise<string[]>;
}

export class DefaultComputerAuthorizationService
  implements ComputerAuthorizationService
{
  constructor(
    private readonly computerAgentRepository: ComputerAgentRepository = new ComputerAgentRepository(),
    private readonly permissionRepository: ComputerAgentPermissionRepository = new ComputerAgentPermissionRepository(),
    private readonly log = logger,
  ) {}

  async resolveActiveAgent(userId: string): Promise<ComputerAgentRecord | null> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return null;
    }

    const cleanUserId = userId.trim();

    try {
      const activeAgents = await this.computerAgentRepository.listByUser({
        userId: cleanUserId,
        status: "ACTIVE",
      });

      if (!activeAgents || activeAgents.length === 0) {
        this.log.debug("No active computer agent found for user", {
          userId: cleanUserId,
        });
        return null;
      }

      if (activeAgents.length > 1) {
        this.log.warn(
          "Multiple active computer agents found for user without target specification. Failing closed.",
          {
            userId: cleanUserId,
            activeAgentCount: activeAgents.length,
          },
        );
        return null;
      }

      return activeAgents[0];
    } catch (error) {
      this.log.error("Failed to query active computer agents for user", {
        userId: cleanUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async resolveServerGrantedActions(userId: string): Promise<string[]> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return [];
    }

    const cleanUserId = userId.trim();
    const activeAgent = await this.resolveActiveAgent(cleanUserId);

    if (!activeAgent) {
      return [];
    }

    try {
      const permissions = await this.permissionRepository.listPermissions({
        agentId: activeAgent.id,
        userId: cleanUserId,
      });

      const grantedActions: string[] = [];
      for (const record of permissions) {
        if (!record || typeof record.action !== "string") {
          continue;
        }
        const action = record.action.trim();
        if (
          isComputerTool(action) &&
          requiresComputerAuthorization(action) &&
          !grantedActions.includes(action)
        ) {
          grantedActions.push(action);
        }
      }

      return grantedActions;
    } catch (error) {
      this.log.error("Failed to list computer agent permissions for user", {
        userId: cleanUserId,
        agentId: activeAgent.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async resolveEffectiveActions(
    userId: string,
    requestedActions?: string[],
  ): Promise<string[]> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return [];
    }

    const serverGrantedActions = await this.resolveServerGrantedActions(userId);
    if (serverGrantedActions.length === 0) {
      return [];
    }

    // Auto-resolve: if requestedActions is omitted (undefined), return all server-granted actions
    if (requestedActions === undefined) {
      return serverGrantedActions;
    }

    if (!Array.isArray(requestedActions) || requestedActions.length === 0) {
      return [];
    }

    const grantedSet = new Set(serverGrantedActions);
    const effectiveActions: string[] = [];

    for (const requested of requestedActions) {
      if (typeof requested !== "string") {
        continue;
      }
      const clean = requested.trim();
      if (grantedSet.has(clean) && !effectiveActions.includes(clean)) {
        effectiveActions.push(clean);
      }
    }

    return effectiveActions;
  }
}
