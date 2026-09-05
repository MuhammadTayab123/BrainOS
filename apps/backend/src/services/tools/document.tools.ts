import { DocumentStatus } from "@prisma/client";

import { EmbeddingsService } from "../memory/embeddings.service";
import { OllamaProvider } from "../memory/providers";
import { DocumentChunkRepository } from "../documents/repositories/chunks/document-chunk.repository";
import { DocumentRetrievalService } from "../documents/retrieval/document-retrieval.service";
import { DocumentRepository } from "../documents/repositories/document.repository";
import { DocumentService } from "../documents/document.service";
import {
  DeleteDocumentInput,
  GetDocumentInput,
  ListDocumentsInput,
} from "../documents/document.types";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const defaultDocumentRetrievalService = new DocumentRetrievalService(
  new EmbeddingsService(new OllamaProvider()),
  new DocumentChunkRepository(),
);

const defaultDocumentService = new DocumentService(
  new DocumentRepository(),
);

export const ALL_DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  DocumentStatus.PENDING,
  DocumentStatus.READY,
  DocumentStatus.FAILED,
  DocumentStatus.DELETED,
];


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

function optionalEnum<T extends string>(
  input: Record<string, unknown>,
  field: string,
  values: readonly T[],
): T | undefined {
  const value = input[field];

  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !values.includes(value as T)
  ) {
    throw new Error(
      `${field} must be one of: ${values.join(", ")}.`,
    );
  }

  return value as T;
}

function optionalPositiveIntegerInRange(
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

export function createDocumentSearchTool(
  documentRetrievalService: DocumentRetrievalService = defaultDocumentRetrievalService,
): ToolDefinition {
  return {
    name: "document_search",
    description:
      "Search indexed documents and knowledge base using semantic retrieval.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query to match against document content.",
        },
        limit: {
          type: "integer",
          description:
            "Optional maximum number of document chunks to return (1-20).",
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

      const query = requireString(object, "query");
      const limit = optionalPositiveIntegerInRange(object, "limit", 1, 20);

      return documentRetrievalService.search({
        userId,
        query,
        limit,
      });
    },
  };
}

export function createListDocumentsTool(
  documentService: DocumentService = defaultDocumentService,
): ToolDefinition {
  return {
    name: "list_documents",
    description:
      "List uploaded documents and knowledge base sources for the authenticated user, optionally filtered by status.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ALL_DOCUMENT_STATUSES as unknown as string[],
          description:
            "Optional document status filter: 'PENDING', 'READY', 'FAILED', or 'DELETED'.",
        },

        limit: {
          type: "integer",
          description:
            "Optional maximum number of documents to return (1-50, default 20).",
        },
      },
    },
    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const listInput: ListDocumentsInput = {
        userId,
        status: optionalEnum(object, "status", ALL_DOCUMENT_STATUSES),
        limit: optionalPositiveIntegerInRange(object, "limit", 1, 50),
      };

      const documents = await documentService.listDocuments(listInput);

      return documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        sourceType: doc.sourceType,
        source: doc.source,
        mimeType: doc.mimeType,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
    },
  };
}

export function createGetDocumentTool(
  documentService: DocumentService = defaultDocumentService,
): ToolDefinition {
  return {
    name: "get_document",
    description:
      "Retrieve full details, metadata, and content of a specific document by its unique documentId.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The unique ID of the document to retrieve.",
        },
      },
      required: ["documentId"],
    },
    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const documentId = requireString(object, "documentId");

      const getInput: GetDocumentInput = {
        documentId,
        userId,
      };

      const doc = await documentService.getDocument(getInput);

      return {
        id: doc.id,
        title: doc.title,
        sourceType: doc.sourceType,
        source: doc.source,
        content: doc.content,
        mimeType: doc.mimeType,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    },
  };
}

export function createDeleteDocumentTool(
  documentService: DocumentService = defaultDocumentService,
): ToolDefinition {
  return {
    name: "delete_document",
    description:
      "Delete (remove) a document from the user's knowledge base by its unique documentId.",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The unique ID of the document to delete.",
        },
      },
      required: ["documentId"],
    },
    async execute(
      input: unknown,
      context: ToolContext,
    ) {
      const userId = assertContextUser(context);
      const object = requireObject(input);

      const documentId = requireString(object, "documentId");

      const deleteInput: DeleteDocumentInput = {
        documentId,
        userId,
      };

      await documentService.deleteDocument(deleteInput);

      return {
        success: true,
        documentId,
      };
    },
  };
}

export function createDocumentTools(
  documentRetrievalService: DocumentRetrievalService = defaultDocumentRetrievalService,
  documentService: DocumentService = defaultDocumentService,
): ToolDefinition[] {
  return [
    createDocumentSearchTool(documentRetrievalService),
    createListDocumentsTool(documentService),
    createGetDocumentTool(documentService),
    createDeleteDocumentTool(documentService),
  ];
}

export const documentSearchTool = createDocumentSearchTool();
export const listDocumentsTool = createListDocumentsTool();
export const getDocumentTool = createGetDocumentTool();
export const deleteDocumentTool = createDeleteDocumentTool();
