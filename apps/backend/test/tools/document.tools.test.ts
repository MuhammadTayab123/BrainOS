import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentStatus, DocumentSourceType } from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { DocumentService } from "../../src/services/documents/document.service";
import { DocumentRetrievalService } from "../../src/services/documents/retrieval/document-retrieval.service";
import {
  createDeleteDocumentTool,
  createDocumentSearchTool,
  createDocumentTools,
  createGetDocumentTool,
  createListDocumentsTool,
  deleteDocumentTool,
  documentSearchTool,
  getDocumentTool,
  listDocumentsTool,
} from "../../src/services/tools/document.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolContext } from "../../src/services/tools/tool.types";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolAuditService } from "../../src/services/security/tool-audit.service";
import {
  isComputerTool,
  requiresComputerAuthorization,
} from "../../src/services/security/computer-action.policy";

describe("Assistant Document Tools (Mission 47)", () => {
  const searchMock = vi.fn();
  const listDocumentsMock = vi.fn();
  const getDocumentMock = vi.fn();
  const deleteDocumentMock = vi.fn();

  const mockRetrievalService = {
    search: searchMock,
  } as unknown as DocumentRetrievalService;

  const mockDocumentService = {
    listDocuments: listDocumentsMock,
    getDocument: getDocumentMock,
    deleteDocument: deleteDocumentMock,
  } as unknown as DocumentService;

  const USER_A = "user_doc_alpha_123";
  const USER_B = "user_doc_bravo_456";

  const validContext: ToolContext = {
    userId: USER_A,
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

  let mockAuditService: ToolAuditService;
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    searchMock.mockReset();
    listDocumentsMock.mockReset();
    getDocumentMock.mockReset();
    deleteDocumentMock.mockReset();

    mockAuditService = {
      record: vi.fn(),
    } as unknown as ToolAuditService;

    const registry = createToolRegistry({
      documentRetrievalService: mockRetrievalService,
      documentService: mockDocumentService,
    });

    toolExecutor = new ToolExecutor(registry, mockAuditService);
  });

  describe("1. Registration & Definition", () => {
    it("registers all document tools in the ToolRegistry", () => {
      const registry = createToolRegistry({
        documentRetrievalService: mockRetrievalService,
        documentService: mockDocumentService,
      });

      expect(registry.has("document_search")).toBe(true);
      expect(registry.has("list_documents")).toBe(true);
      expect(registry.has("get_document")).toBe(true);
      expect(registry.has("delete_document")).toBe(true);
    });

    it("has valid LLM schema definitions for all document tools", () => {
      const definitions = toolExecutor.getToolDefinitions();
      const toolNames = definitions.map((d) => d.name);

      expect(toolNames).toContain("document_search");
      expect(toolNames).toContain("list_documents");
      expect(toolNames).toContain("get_document");
      expect(toolNames).toContain("delete_document");

      const searchDef = definitions.find((d) => d.name === "document_search")!;
      expect(searchDef.description).toContain("Search indexed documents");
      expect(searchDef.parameters.required).toEqual(["query"]);

      const listDef = definitions.find((d) => d.name === "list_documents")!;
      expect(listDef.description).toContain("List uploaded documents");
      expect(listDef.parameters.properties).toHaveProperty("status");
      expect(listDef.parameters.properties).toHaveProperty("limit");

      const getDef = definitions.find((d) => d.name === "get_document")!;
      expect(getDef.description).toContain("Retrieve full details");
      expect(getDef.parameters.required).toEqual(["documentId"]);

      const deleteDef = definitions.find((d) => d.name === "delete_document")!;
      expect(deleteDef.description).toContain("Delete (remove) a document");
      expect(deleteDef.parameters.required).toEqual(["documentId"]);
    });

    it("has the expected default tool export names and singletons", () => {
      expect(documentSearchTool.name).toBe("document_search");
      expect(listDocumentsTool.name).toBe("list_documents");
      expect(getDocumentTool.name).toBe("get_document");
      expect(deleteDocumentTool.name).toBe("delete_document");
    });

    it("classifies all document tools as non-computer tools with no computer authorization required", () => {
      const docToolNames = [
        "document_search",
        "list_documents",
        "get_document",
        "delete_document",
      ];

      for (const name of docToolNames) {
        expect(isComputerTool(name)).toBe(false);
        expect(requiresComputerAuthorization(name)).toBe(false);
      }
    });
  });

  describe("2. document_search Tool", () => {
    it("executes search with valid query and passes context.userId", async () => {
      searchMock.mockResolvedValue(sampleResults);

      const tool = createDocumentSearchTool(mockRetrievalService);

      const results = await tool.execute(
        { query: "BrainOS architecture" },
        validContext,
      );

      expect(searchMock).toHaveBeenCalledTimes(1);
      expect(searchMock).toHaveBeenCalledWith({
        userId: USER_A,
        query: "BrainOS architecture",
        limit: undefined,
      });
      expect(results).toEqual(sampleResults);
    });

    it("trims the query string before calling DocumentRetrievalService", async () => {
      searchMock.mockResolvedValue(sampleResults);

      const tool = createDocumentSearchTool(mockRetrievalService);

      await tool.execute(
        { query: "   spaces around   " },
        validContext,
      );

      expect(searchMock).toHaveBeenCalledWith({
        userId: USER_A,
        query: "spaces around",
        limit: undefined,
      });
    });

    it("passes limit when specified within valid range (1-20)", async () => {
      searchMock.mockResolvedValue(sampleResults);

      const tool = createDocumentSearchTool(mockRetrievalService);

      await tool.execute(
        { query: "test", limit: 5 },
        validContext,
      );

      expect(searchMock).toHaveBeenCalledWith({
        userId: USER_A,
        query: "test",
        limit: 5,
      });
    });

    it("rejects non-object input", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(tool.execute("string", validContext)).rejects.toThrow("Tool input must be an object.");
      await expect(tool.execute(null, validContext)).rejects.toThrow("Tool input must be an object.");
      await expect(tool.execute([1, 2], validContext)).rejects.toThrow("Tool input must be an object.");
    });

    it("rejects missing, empty, or non-string query", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(tool.execute({}, validContext)).rejects.toThrow("query is required.");
      await expect(tool.execute({ query: "" }, validContext)).rejects.toThrow("query is required.");
      await expect(tool.execute({ query: "   " }, validContext)).rejects.toThrow("query is required.");
      await expect(tool.execute({ query: 123 }, validContext)).rejects.toThrow("query must be a string.");
    });

    it("rejects invalid limit values", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(tool.execute({ query: "test", limit: 0 }, validContext)).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );
      await expect(tool.execute({ query: "test", limit: 25 }, validContext)).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );
      await expect(tool.execute({ query: "test", limit: 5.5 }, validContext)).rejects.toThrow(
        "limit must be an integer between 1 and 20.",
      );
    });

    it("rejects missing or empty context userId", async () => {
      const tool = createDocumentSearchTool(mockRetrievalService);

      await expect(tool.execute({ query: "test" }, { userId: "" })).rejects.toThrow("User ID is required.");
      await expect(tool.execute({ query: "test" }, { userId: "   " })).rejects.toThrow("User ID is required.");
    });
  });

  describe("3. list_documents Tool", () => {
    it("lists documents with default limit and passes context.userId", async () => {
      const docs = [
        {
          id: "doc-1",
          title: "Architecture Doc",
          sourceType: DocumentSourceType.TEXT,
          source: null,
          content: "Full content",
          mimeType: "text/plain",
          status: DocumentStatus.READY,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      listDocumentsMock.mockResolvedValueOnce(docs);

      const result = await toolExecutor.execute(
        "list_documents",
        {},
        validContext,
      );

      expect(listDocumentsMock).toHaveBeenCalledWith({
        userId: USER_A,
        status: undefined,
        limit: undefined,
      });

      expect(result).toEqual([
        expect.objectContaining({
          id: "doc-1",
          title: "Architecture Doc",
          sourceType: "TEXT",
          status: "READY",
        }),
      ]);
    });

    it("lists documents with status filter and custom limit (1 to 50)", async () => {
      listDocumentsMock.mockResolvedValueOnce([]);

      await toolExecutor.execute(
        "list_documents",
        { status: "READY", limit: 10 },
        validContext,
      );

      expect(listDocumentsMock).toHaveBeenCalledWith({
        userId: USER_A,
        status: DocumentStatus.READY,
        limit: 10,
      });
    });

    it("rejects invalid status filter", async () => {
      await expect(
        toolExecutor.execute(
          "list_documents",
          { status: "INVALID_STATUS" },
          validContext,
        ),
      ).rejects.toThrow("status must be one of: PENDING, READY, FAILED, DELETED.");
    });

    it("rejects invalid limit values", async () => {
      await expect(
        toolExecutor.execute(
          "list_documents",
          { limit: 0 },
          validContext,
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");

      await expect(
        toolExecutor.execute(
          "list_documents",
          { limit: 51 },
          validContext,
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");
    });
  });

  describe("4. get_document Tool", () => {
    it("retrieves a document by documentId with content", async () => {
      const now = new Date();
      const doc = {
        id: "doc_100",
        title: "Meeting Notes",
        sourceType: DocumentSourceType.TEXT,
        source: null,
        content: "Detailed notes from client meeting.",
        mimeType: "text/plain",
        status: DocumentStatus.READY,
        createdAt: now,
        updatedAt: now,
      };
      getDocumentMock.mockResolvedValueOnce(doc);

      const result = await toolExecutor.execute(
        "get_document",
        { documentId: "doc_100" },
        validContext,
      );

      expect(getDocumentMock).toHaveBeenCalledWith({
        documentId: "doc_100",
        userId: USER_A,
      });
      expect(result).toEqual({
        id: "doc_100",
        title: "Meeting Notes",
        sourceType: "TEXT",
        source: null,
        content: "Detailed notes from client meeting.",
        mimeType: "text/plain",
        status: "READY",
        createdAt: now,
        updatedAt: now,
      });
    });

    it("rejects missing or empty documentId", async () => {
      await expect(
        toolExecutor.execute("get_document", {}, validContext),
      ).rejects.toThrow("documentId is required.");

      await expect(
        toolExecutor.execute(
          "get_document",
          { documentId: "   " },
          validContext,
        ),
      ).rejects.toThrow("documentId is required.");
    });

    it("propagates NotFoundError when document does not exist or is unowned", async () => {
      getDocumentMock.mockRejectedValueOnce(
        new NotFoundError("Document not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "get_document",
          { documentId: "doc_missing" },
          validContext,
        ),
      ).rejects.toThrow("Document not found for the authenticated user.");
    });
  });

  describe("5. delete_document Tool", () => {
    it("deletes a document and returns confirmation", async () => {
      deleteDocumentMock.mockResolvedValueOnce(undefined);

      const result = await toolExecutor.execute(
        "delete_document",
        { documentId: "doc_to_delete" },
        validContext,
      );

      expect(deleteDocumentMock).toHaveBeenCalledWith({
        documentId: "doc_to_delete",
        userId: USER_A,
      });
      expect(result).toEqual({
        success: true,
        documentId: "doc_to_delete",
      });
    });

    it("rejects missing or empty documentId", async () => {
      await expect(
        toolExecutor.execute("delete_document", {}, validContext),
      ).rejects.toThrow("documentId is required.");
    });

    it("propagates NotFoundError on foreign or missing document deletion", async () => {
      deleteDocumentMock.mockRejectedValueOnce(
        new NotFoundError("Document not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "delete_document",
          { documentId: "doc_foreign" },
          validContext,
        ),
      ).rejects.toThrow("Document not found for the authenticated user.");
    });
  });

  describe("6. Security, User Isolation, Context Enforcement & Audit Logging", () => {
    it("fails closed when context.userId is missing on every document tool", async () => {
      const toolCases = [
        { name: "document_search", input: { query: "test" } },
        { name: "list_documents", input: {} },
        { name: "get_document", input: { documentId: "doc_1" } },
        { name: "delete_document", input: { documentId: "doc_1" } },
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
      getDocumentMock.mockResolvedValueOnce({
        id: "doc_secure",
        title: "Secure",
        sourceType: DocumentSourceType.TEXT,
        source: null,
        content: "Data",
        mimeType: "text/plain",
        status: DocumentStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await toolExecutor.execute(
        "get_document",
        {
          documentId: "doc_secure",
          userId: USER_B, // Malicious spoof attempt
        },
        { userId: USER_A },
      );

      expect(getDocumentMock).toHaveBeenCalledWith({
        documentId: "doc_secure",
        userId: USER_A, // strictly context.userId
      });
    });

    it("records SUCCEEDED and FAILED audit events to ToolAuditService", async () => {
      getDocumentMock.mockResolvedValueOnce({
        id: "doc_audit",
        title: "Audit Title",
        sourceType: DocumentSourceType.TEXT,
        source: null,
        content: "Audit Content",
        mimeType: "text/plain",
        status: DocumentStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await toolExecutor.execute(
        "get_document",
        { documentId: "doc_audit" },
        { userId: USER_A },
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          toolName: "get_document",
          outcome: "SUCCEEDED",
          computerTool: false,
          authorizationRequired: false,
        }),
      );

      await expect(
        toolExecutor.execute(
          "get_document",
          { documentId: "" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("documentId is required.");

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          toolName: "get_document",
          outcome: "FAILED",
          computerTool: false,
          authorizationRequired: false,
          error: "documentId is required.",
        }),
      );
    });

    it("createDocumentTools helper instantiates all four tools", () => {
      const tools = createDocumentTools(mockRetrievalService, mockDocumentService);
      expect(tools).toHaveLength(4);
      expect(tools.map((t) => t.name)).toEqual([
        "document_search",
        "list_documents",
        "get_document",
        "delete_document",
      ]);
    });
  });
});
