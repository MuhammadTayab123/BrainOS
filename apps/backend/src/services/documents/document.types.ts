import {
  DocumentSourceType,
  DocumentStatus,
} from "@prisma/client";

export {
  DocumentSourceType,
  DocumentStatus,
};
export interface DocumentSourceReference {
  documentId: string;
  documentTitle: string;
  sourceType: DocumentSourceType | string;
  source: string | null;
  chunkIndex: number;
}
export interface CreateDocumentInput {
  userId: string;
  title: string;
  sourceType: DocumentSourceType;
  source?: string;
  content?: string;
  mimeType?: string;
  fileBuffer?: Buffer;
}

export interface ListDocumentsInput {
  userId: string;
  status?: DocumentStatus;
  limit?: number;
}

export interface GetDocumentInput {
  documentId: string;
  userId: string;
}

export interface UpdateDocumentStatusInput {
  documentId: string;
  userId: string;
  status: DocumentStatus;
}

export interface DeleteDocumentInput {
  documentId: string;
  userId: string;
}

export interface DocumentListResult {
  id: string;
  title: string;
  sourceType: DocumentSourceType;
  source: string | null;
  content: string | null;
  mimeType: string | null;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}