import { describe, expect, it } from "vitest";

import { DocumentSourceType } from "../../src/services/documents/document.types";
import { DocumentIngestionService } from "../../src/services/documents/ingestion/document.ingestion.service";

describe("DocumentIngestionService", () => {
  const service = new DocumentIngestionService();

  describe("TEXT", () => {
    it("normalizes text document content", async () => {
      const result = await service.ingest({
        sourceType: DocumentSourceType.TEXT,
        content: "  Hello BrainOS  ",
      });

      expect(result).toEqual({
        content: "Hello BrainOS",
      });
    });

    it("rejects missing text content", async () => {
      await expect(
        service.ingest({
          sourceType: DocumentSourceType.TEXT,
        }),
      ).rejects.toThrow(
        "Text documents require non-empty content.",
      );
    });

    it("rejects whitespace-only text content", async () => {
      await expect(
        service.ingest({
          sourceType: DocumentSourceType.TEXT,
          content: "   ",
        }),
      ).rejects.toThrow(
        "Text documents require non-empty content.",
      );
    });
  });

  describe("unsupported sources", () => {
    it("rejects URL ingestion until URL extraction is implemented", async () => {
      await expect(
        service.ingest({
          sourceType: DocumentSourceType.URL,
          source: "https://example.com",
        }),
      ).rejects.toThrow(
        "URL document ingestion is not implemented yet.",
      );
    });

    it("rejects upload ingestion until file extraction is implemented", async () => {
      await expect(
        service.ingest({
          sourceType: DocumentSourceType.UPLOAD,
          source: "example.pdf",
        }),
      ).rejects.toThrow(
        "Uploaded file ingestion is not implemented yet.",
      );
    });
  });
});
