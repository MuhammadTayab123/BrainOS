import { ToolRegistry } from "./tool.registry";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";
import { LLMToolDefinition } from "../ai/provider.interface";

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
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
    const tool = this.registry.get(name);

    if (!tool) {
      throw new Error(
        `Tool "${name}" is not registered.`,
      );
    }

    return tool.execute(input, context);
  }
}