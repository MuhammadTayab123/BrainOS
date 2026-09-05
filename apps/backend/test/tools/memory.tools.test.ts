import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../src/errors";
import { MemoryService } from "../../src/services/memory/memory.service";
import {
  createDeleteMemoryTool,
  createGetMemoryTool,
  createListMemoriesTool,
  createMemoryTools,
  createSearchMemoriesTool,
  createStoreMemoryTool,
} from "../../src/services/tools/memory.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolAuditService } from "../../src/services/security/tool-audit.service";
import {
  isComputerTool,
  requiresComputerAuthorization,
} from "../../src/services/security/computer-action.policy";

describe("Assistant Memory Tools (Mission 45)", () => {
  let mockMemoryService: {
    createMemory: ReturnType<typeof vi.fn>;
    searchMemories: ReturnType<typeof vi.fn>;
    listMemories: ReturnType<typeof vi.fn>;
    getMemoryById: ReturnType<typeof vi.fn>;
    deleteMemory: ReturnType<typeof vi.fn>;
  };
  let memoryService: MemoryService;
  let mockAuditService: ToolAuditService;
  let toolExecutor: ToolExecutor;

  const USER_A = "user_memory_alpha_123";
  const USER_B = "user_memory_bravo_456";

  beforeEach(() => {
    mockMemoryService = {
      createMemory: vi.fn(),
      searchMemories: vi.fn(),
      listMemories: vi.fn(),
      getMemoryById: vi.fn(),
      deleteMemory: vi.fn(),
    };

    memoryService = mockMemoryService as unknown as MemoryService;

    mockAuditService = {
      record: vi.fn(),
    } as unknown as ToolAuditService;

    const registry = createToolRegistry({
      memoryService,
    });

    toolExecutor = new ToolExecutor(registry, mockAuditService);
  });

  describe("1. Registration & Schema Validation", () => {
    it("registers all five memory tools in ToolRegistry", () => {
      const registry = createToolRegistry({ memoryService });

      expect(registry.has("store_memory")).toBe(true);
      expect(registry.has("search_memories")).toBe(true);
      expect(registry.has("list_memories")).toBe(true);
      expect(registry.has("get_memory")).toBe(true);
      expect(registry.has("delete_memory")).toBe(true);
    });

    it("exports valid LLM JSON schemas with descriptions and parameter specs", () => {
      const definitions = toolExecutor.getToolDefinitions();
      const toolNames = definitions.map((d) => d.name);

      expect(toolNames).toContain("store_memory");
      expect(toolNames).toContain("search_memories");
      expect(toolNames).toContain("list_memories");
      expect(toolNames).toContain("get_memory");
      expect(toolNames).toContain("delete_memory");

      const storeDef = definitions.find((d) => d.name === "store_memory")!;
      expect(storeDef.description).toContain("Store a new personal fact");
      expect(storeDef.parameters.type).toBe("object");
      expect(storeDef.parameters.required).toEqual(["content"]);
      expect(storeDef.parameters.properties).toHaveProperty("content");
      expect(storeDef.parameters.properties).toHaveProperty("importance");

      const searchDef = definitions.find((d) => d.name === "search_memories")!;
      expect(searchDef.description).toContain("Semantically search stored memories");
      expect(searchDef.parameters.type).toBe("object");
      expect(searchDef.parameters.required).toEqual(["query"]);
      expect(searchDef.parameters.properties).toHaveProperty("query");
      expect(searchDef.parameters.properties).toHaveProperty("limit");

      const listDef = definitions.find((d) => d.name === "list_memories")!;
      expect(listDef.description).toContain("List recent stored memories");
      expect(listDef.parameters.type).toBe("object");
      expect(listDef.parameters.properties).toHaveProperty("limit");

      const getDef = definitions.find((d) => d.name === "get_memory")!;
      expect(getDef.description).toContain("Retrieve details of a specific stored memory");
      expect(getDef.parameters.required).toEqual(["memoryId"]);
      expect(getDef.parameters.properties).toHaveProperty("memoryId");

      const deleteDef = definitions.find((d) => d.name === "delete_memory")!;
      expect(deleteDef.description).toContain("Delete (forget) a stored memory");
      expect(deleteDef.parameters.required).toEqual(["memoryId"]);
      expect(deleteDef.parameters.properties).toHaveProperty("memoryId");
    });

    it("classifies all memory tools as non-computer tools with no computer authorization required", () => {
      const memoryToolNames = [
        "store_memory",
        "search_memories",
        "list_memories",
        "get_memory",
        "delete_memory",
      ];

      for (const name of memoryToolNames) {
        expect(isComputerTool(name)).toBe(false);
        expect(requiresComputerAuthorization(name)).toBe(false);
      }
    });
  });

  describe("2. store_memory Tool", () => {
    it("stores a memory with required content and default importance", async () => {
      const now = new Date("2026-09-05T20:00:00.000Z");
      mockMemoryService.createMemory.mockResolvedValueOnce({
        id: "mem_1",
        userId: USER_A,
        content: "User prefers dark mode and TypeScript.",
        importance: 0.5,
        lastAccessedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const result = (await toolExecutor.execute(
        "store_memory",
        {
          content: "User prefers dark mode and TypeScript.",
        },
        { userId: USER_A },
      )) as Record<string, unknown>;

      expect(mockMemoryService.createMemory).toHaveBeenCalledWith({
        userId: USER_A,
        content: "User prefers dark mode and TypeScript.",
        importance: undefined,
      });

      expect(result).toEqual({
        id: "mem_1",
        content: "User prefers dark mode and TypeScript.",
        importance: 0.5,
        createdAt: now,
      });
      expect(result).not.toHaveProperty("embedding");
      expect(result).not.toHaveProperty("userId");
    });

    it("stores a memory with explicit custom importance score (0.0 - 1.0)", async () => {
      const now = new Date();
      mockMemoryService.createMemory.mockResolvedValueOnce({
        id: "mem_2",
        userId: USER_A,
        content: "Passport number expires in Dec 2028.",
        importance: 0.95,
        lastAccessedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      const result = await toolExecutor.execute(
        "store_memory",
        {
          content: "Passport number expires in Dec 2028.",
          importance: 0.95,
        },
        { userId: USER_A },
      );

      expect(mockMemoryService.createMemory).toHaveBeenCalledWith({
        userId: USER_A,
        content: "Passport number expires in Dec 2028.",
        importance: 0.95,
      });
      expect(result).toMatchObject({
        id: "mem_2",
        importance: 0.95,
      });
    });

    it("rejects invalid content inputs", async () => {
      await expect(
        toolExecutor.execute("store_memory", {}, { userId: USER_A }),
      ).rejects.toThrow("content is required.");

      await expect(
        toolExecutor.execute(
          "store_memory",
          { content: "   " },
          { userId: USER_A },
        ),
      ).rejects.toThrow("content is required.");

      await expect(
        toolExecutor.execute(
          "store_memory",
          { content: 12345 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("content must be a string.");
    });

    it("rejects out-of-range or invalid importance numbers", async () => {
      await expect(
        toolExecutor.execute(
          "store_memory",
          { content: "Test fact", importance: -0.1 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("importance must be a number between 0 and 1.");

      await expect(
        toolExecutor.execute(
          "store_memory",
          { content: "Test fact", importance: 1.5 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("importance must be a number between 0 and 1.");

      await expect(
        toolExecutor.execute(
          "store_memory",
          { content: "Test fact", importance: "high" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("importance must be a number between 0 and 1.");
    });
  });

  describe("3. search_memories Tool", () => {
    it("searches memories using natural language query and default limit", async () => {
      const searchResults = [
        {
          id: "mem_1",
          content: "User prefers dark mode and TypeScript.",
          similarity: 0.89,
          importance: 0.5,
        },
      ];
      mockMemoryService.searchMemories.mockResolvedValueOnce(searchResults);

      const result = await toolExecutor.execute(
        "search_memories",
        { query: "editor theme preference" },
        { userId: USER_A },
      );

      expect(mockMemoryService.searchMemories).toHaveBeenCalledWith({
        userId: USER_A,
        query: "editor theme preference",
        limit: undefined,
      });
      expect(result).toEqual(searchResults);
    });

    it("searches memories with explicit custom limit (1 to 50)", async () => {
      mockMemoryService.searchMemories.mockResolvedValueOnce([]);

      await toolExecutor.execute(
        "search_memories",
        { query: "flight bookings", limit: 10 },
        { userId: USER_A },
      );

      expect(mockMemoryService.searchMemories).toHaveBeenCalledWith({
        userId: USER_A,
        query: "flight bookings",
        limit: 10,
      });
    });

    it("rejects invalid search queries", async () => {
      await expect(
        toolExecutor.execute("search_memories", {}, { userId: USER_A }),
      ).rejects.toThrow("query is required.");

      await expect(
        toolExecutor.execute(
          "search_memories",
          { query: "   " },
          { userId: USER_A },
        ),
      ).rejects.toThrow("query is required.");
    });

    it("rejects invalid search limit values", async () => {
      await expect(
        toolExecutor.execute(
          "search_memories",
          { query: "test", limit: 0 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");

      await expect(
        toolExecutor.execute(
          "search_memories",
          { query: "test", limit: 51 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");

      await expect(
        toolExecutor.execute(
          "search_memories",
          { query: "test", limit: "10" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");
    });
  });

  describe("4. list_memories Tool", () => {
    it("lists memories with default limit", async () => {
      const now = new Date();
      const memories = [
        {
          id: "mem_1",
          content: "Memory 1",
          importance: 0.5,
          lastAccessedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ];
      mockMemoryService.listMemories.mockResolvedValueOnce(memories);

      const result = await toolExecutor.execute(
        "list_memories",
        {},
        { userId: USER_A },
      );

      expect(mockMemoryService.listMemories).toHaveBeenCalledWith({
        userId: USER_A,
        limit: undefined,
      });
      expect(result).toEqual(memories);
    });

    it("lists memories with custom limit (1 to 50)", async () => {
      mockMemoryService.listMemories.mockResolvedValueOnce([]);

      await toolExecutor.execute(
        "list_memories",
        { limit: 25 },
        { userId: USER_A },
      );

      expect(mockMemoryService.listMemories).toHaveBeenCalledWith({
        userId: USER_A,
        limit: 25,
      });
    });

    it("rejects invalid list limit values", async () => {
      await expect(
        toolExecutor.execute(
          "list_memories",
          { limit: 0 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");

      await expect(
        toolExecutor.execute(
          "list_memories",
          { limit: 100 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");
    });
  });

  describe("5. get_memory Tool", () => {
    it("retrieves an existing memory by memoryId", async () => {
      const now = new Date();
      const memory = {
        id: "mem_100",
        content: "Important medical note.",
        importance: 0.9,
        lastAccessedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      mockMemoryService.getMemoryById.mockResolvedValueOnce(memory);

      const result = await toolExecutor.execute(
        "get_memory",
        { memoryId: "mem_100" },
        { userId: USER_A },
      );

      expect(mockMemoryService.getMemoryById).toHaveBeenCalledWith({
        userId: USER_A,
        memoryId: "mem_100",
      });
      expect(result).toEqual(memory);
    });

    it("rejects missing or empty memoryId", async () => {
      await expect(
        toolExecutor.execute("get_memory", {}, { userId: USER_A }),
      ).rejects.toThrow("memoryId is required.");

      await expect(
        toolExecutor.execute(
          "get_memory",
          { memoryId: "   " },
          { userId: USER_A },
        ),
      ).rejects.toThrow("memoryId is required.");
    });

    it("propagates NotFoundError when memory is not found or owned by another user", async () => {
      mockMemoryService.getMemoryById.mockRejectedValueOnce(
        new NotFoundError("Memory not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "get_memory",
          { memoryId: "mem_missing" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Memory not found for the authenticated user.");
    });
  });

  describe("6. delete_memory Tool", () => {
    it("deletes a memory and returns confirmation", async () => {
      mockMemoryService.deleteMemory.mockResolvedValueOnce(undefined);

      const result = await toolExecutor.execute(
        "delete_memory",
        { memoryId: "mem_to_delete" },
        { userId: USER_A },
      );

      expect(mockMemoryService.deleteMemory).toHaveBeenCalledWith({
        userId: USER_A,
        memoryId: "mem_to_delete",
      });
      expect(result).toEqual({
        success: true,
        memoryId: "mem_to_delete",
      });
    });

    it("rejects missing or empty memoryId", async () => {
      await expect(
        toolExecutor.execute("delete_memory", {}, { userId: USER_A }),
      ).rejects.toThrow("memoryId is required.");
    });

    it("propagates NotFoundError on deleting non-existent or foreign memory", async () => {
      mockMemoryService.deleteMemory.mockRejectedValueOnce(
        new NotFoundError("Memory not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "delete_memory",
          { memoryId: "mem_foreign" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Memory not found for the authenticated user.");
    });
  });

  describe("7. Security, User Isolation, Context Enforcement & Audit Logging", () => {
    it("fails closed when context.userId is missing on every tool", async () => {
      const toolCases = [
        { name: "store_memory", input: { content: "test" } },
        { name: "search_memories", input: { query: "test" } },
        { name: "list_memories", input: {} },
        { name: "get_memory", input: { memoryId: "mem_1" } },
        { name: "delete_memory", input: { memoryId: "mem_1" } },
      ];

      for (const tc of toolCases) {
        await expect(
          toolExecutor.execute(
            tc.name,
            tc.input,
            {} as unknown as { userId: string },
          ),
        ).rejects.toThrow("User ID is required.");

        await expect(
          toolExecutor.execute(
            tc.name,
            tc.input,
            { userId: "   " },
          ),
        ).rejects.toThrow("User ID is required.");
      }
    });

    it("never accepts userId from input arguments; derives strictly from context", async () => {
      mockMemoryService.createMemory.mockResolvedValueOnce({
        id: "mem_secure",
        userId: USER_A,
        content: "Safe content",
        importance: 0.5,
        lastAccessedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await toolExecutor.execute(
        "store_memory",
        {
          content: "Safe content",
          userId: USER_B, // Malicious input attempt to spoof User B
        },
        { userId: USER_A },
      );

      expect(mockMemoryService.createMemory).toHaveBeenCalledWith({
        userId: USER_A, // strictly context.userId
        content: "Safe content",
        importance: undefined,
      });
    });

    it("records SUCCEEDED and FAILED audit events to ToolAuditService", async () => {
      mockMemoryService.createMemory.mockResolvedValueOnce({
        id: "mem_audit",
        userId: USER_A,
        content: "Audit test",
        importance: 0.5,
        lastAccessedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await toolExecutor.execute(
        "store_memory",
        { content: "Audit test" },
        { userId: USER_A },
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          toolName: "store_memory",
          outcome: "SUCCEEDED",
          computerTool: false,
          authorizationRequired: false,
        }),
      );

      await expect(
        toolExecutor.execute(
          "store_memory",
          { content: "" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("content is required.");

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          toolName: "store_memory",
          outcome: "FAILED",
          computerTool: false,
          authorizationRequired: false,
          error: "content is required.",
        }),
      );
    });

    it("createMemoryTools helper instantiates all five tools with custom service", () => {
      const tools = createMemoryTools(memoryService);
      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.name)).toEqual([
        "store_memory",
        "search_memories",
        "list_memories",
        "get_memory",
        "delete_memory",
      ]);
    });
  });
});
