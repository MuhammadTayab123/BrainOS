import { NotFoundError } from "../../errors";

import { DocumentRepository } from "./repositories/document.repository";
import {
  CreateDocumentInput,
  DocumentListResult,
  DocumentStatus,
  ListDocumentsInput,
  GetDocumentInput,
  UpdateDocumentStatusInput,
  DeleteDocumentInput,
} from "./document.types";

const DEFAULT_DOCUMENT_LIST_LIMIT = 20;
const MAX_DOCUMENT_LIST_LIMIT = 50;

export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
  ) {}

  async createDocument(
    input: CreateDocumentInput,
  ): Promise<DocumentListResult> {
    this.validateUserId(input.userId);
    this.validateTitle(input.title);

    if (!input.sourceType) {
      throw new Error(
        "Document source type is required.",
      );
    }

    return this.documentRepository.create({
      userId: input.userId,
      title: input.title.trim(),
      sourceType: input.sourceType,
      source: input.source?.trim() || undefined,
      mimeType: input.mimeType?.trim() || undefined,
    });
  }

  async listDocuments(
    input: ListDocumentsInput,
  ): Promise<DocumentListResult[]> {
    this.validateUserId(input.userId);

    const limit =
      input.limit ?? DEFAULT_DOCUMENT_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_DOCUMENT_LIST_LIMIT
    ) {
      throw new Error(
        `Document list limit must be an integer between 1 and ${MAX_DOCUMENT_LIST_LIMIT}.`,
      );
    }

    return this.documentRepository.listByUser(
      input.userId,
      input.status,
      limit,
    );
  }

  async getDocument(
    input: GetDocumentInput,
  ): Promise<DocumentListResult> {
    this.validateUserId(input.userId);
    this.validateId(
      input.documentId,
      "Document ID",
    );

    const document =
      await this.documentRepository.findByIdForUser(
        input.documentId,
        input.userId,
      );

    if (!document) {
      throw new NotFoundError(
        "Document not found for the authenticated user.",
      );
    }

    return document;
  }

  async updateDocumentStatus(
    input: UpdateDocumentStatusInput,
  ): Promise<void> {
    this.validateUserId(input.userId);
    this.validateId(
      input.documentId,
      "Document ID",
    );

    if (!input.status) {
      throw new Error(
        "Document status is required.",
      );
    }

    if (input.status === DocumentStatus.DELETED) {
      throw new Error(
        "Use deleteDocument to delete a document.",
      );
    }

    await this.documentRepository.updateStatus(
      input.documentId,
      input.userId,
      input.status,
    );
  }

  async deleteDocument(
    input: DeleteDocumentInput,
  ): Promise<void> {
    this.validateUserId(input.userId);
    this.validateId(
      input.documentId,
      "Document ID",
    );

    await this.documentRepository.softDeleteByIdForUser(
      input.documentId,
      input.userId,
    );
  }

  private validateUserId(userId: string): void {
    if (
      !userId ||
      userId.trim().length === 0
    ) {
      throw new Error(
        "User ID is required.",
      );
    }
  }

  private validateId(
    value: string,
    fieldName: string,
  ): void {
    if (
      !value ||
      value.trim().length === 0
    ) {
      throw new Error(
        `${fieldName} is required.`,
      );
    }
  }

  private validateTitle(title: string): void {
    if (
      !title ||
      title.trim().length === 0
    ) {
      throw new Error(
        "Document title is required.",
      );
    }
  }
}
