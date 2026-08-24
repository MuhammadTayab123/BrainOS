import { DocumentSourceType } from "../document.types";
import {
  IngestDocumentInput,
  IngestDocumentResult,
} from "./document.ingestion.types";
import { DefaultUrlDocumentExtractor } from "./extractors/default-url.document.extractor";

export class DocumentIngestionService {
  constructor(
    private readonly urlExtractor = new DefaultUrlDocumentExtractor(),
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
    const content = await this.urlExtractor.extract(
      input.source ?? "",
    );

    return {
      content,
    };
  }

  private ingestUpload(
    input: IngestDocumentInput,
  ): IngestDocumentResult {
    if (
      input.mimeType !== "text/plain"
    ) {
      throw new Error(
        "Only plain-text uploads are supported.",
      );
    }

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
}