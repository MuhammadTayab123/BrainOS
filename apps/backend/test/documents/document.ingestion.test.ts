import { describe, expect, it, vi } from "vitest";

import { DocumentSourceType } from "../../src/services/documents/document.types";
import { DocumentIngestionService } from "../../src/services/documents/ingestion/document.ingestion.service";

describe("DocumentIngestionService", () => {
  function createUrlExtractorMock() {
    return {
      extract: vi.fn(),
    };
  }

  describe("TEXT", () => {
    it("normalizes text document content", async () => {
      const service = new DocumentIngestionService(
        createUrlExtractorMock() as any,
      );

      const result = await service.ingest({
        sourceType: DocumentSourceType.TEXT,
        content: "  Hello BrainOS  ",
      });

      expect(result).toEqual({
        content: "Hello BrainOS",
      });
    });

    it("rejects missing text content", async () => {
      const service = new DocumentIngestionService(
        createUrlExtractorMock() as any,
      );

      await expect(
        service.ingest({
          sourceType: DocumentSourceType.TEXT,
        }),
      ).rejects.toThrow(
        "Text documents require non-empty content.",
      );
    });

    it("rejects whitespace-only text content", async () => {
      const service = new DocumentIngestionService(
        createUrlExtractorMock() as any,
      );

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

  describe("URL", () => {
    it("extracts content from the supplied URL", async () => {
      const urlExtractor = createUrlExtractorMock();

      urlExtractor.extract.mockResolvedValue(
        "Extracted BrainOS content",
      );

      const service = new DocumentIngestionService(
        urlExtractor as any,
      );

      const result = await service.ingest({
        sourceType: DocumentSourceType.URL,
        source: "https://example.com/article",
      });

      expect(
        urlExtractor.extract,
      ).toHaveBeenCalledWith(
        "https://example.com/article",
      );

      expect(result).toEqual({
        content: "Extracted BrainOS content",
      });
    });

    it("propagates URL extraction errors", async () => {
      const urlExtractor = createUrlExtractorMock();

      urlExtractor.extract.mockRejectedValue(
        new Error(
          "URL document extraction failed with HTTP 404.",
        ),
      );

      const service = new DocumentIngestionService(
        urlExtractor as any,
      );

      await expect(
        service.ingest({
          sourceType: DocumentSourceType.URL,
          source: "https://example.com/missing",
        }),
      ).rejects.toThrow(
        "URL document extraction failed with HTTP 404.",
      );
    });

    it("passes an empty source to the extractor when URL source is missing", async () => {
      const urlExtractor = createUrlExtractorMock();

      urlExtractor.extract.mockRejectedValue(
        new Error(
          "URL document source is required.",
        ),
      );

      const service = new DocumentIngestionService(
        urlExtractor as any,
      );

      await expect(
        service.ingest({
          sourceType: DocumentSourceType.URL,
        }),
      ).rejects.toThrow(
        "URL document source is required.",
      );

      expect(
        urlExtractor.extract,
      ).toHaveBeenCalledWith("");
    });
  });

  describe("UPLOAD", () => {
    it("rejects upload ingestion until file extraction is implemented", async () => {
      const service = new DocumentIngestionService(
        createUrlExtractorMock() as any,
      );

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