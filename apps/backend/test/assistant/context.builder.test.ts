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

  it("includes provided date and time in the system prompt", () => {
    const fixedDate = new Date("2026-09-04T19:00:00.000Z");
    const result = assembleAssistantContext({
      message: "Create a task called Study DSA tomorrow at 7 PM",
      retrievedMemories: [],
      retrievedDocuments: [],
      now: fixedDate,
    });

    expect(result.systemPrompt).toContain(
      "Current UTC Time: 2026-09-04T19:00:00.000Z",
    );
    expect(result.systemPrompt).toContain(
      "Instructions for Date & Time Handling:",
    );
  });

  it("defaults to current date and time when now parameter is omitted", () => {
    const result = assembleAssistantContext({
      message: "What is the date today?",
      retrievedMemories: [],
      retrievedDocuments: [],
    });

    expect(result.systemPrompt).toMatch(
      /Current UTC Time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
    );
  });

  it("includes user timezone and local time in the system prompt when provided", () => {
    const fixedDate = new Date("2026-09-04T16:55:00.000Z");
    const result = assembleAssistantContext({
      message: "Create a task called Study DSA tomorrow at 7 PM",
      retrievedMemories: [],
      retrievedDocuments: [],
      now: fixedDate,
      timezone: "Asia/Karachi",
    });

    expect(result.systemPrompt).toContain(
      "Current UTC Time: 2026-09-04T16:55:00.000Z",
    );
    expect(result.systemPrompt).toContain(
      "User Timezone: Asia/Karachi",
    );
    expect(result.systemPrompt).toContain(
      "Interpret all relative dates and times (such as \"today\", \"tomorrow\", \"next Monday\", \"at 7 PM\") in the user's local timezone (Asia/Karachi).",
    );
    expect(result.systemPrompt).toContain(
      "When invoking tools that require an ISO 8601 timestamp (such as dueAt in create_task), compute the exact moment in time based on the user's local timezone",
    );
  });

  describe("BrainOS Identity & Provenance", () => {
    it("includes BrainOS identity and Tayyab creator attribution in default system prompt", () => {
      const result = assembleAssistantContext({
        message: "Who built you?",
        retrievedMemories: [],
        retrievedDocuments: [],
      });

      expect(result.systemPrompt).toContain(
        "You are BrainOS, a personal AI assistant built by Tayyab.",
      );
      expect(result.systemPrompt).toContain(
        "[BrainOS Identity and Provenance Instructions]",
      );
      expect(result.systemPrompt).toContain(
        'I am BrainOS, a personal AI assistant built by Tayyab.',
      );
      expect(result.systemPrompt).toContain(
        "who created you, who built you, who made you, who developed you, or who your creator is",
      );
    });

    it("includes explicit provider and coding-agent exclusion rules", () => {
      const result = assembleAssistantContext({
        message: "Are you OpenAI or Google?",
        retrievedMemories: [],
        retrievedDocuments: [],
      });

      expect(result.systemPrompt).toContain(
        "Never identify yourself as Antigravity, GitHub Copilot, Google, DeepMind, OpenAI, Anthropic, or any underlying model or provider.",
      );
      expect(result.systemPrompt).toContain(
        "Underlying AI models, inference endpoints, and providers are internal implementation details only",
      );
    });

    it("preserves BrainOS identity instructions even when custom systemPrompt is supplied", () => {
      const customPrompt = "You are a specialized code reviewer. Be concise and strict.";
      const result = assembleAssistantContext({
        message: "who made BrainOS?",
        systemPrompt: customPrompt,
        retrievedMemories: [],
        retrievedDocuments: [],
      });

      expect(result.systemPrompt).toContain(customPrompt);
      expect(result.systemPrompt).toContain(
        "[BrainOS Identity and Provenance Instructions]",
      );
      expect(result.systemPrompt).toContain(
        "I am BrainOS, a personal AI assistant built by Tayyab.",
      );
      expect(result.systemPrompt).toContain(
        "Never identify yourself as Antigravity, GitHub Copilot, Google, DeepMind, OpenAI, Anthropic, or any underlying model or provider.",
      );
    });
  });
});
