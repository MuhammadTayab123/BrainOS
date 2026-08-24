import { DocumentSourceType } from "../document.types";
import {
  IngestDocumentInput,
  IngestDocumentResult,
} from "./document.ingestion.types";

import { DefaultUrlDocumentExtractor } from "./extractors/default-url.document.extractor";
import { DefaultPdfDocumentExtractor } from "./extractors/default-pdf.document.extractor";

export class DocumentIngestionService {
  constructor(
    private readonly urlExtractor =
      new DefaultUrlDocumentExtractor(),
    private readonly pdfExtractor =
      new DefaultPdfDocumentExtractor(),
  ) {}

  async ingest(
    input: IngestDocumentInput,
  ): Promise<IngestDocumentResult> {
    switch (input.sourceType) {
      case DocumentSourceType.TEXT:
        return this.ingestText(input);

      case DocumentSourceType.URL:
        return this.ingestUrl(input);

      case DocumentSourceType.UPLOAD:
        return this.ingestUpload(input);

      default:
        throw new Error(
          "Unsupported document source type.",
        );
    }
  }

  private ingestText(
    input: IngestDocumentInput,
  ): IngestDocumentResult {
    if (
      typeof input.content !== "string" ||
      input.content.trim().length === 0
    ) {
      throw new Error(
        "Text documents require non-empty content.",
      );
    }

    return {
      content: input.content.trim(),
    };
  }

  private async ingestUrl(
    input: IngestDocumentInput,
  ): Promise<IngestDocumentResult> {
    const content =
      await this.urlExtractor.extract(
        input.source ?? "",
      );

    return {
      content,
    };
  }

  private async ingestUpload(
    input: IngestDocumentInput,
  ): Promise<IngestDocumentResult> {
    if (input.mimeType === "text/plain") {
      if (
        typeof input.content !== "string" ||
        input.content.trim().length === 0
      ) {
        throw new Error(
          "Uploaded text files require non-empty content.",
        );
      }

      return {
        content: input.content.trim(),
      };
    }

    if (input.mimeType === "application/pdf") {
      if (
        !Buffer.isBuffer(input.fileBuffer) ||
        input.fileBuffer.length === 0
      ) {
        throw new Error(
          "Uploaded PDF files require file data.",
        );
      }

      const content =
        await this.pdfExtractor.extract(
          input.fileBuffer,
        );

      return {
        content,
      };
    }

    throw new Error(
      "Unsupported upload MIME type.",
    );
  }
}