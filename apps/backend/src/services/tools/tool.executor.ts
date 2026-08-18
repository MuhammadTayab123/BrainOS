import { ToolRegistry } from "./tool.registry";
import { ToolContext } from "./tool.types";

export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
  ) {}

  async execute(
    name: string,
    input: unknown,
    context: ToolContext,
  ): Promise<unknown> {
    const tool = this.registry.get(name);

    if (!tool) {
      throw new Error(`Tool "${name}" is not registered.`);
    }

    return tool.execute(input, context);
  }
}