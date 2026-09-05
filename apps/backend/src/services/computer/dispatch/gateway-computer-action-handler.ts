import { ComputerAgentGateway } from "../agent/computer-agent.gateway";
import { ProtocolErrorCode } from "../protocol/computer-agent-protocol.types";
import { ComputerAgentActionException } from "./computer-agent-action-dispatcher";
import {
  ComputerActionHandler,
  ComputerActionName,
  ComputerAgentActionContext,
} from "./computer-agent-dispatch.types";

export interface GatewayComputerActionHandlerOptions {
  gateway: ComputerAgentGateway;
}

/**
 * Execution handler that connects authorized computer actions to ComputerAgentGateway.
 *
 * Rules:
 * 1. Dispatches strictly via an explicit switch mapping on ComputerActionName.
 * 2. Never uses dynamic method dispatch, reflection, or arbitrary client method names.
 * 3. Validates action parameters strictly before delegating to the Gateway.
 * 4. Fails closed on unknown/unregistered action names.
 * 5. Does not perform authorization internally (relies on dispatcher authorization-before-execution).
 * 6. Preserves server-derived context.
 * 7. Translates Gateway errors into structured ComputerAgentActionException (ACTION_FAILED).
 */
export class GatewayComputerActionHandler implements ComputerActionHandler {
  private readonly gateway: ComputerAgentGateway;

  constructor(options: GatewayComputerActionHandlerOptions) {
    if (!options || !options.gateway) {
      throw new Error("GatewayComputerActionHandler requires a valid ComputerAgentGateway.");
    }
    this.gateway = options.gateway;
  }

  async execute(
    action: ComputerActionName | string,
    params: unknown,
    context: ComputerAgentActionContext,
  ): Promise<unknown> {
    // Preserve server-derived context validation
    if (!context || typeof context !== "object") {
      throw new ComputerAgentActionException({
        message: "Invalid action execution context.",
        code: ProtocolErrorCode.ACTION_FAILED,
        action: typeof action === "string" ? action : undefined,
      });
    }

    if (!action || typeof action !== "string" || action.trim().length === 0) {
      throw new ComputerAgentActionException({
        message: "Action name must be a non-empty string.",
        code: ProtocolErrorCode.ACTION_FAILED,
      });
    }

    const cleanAction = action.trim();

    try {
      switch (cleanAction) {
        case ComputerActionName.GET_STATUS: {
          this.validateNoRequiredParams(params, cleanAction);
          return await this.gateway.getInfo();
        }

        case ComputerActionName.LIST_APPLICATIONS: {
          this.validateNoRequiredParams(params, cleanAction);
          return await this.gateway.listApplications();
        }

        case ComputerActionName.LIST_FILES: {
          const path = this.validateListFilesParams(params, cleanAction);
          return await this.gateway.listFiles(path);
        }

        case ComputerActionName.READ_FILE: {
          const path = this.validateReadFileParams(params, cleanAction);
          return await this.gateway.readFile(path);
        }

        case ComputerActionName.LAUNCH_APPLICATION: {
          const appId = this.validateLaunchApplicationParams(params, cleanAction);
          return await this.gateway.launchApplication(appId);
        }

        case ComputerActionName.WRITE_FILE: {
          const { path, content } = this.validateWriteFileParams(params, cleanAction);
          return await this.gateway.writeFile(path, content);
        }

        default: {
          throw new ComputerAgentActionException({
            message: `Unknown or unregistered computer action "${cleanAction}".`,
            code: ProtocolErrorCode.ACTION_FAILED,
            action: cleanAction,
            details: { action: cleanAction },
          });
        }
      }
    } catch (err: unknown) {
      if (err instanceof ComputerAgentActionException) {
        throw err;
      }

      const message =
        err instanceof Error ? err.message : "Computer action execution failed.";

      throw new ComputerAgentActionException({
        message,
        code: ProtocolErrorCode.ACTION_FAILED,
        action: cleanAction,
        details: err instanceof Error ? { error: err.name } : undefined,
      });
    }
  }

  private validateNoRequiredParams(params: unknown, action: string): void {
    if (params !== undefined && params !== null) {
      if (typeof params !== "object" || Array.isArray(params)) {
        throw new ComputerAgentActionException({
          message: `Parameters for "${action}" must be an object if provided.`,
          code: ProtocolErrorCode.ACTION_FAILED,
          action,
        });
      }
    }
  }

  private validateListFilesParams(params: unknown, action: string): string | undefined {
    if (params === undefined || params === null) {
      return undefined;
    }

    if (typeof params !== "object" || Array.isArray(params)) {
      throw new ComputerAgentActionException({
        message: `Parameters for "${action}" must be an object if provided.`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    const record = params as Record<string, unknown>;
    if ("path" in record && record.path !== undefined) {
      if (typeof record.path !== "string") {
        throw new ComputerAgentActionException({
          message: `Parameter "path" for "${action}" must be a string.`,
          code: ProtocolErrorCode.ACTION_FAILED,
          action,
        });
      }
      return record.path;
    }

    return undefined;
  }

  private validateReadFileParams(params: unknown, action: string): string {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new ComputerAgentActionException({
        message: `Parameters object is required for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    const record = params as Record<string, unknown>;
    if (
      !("path" in record) ||
      typeof record.path !== "string" ||
      record.path.trim().length === 0
    ) {
      throw new ComputerAgentActionException({
        message: `Parameter "path" is required and must be a non-empty string for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    return record.path;
  }

  private validateLaunchApplicationParams(params: unknown, action: string): string {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new ComputerAgentActionException({
        message: `Parameters object is required for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    const record = params as Record<string, unknown>;
    if (
      !("appId" in record) ||
      typeof record.appId !== "string" ||
      record.appId.trim().length === 0
    ) {
      throw new ComputerAgentActionException({
        message: `Parameter "appId" is required and must be a non-empty string for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    return record.appId;
  }

  private validateWriteFileParams(
    params: unknown,
    action: string,
  ): { path: string; content: string } {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
      throw new ComputerAgentActionException({
        message: `Parameters object is required for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    const record = params as Record<string, unknown>;
    if (
      !("path" in record) ||
      typeof record.path !== "string" ||
      record.path.trim().length === 0
    ) {
      throw new ComputerAgentActionException({
        message: `Parameter "path" is required and must be a non-empty string for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    if (!("content" in record) || typeof record.content !== "string") {
      throw new ComputerAgentActionException({
        message: `Parameter "content" is required and must be a string for "${action}".`,
        code: ProtocolErrorCode.ACTION_FAILED,
        action,
      });
    }

    return {
      path: record.path,
      content: record.content,
    };
  }
}
