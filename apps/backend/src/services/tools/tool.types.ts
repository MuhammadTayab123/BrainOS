export interface ToolContext {
  userId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  execute(
    input: unknown,
    context: ToolContext,
  ): Promise<unknown>;
}