import { DocumentSourceType } from "../document.types";

export interface IngestDocumentInput {
  sourceType: DocumentSourceType;
  source?: string;
  content?: string;
  mimeType?: string;
}

export interface IngestDocumentResult {
  content: string;
}
