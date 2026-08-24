import { describe, expect, it } from "vitest";

import { DocumentChunker } from "../../src/services/documents/chunking/document.chunker";

describe("DocumentChunker", () => {
  const chunker = new DocumentChunker();

  it("rejects empty content", () => {
    expect(() =>
      chunker.chunk({
        content: "   ",
      }),
    ).toThrow(
      "Document content is required for chunking.",
    );
  });

 it("returns one chunk for short content", () => {
  expect(
    chunker.chunk({
      content: "Hello BrainOS",
      maxCharacters: 100,
      overlapCharacters: 10,
    }),
  ).toEqual([
    {
      index: 0,
      content: "Hello BrainOS",
    },
  ]);
});

  it("splits long content into ordered chunks", () => {
    const result = chunker.chunk({
      content: "abcdefghijklmnopqrst",
      maxCharacters: 8,
      overlapCharacters: 2,
    });

    expect(result).toEqual([
      {
        index: 0,
        content: "abcdefgh",
      },
      {
        index: 1,
        content: "ghijklmn",
      },
      {
        index: 2,
        content: "mnopqrst",
      },
    ]);
  });

  it("rejects an invalid chunk size", () => {
    expect(() =>
      chunker.chunk({
        content: "Hello",
        maxCharacters: 0,
      }),
    ).toThrow(
      "Chunk size must be a positive integer.",
    );
  });

  it("rejects negative overlap", () => {
    expect(() =>
      chunker.chunk({
        content: "Hello",
        overlapCharacters: -1,
      }),
    ).toThrow(
      "Chunk overlap must be a non-negative integer.",
    );
  });


  it("prefers paragraph or sentence boundaries", () => {
  const result = chunker.chunk({
    content:
      "First sentence. Second sentence.\n\nThird paragraph.",
    maxCharacters: 40,
    overlapCharacters: 5,
  });

  expect(result[0].content).toBe(
    "First sentence. Second sentence.",
  );
});

  it("rejects overlap greater than or equal to chunk size", () => {
    expect(() =>
      chunker.chunk({
        content: "Hello",
        maxCharacters: 10,
        overlapCharacters: 10,
      }),
    ).toThrow(
      "Chunk overlap must be smaller than chunk size.",
    );
  }

);
});
