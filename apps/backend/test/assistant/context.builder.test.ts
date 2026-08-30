import { describe, expect, it } from "vitest";

import {
  assembleAssistantContext,
  formatDocumentsForContext,
  formatMemoriesForContext,
} from "../../src/services/assistant/context.builder";

describe("assistant context builder", () => {
  it("formats retrieved documents with source metadata", () => {
    const result = formatDocumentsForContext([
      {
        id: "chunk-1",
        documentId: "document-1",
        documentTitle: "BrainOS Notes",
        sourceType: "TEXT",
        source: null,
        chunkIndex: 0,
        content: "BrainOS uses pgvector for semantic retrieval.",
        similarity: 0.91,
      },
    ]);

    expect(result).toContain("[Source 1]");
    expect(result).toContain("Title: BrainOS Notes");
    expect(result).toContain("Source Type: TEXT");
    expect(result).toContain("Source: unknown");
    expect(result).toContain("Chunk: 0");
    expect(result).toContain("Similarity: 0.91");
    expect(result).toContain(
      "BrainOS uses pgvector for semantic retrieval.",
    );
  });

  it("adds grounding instructions when documents are available", () => {
    const result = assembleAssistantContext({
      message: "What database does BrainOS use?",
      retrievedMemories: [],
      retrievedDocuments: [
        {
          id: "chunk-1",
          documentId: "document-1",
          documentTitle: "BrainOS Notes",
          sourceType: "TEXT",
          source: null,
          chunkIndex: 0,
          content: "BrainOS uses PostgreSQL with pgvector.",
          similarity: 0.95,
        },
      ],
    });

    expect(result.systemPrompt).toContain(
      "retrieved document context",
    );
    expect(result.systemPrompt).toContain(
      "Treat retrieved document context as authoritative context",
    );
    expect(result.systemPrompt).toContain(
      "Do not claim that information is unavailable when it is present",
    );
    expect(result.systemPrompt).toContain(
      "Do not ignore retrieved document context",
    );
    expect(result.systemPrompt).toContain(
      "[Document Source Instructions]",
    );
    expect(result.systemPrompt).toContain(
      "cite the relevant document sources",
    );
    expect(result.systemPrompt).toContain(
      "Do not invent source references",
    );
  });

  it("does not include document context when documents are absent", () => {
    const result = assembleAssistantContext({
      message: "Hello BrainOS",
      retrievedMemories: [],
      retrievedDocuments: [],
    });

    expect(result.systemPrompt).not.toContain(
      "[Relevant Context from Documents]",
    );
    expect(result.systemPrompt).not.toContain(
      "[Document Source Instructions]",
    );
    expect(result.systemPrompt).not.toContain(
      "[Source 1]",
    );
  });
});