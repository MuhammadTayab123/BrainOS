import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDocumentSearchTool,
  documentSearchTool,
} from "../../src/services/tools/document.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { DocumentRetrievalService } from "../../src/services/documents/retrieval/document-retrieval.service";
import { ToolContext } from "../../src/services/tools/tool.types";

describe("document_search tool", () => {
  const searchMock = vi.fn();

  const mockRetrievalService = {
    search: searchMock,
  } as unknown as DocumentRetrievalService;

  const validContext: ToolContext = {
    userId: "user-123",
  };

  const sampleResults = [
    {
      id: "chunk-1",
      documentId: "doc-1",
      documentTitle: "BrainOS Architecture",
      sourceType: "TEXT",
      source: null,
      chunkIndex: 0,
      content: "BrainOS provides personal companion intelligence.",
      similarity: 0.92,
    },
    {
      id: "chunk-2",
      documentId: "doc-2",
      documentTitle: "RAG Specs",
      sourceType: "UPLOAD",
      source: "specs.pdf",
      chunkIndex: 1,
      content: "Document retrieval leverages vector embeddings.",
      similarity: 0.85,
    },
  ];

  beforeEach(() => {
    searchMock.mockReset();
  });

  describe("registration & definition", () => {
    it("is registered in the global ToolRegistry", () => {
      const registry = createToolRegistry();

      expect(registry.has("document_search")).toBe(true);

      const tool = registry.get("document_search");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("document_search");
      expect(tool?.description).toContain("Search indexed documents");
      expect(tool?.parameters).toMatchObject({
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer" },
        },
        required: ["query"],
      });
    });

    it("has the expected default tool export name and properties", () => {
      expect(documentSearchTool.name).toBe("document_search");
      expect(documentSearchTool.parameters.required).toEqual(["query"]);
    });
  });

  describe("execution & parameter handling", () => {
    it("executes search with valid query and passes context.userId", async () => {
      searchMock.mockResolvedValue(sampleResults);

      const tool = createDocumentSearchTool(mockRetrievalService);

      const results = await tool.execute(
        {
          query: "BrainOS architecture",
        },
        validContext,
      );

      expect(searchMock).toHaveBeenCalledTimes(1);
      expect(searchMock).toHaveBeenCalledWith({
        userId: "user-123",
        query: "BrainOS architecture",
        limit: undefined,
      });
      expect(results).toEqual(sampleResults);
    });

    it("trims the query string before calling DocumentRetrievalService", async () => {
      searchMock.mockResolvedValue(sampleResults);

      const tool = createDocumentSearchTool(mockRetrievalService);

      await tool.execute(
        {
          query: "   personal intelligence companion   ",
        },
        validContext,
      );

      expect(searchMock).toHaveBeenCalledWith({
        userId: "user-123",
        query: "personal intelligence companion",
        limit: undefined,
      });
    });

    it("forwards an explicit valid limit", async () => {
      searchMock.mockResolvedValue([sampleResults[0]]);

      const tool = createDocumentSearchTool(mockRetrievalService);

      const results = await tool.execute(
        {
          query: "architecture",
          limit: 10,
        },
        validContext,
      );

      expect(searchMock).toHaveBeenCalledWith({
        userId: "user-123",
        query: "architecture",
        limit: 10,
      });
      expect(results).toEqual([sampleResults[0]]);
    });

    it("trims context.userId before calling DocumentRetrievalService", async () => {
      searchMock.mockResolvedValue(sampleResults);

      const tool = createDocumentSearchTool(mockRetrievalService);

      await tool.execute(
        {
          query: "test query",
        },
        {
          userId: "  user-trimmed  ",
        },
      );

      expect(searchMock).toHaveBeenCalledWith({
        userId: "user-trimmed",
        query: "test query",
        limit: undefined,
      });
    });
  });

  describe("input validation", () => {
    it("rejects non-object inputs", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(
        tool.execute(null, validContext),
      ).rejects.toThrow("Tool input must be an object.");

      await expect(
        tool.execute(undefined, validContext),
      ).rejects.toThrow("Tool input must be an object.");

      await expect(
        tool.execute("query string", validContext),
      ).rejects.toThrow("Tool input must be an object.");

      await expect(
        tool.execute(123, validContext),
      ).rejects.toThrow("Tool input must be an object.");

      await expect(
        tool.execute(["query"], validContext),
      ).rejects.toThrow("Tool input must be an object.");

      expect(searchMock).not.toHaveBeenCalled();
    });

    it("rejects missing or non-string query", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(
        tool.execute({}, validContext),
      ).rejects.toThrow("query is required.");

      await expect(
        tool.execute({ query: 123 }, validContext),
      ).rejects.toThrow("query is required.");

      await expect(
        tool.execute({ query: null }, validContext),
      ).rejects.toThrow("query is required.");

      expect(searchMock).not.toHaveBeenCalled();
    });

    it("rejects empty or whitespace-only query", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(
        tool.execute({ query: "" }, validContext),
      ).rejects.toThrow("query is required.");

      await expect(
        tool.execute({ query: "   " }, validContext),
      ).rejects.toThrow("query is required.");

      expect(searchMock).not.toHaveBeenCalled();
    });

    it("rejects invalid limits", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(
        tool.execute(
          { query: "test", limit: 0 },
          validContext,
        ),
      ).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );

      await expect(
        tool.execute(
          { query: "test", limit: 21 },
          validContext,
        ),
      ).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );

      await expect(
        tool.execute(
          { query: "test", limit: -5 },
          validContext,
        ),
      ).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );

      await expect(
        tool.execute(
          { query: "test", limit: 5.5 },
          validContext,
        ),
      ).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );

      await expect(
        tool.execute(
          { query: "test", limit: "5" },
          validContext,
        ),
      ).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );

      expect(searchMock).not.toHaveBeenCalled();
    });

    it("rejects missing or empty context userId", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(
        tool.execute(
          { query: "test" },
          { userId: "" },
        ),
      ).rejects.toThrow("User ID is required.");

      await expect(
        tool.execute(
          { query: "test" },
          { userId: "   " },
        ),
      ).rejects.toThrow("User ID is required.");

      expect(searchMock).not.toHaveBeenCalled();
    });
  });
});
