import { describe, expect, it } from "vitest";

import {
  decideAssistantRetrieval,
} from "../../src/services/assistant/assistant.retrieval.policy";

describe("assistant retrieval policy", () => {
  it("enables memory retrieval by default", () => {
    const result = decideAssistantRetrieval({});

    expect(result.memory).toBe(true);
    expect(result.documents).toBe(false);
  });

  it("respects explicit retrieval settings", () => {
    const result = decideAssistantRetrieval({
      enableMemoryRetrieval: false,
      enableDocumentRetrieval: true,
    });

    expect(result.memory).toBe(false);
    expect(result.documents).toBe(true);
  });

  it("allows explicit document retrieval without enabling memory", () => {
    const result = decideAssistantRetrieval({
      enableMemoryRetrieval: false,
      enableDocumentRetrieval: true,
    });

    expect(result).toEqual({
      memory: false,
      documents: true,
    });
  });
});
