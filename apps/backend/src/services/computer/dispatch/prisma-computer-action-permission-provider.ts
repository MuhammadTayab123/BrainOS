import { ComputerAgentPermissionRepository } from "../repositories/computer-agent-permission.repository";
import {
  ComputerActionPermissionProvider,
  ComputerAgentActionContext,
} from "./computer-agent-dispatch.types";

export class PrismaComputerActionPermissionProvider
  implements ComputerActionPermissionProvider
{
  constructor(
    private readonly permissionRepository: ComputerAgentPermissionRepository = new ComputerAgentPermissionRepository(),
  ) {}

  /**
   * Evaluates if a privileged action is permitted for the given authenticated agent and server-derived user.
   * Fails closed on any input anomaly, missing/revoked agent, missing permission grant, or database error.
   */
  async isActionPermitted(
    action: string,
    context: ComputerAgentActionContext,
  ): Promise<boolean> {
    try {
      if (!context || typeof context !== "object") {
        return false;
      }

      if (
        !context.agentId ||
        typeof context.agentId !== "string" ||
        context.agentId.trim().length === 0
      ) {
        return false;
      }

      if (
        !context.userId ||
        typeof context.userId !== "string" ||
        context.userId.trim().length === 0
      ) {
        return false;
      }

      if (!action || typeof action !== "string" || action.trim().length === 0) {
        return false;
      }

      return await this.permissionRepository.hasActivePermission({
        agentId: context.agentId.trim(),
        userId: context.userId.trim(),
        action: action.trim(),
      });
    } catch {
      // Fail closed on database or connection errors
      return false;
    }
  }
}
