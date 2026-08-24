import { DocumentSourceType } from "../document.types";
import {
  IngestDocumentInput,
  IngestDocumentResult,
} from "./document.ingestion.types";

export class DocumentIngestionService {
  async ingest(
    input: IngestDocumentInput,
  ): Promise<IngestDocumentResult> {
    switch (input.sourceType) {
      case DocumentSourceType.TEXT:
        return this.ingestText(input);

      case DocumentSourceType.URL:
        throw new Error(
          "URL document ingestion is not implemented yet.",
        );

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
}
