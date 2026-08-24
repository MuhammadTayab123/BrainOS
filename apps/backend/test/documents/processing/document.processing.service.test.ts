import { describe, expect, it, vi } from "vitest";

import { DocumentChunker } from "../../../src/services/documents/chunking/document.chunker";
import { DocumentProcessingService } from "../../../src/services/documents/processing/document.processing.service";

describe("DocumentProcessingService", () => {
  it("delegates content chunking to DocumentChunker", () => {
    const chunker = {
      chunk: vi.fn().mockReturnValue([
        {
          index: 0,
          content: "First chunk",
        },
        {
          index: 1,
          content: "Second chunk",
        },
      ]),
    };

    const service = new DocumentProcessingService(
      chunker as unknown as DocumentChunker,
    );

    const result = service.process({
      content: "Document content",
      maxCharacters: 100,
      overlapCharacters: 10,
    });

    expect(chunker.chunk).toHaveBeenCalledWith({
      content: "Document content",
      maxCharacters: 100,
      overlapCharacters: 10,
    });

    expect(result).toEqual({
      chunks: [
        {
          index: 0,
          content: "First chunk",
        },
        {
          index: 1,
          content: "Second chunk",
        },
      ],
    });
  });
});
