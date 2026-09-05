import { EmbeddingsService } from "../memory/embeddings.service";
import { MemoryService } from "../memory/memory.service";
import { OllamaProvider } from "../memory/providers";
import {
  MAX_MEMORY_LIST_LIMIT,
  MAX_MEMORY_SEARCH_LIMIT,
} from "../memory/constants/memory.constants";
import {
  CreateMemoryInput,
  DeleteMemoryInput,
  GetMemoryByIdInput,
  ListMemoriesInput,
  SearchMemoryInput,
} from "../memory/memory.types";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const defaultMemoryService = new MemoryService(
  new EmbeddingsService(new OllamaProvider()),
);

function requireObject(
  input: unknown,
): Record<string, unknown> {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    throw new Error(
      "Tool input must be an object.",
    );
  }

  return input as Record<string, unknown>;
}

function requireString(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];

  if (value === undefined || value === null) {
    throw new Error(
      `${field} is required.`,
    );
  }

  if (typeof value !== "string") {
    throw new Error(
      `${field} must be a string.`,
    );
  }

  if (value.trim().length === 0) {
    throw new Error(
      `${field} is required.`,
    );
  }

  return value.trim();
}

function optionalImportance(
  input: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `${field} must be a number between 0 and 1.`,
    );
  }

  return value;
}

function optionalIntegerInRange(
  input: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${field} must be an integer between ${min} and ${max}.`,
    );
  }

  return value;
}

function assertContextUser(context: ToolContext): string {
  if (
    !context ||
    typeof context !== "object" ||
    !context.userId ||
    context.userId.trim().length === 0
  ) {
    throw new Error("User ID is required.");
  }
  return context.userId.trim();
}

export function createStoreMemoryTool(
  service: MemoryService = defaultMemoryService,
): ToolDefinition {
  return {
    name: "store_memory",

    description:
      "Store a new personal fact, preference, note, or piece of knowledge in the user's Second Brain memory.",

    parameters: {
      type: "object",

      properties: {
        content: {
          type: "string",
          description:
            "The exact fact, note, or preference to remember.",
        },

        importance: {
          type: "number",
          description:
            "Optional importance score between 0.0 and 1.0 (default 0.5).",
        },
      },

      required: ["content"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const memoryInput: CreateMemoryInput = {
        userId,
        content: requireString(object, "content"),
        importance: optionalImportance(object, "importance"),
      };

      const memory = await service.createMemory(memoryInput);

      return {
        id: memory.id,
        content: memory.content,
        importance: memory.importance,
        createdAt: memory.createdAt,
      };
    },
  };
}

export function createSearchMemoriesTool(
  service: MemoryService = defaultMemoryService,
): ToolDefinition {
  return {
    name: "search_memories",

    description:
      "Semantically search stored memories and personal knowledge using natural language.",

    parameters: {
      type: "object",

      properties: {
        query: {
          type: "string",
          description:
            "The natural language search query to match against stored memories.",
        },

        limit: {
          type: "integer",
          description: `Optional maximum number of memories to return (1-${MAX_MEMORY_SEARCH_LIMIT}, default 5).`,
        },
      },

      required: ["query"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const searchInput: SearchMemoryInput = {
        userId,
        query: requireString(object, "query"),
        limit: optionalIntegerInRange(
          object,
          "limit",
          1,
          MAX_MEMORY_SEARCH_LIMIT,
        ),
      };

      return service.searchMemories(searchInput);
    },
  };
}

export function createListMemoriesTool(
  service: MemoryService = defaultMemoryService,
): ToolDefinition {
  return {
    name: "list_memories",

    description:
      "List recent stored memories and personal knowledge notes for the user in reverse chronological order.",

    parameters: {
      type: "object",

      properties: {
        limit: {
          type: "integer",
          description: `Optional maximum number of memories to return (1-${MAX_MEMORY_LIST_LIMIT}, default 20).`,
        },
      },
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const listInput: ListMemoriesInput = {
        userId,
        limit: optionalIntegerInRange(
          object,
          "limit",
          1,
          MAX_MEMORY_LIST_LIMIT,
        ),
      };

      return service.listMemories(listInput);
    },
  };
}

export function createGetMemoryTool(
  service: MemoryService = defaultMemoryService,
): ToolDefinition {
  return {
    name: "get_memory",

    description:
      "Retrieve details of a specific stored memory by its unique memoryId.",

    parameters: {
      type: "object",

      properties: {
        memoryId: {
          type: "string",
          description:
            "The unique ID of the memory to retrieve.",
        },
      },

      required: ["memoryId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const getInput: GetMemoryByIdInput = {
        userId,
        memoryId: requireString(object, "memoryId"),
      };

      return service.getMemoryById(getInput);
    },
  };
}

export function createDeleteMemoryTool(
  service: MemoryService = defaultMemoryService,
): ToolDefinition {
  return {
    name: "delete_memory",

    description:
      "Delete (forget) a stored memory by its unique memoryId.",

    parameters: {
      type: "object",

      properties: {
        memoryId: {
          type: "string",
          description:
            "The unique ID of the memory to delete.",
        },
      },

      required: ["memoryId"],
    },

    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);
      const memoryId = requireString(object, "memoryId");

      const deleteInput: DeleteMemoryInput = {
        userId,
        memoryId,
      };

      await service.deleteMemory(deleteInput);

      return {
        success: true,
        memoryId,
      };
    },
  };
}

export function createMemoryTools(
  service: MemoryService = defaultMemoryService,
): ToolDefinition[] {
  return [
    createStoreMemoryTool(service),
    createSearchMemoriesTool(service),
    createListMemoriesTool(service),
    createGetMemoryTool(service),
    createDeleteMemoryTool(service),
  ];
}

export const storeMemoryTool = createStoreMemoryTool();
export const searchMemoriesTool = createSearchMemoriesTool();
export const listMemoriesTool = createListMemoriesTool();
export const getMemoryTool = createGetMemoryTool();
export const deleteMemoryTool = createDeleteMemoryTool();
