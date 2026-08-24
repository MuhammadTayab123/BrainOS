import { DocumentSourceType } from "../document.types";

export interface IngestDocumentInput {
  sourceType: DocumentSourceType;
  source?: string;
  content?: string;
  mimeType?: string;
  fileBuffer?: Buffer;
}

export interface IngestDocumentResult {
  content: string;
}