import { describe, expect, it } from "vitest";

import {
  decideAssistantRetrieval,
} from "../../src/services/assistant/assistant.retrieval.policy";

describe("assistant retrieval policy", () => {
  it("enables memory and document retrieval by default", () => {
    const result = decideAssistantRetrieval({});

    expect(result.memory).toBe(true);
    expect(result.documents).toBe(true);
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

  it("allows explicit memory retrieval without enabling documents", () => {
    const result = decideAssistantRetrieval({
      enableMemoryRetrieval: true,
      enableDocumentRetrieval: false,
    });

    expect(result).toEqual({
      memory: true,
      documents: false,
    });
  });

  it("allows disabling both memory and document retrieval", () => {
    const result = decideAssistantRetrieval({
      enableMemoryRetrieval: false,
      enableDocumentRetrieval: false,
    });

    expect(result).toEqual({
      memory: false,
      documents: false,
    });
  });
});
