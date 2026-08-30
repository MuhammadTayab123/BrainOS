import { ToolRegistry } from "./tool.registry";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";
import { LLMToolDefinition } from "../ai/provider.interface";

import {
  isComputerTool,
  requiresComputerAuthorization,
} from "../security/computer-action.policy";

import { ToolAuditService } from "../security/tool-audit.service";

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly auditService = new ToolAuditService(),
  ) {}

  getToolDefinitions(): LLMToolDefinition[] {
    return this.registry.getAll().map(
      (tool: ToolDefinition) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }),
    );
  }

  async execute(
    name: string,
    input: unknown,
    context: ToolContext,
  ): Promise<unknown> {
    const startedAt = Date.now();

    const tool = this.registry.get(name);

    if (!tool) {
      throw new Error(
        `Tool "${name}" is not registered.`,
      );
    }

    const computerTool = isComputerTool(name);
    const authorizationRequired =
      computerTool &&
      requiresComputerAuthorization(name);

    if (authorizationRequired) {
      const authorizedActions =
        context.authorizedComputerActions ?? [];

      if (!authorizedActions.includes(name)) {
        this.auditService.record({
          toolName: name,
          userId: context.userId,
          outcome: "UNAUTHORIZED",
          durationMs: Date.now() - startedAt,
          computerTool,
          authorizationRequired,
        });

        throw new Error(
          `Computer action "${name}" requires authorization.`,
        );
      }
    }

    try {
      const result = await tool.execute(
        input,
        context,
      );

      this.auditService.record({
        toolName: name,
        userId: context.userId,
        outcome: "SUCCEEDED",
        durationMs: Date.now() - startedAt,
        computerTool,
        authorizationRequired,
      });

      return result;
    } catch (error) {
      this.auditService.record({
        toolName: name,
        userId: context.userId,
        outcome: "FAILED",
        durationMs: Date.now() - startedAt,
        computerTool,
        authorizationRequired,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      throw error;
    }
  }
}