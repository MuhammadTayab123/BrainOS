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
        throw new Error(
          "Uploaded file ingestion is not implemented yet.",
        );

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
}