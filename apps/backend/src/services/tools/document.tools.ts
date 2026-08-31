import { EmbeddingsService } from "../memory/embeddings.service";
import { OllamaProvider } from "../memory/providers";
import { DocumentChunkRepository } from "../documents/repositories/chunks/document-chunk.repository";
import { DocumentRetrievalService } from "../documents/retrieval/document-retrieval.service";
import {
  ToolContext,
  ToolDefinition,
} from "./tool.types";

const defaultDocumentRetrievalService = new DocumentRetrievalService(
  new EmbeddingsService(new OllamaProvider()),
  new DocumentChunkRepository(),
);

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
      if (
        typeof input !== "object" ||
        input === null ||
        Array.isArray(input)
      ) {
        throw new Error("Tool input must be an object.");
      }

      const raw = input as Record<string, unknown>;

      if (
        !("query" in raw) ||
        typeof raw.query !== "string" ||
        raw.query.trim().length === 0
      ) {
        throw new Error("query is required.");
      }

      let limit: number | undefined;

      if ("limit" in raw && raw.limit !== undefined) {
        if (
          typeof raw.limit !== "number" ||
          !Number.isInteger(raw.limit) ||
          raw.limit < 1 ||
          raw.limit > 20
        ) {
          throw new Error(
            "limit must be an integer between 1 and 20.",
          );
        }

        limit = raw.limit;
      }

      if (
        !context.userId ||
        context.userId.trim().length === 0
      ) {
        throw new Error("User ID is required.");
      }

      return documentRetrievalService.search({
        userId: context.userId.trim(),
        query: raw.query.trim(),
        limit,
      });
    },
  };
}

export const documentSearchTool = createDocumentSearchTool();
