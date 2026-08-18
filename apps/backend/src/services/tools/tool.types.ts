export interface ToolContext {
  userId: string;
}

export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;

  execute(
    input: unknown,
    context: ToolContext,
  ): Promise<unknown>;
}