import { describe, expect, it, vi } from "vitest";
import {
  DocumentStatus,
  DocumentSourceType,
} from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { DocumentService } from "../../src/services/documents/document.service";
import { DocumentIngestionService } from "../../src/services/documents/ingestion/document.ingestion.service";

describe("DocumentService", () => {
  function createRepositoryMock() {
    return {
      create: vi.fn(),
      listByUser: vi.fn(),
      findByIdForUser: vi.fn(),
      updateStatus: vi.fn(),
      softDeleteByIdForUser: vi.fn(),
    };
  }

  function createIngestionMock() {
    return {
      ingest: vi.fn(),
    };
  }

  it("creates a document with normalized fields and ingested content", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    ingestion.ingest.mockResolvedValue({
      content: "Hello BrainOS document content",
    });

    repository.create.mockResolvedValue({
      id: "doc-1",
      title: "Project Notes",
      sourceType: DocumentSourceType.TEXT,
      source: "hello world",
      content: "Hello BrainOS document content",
      mimeType: "text/plain",
      status: DocumentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    const result = await service.createDocument({
      userId: "user-1",
      title: "  Project Notes  ",
      sourceType: DocumentSourceType.TEXT,
      source: "  hello world  ",
      content: "  raw document content  ",
      mimeType: " text/plain ",
    });

    expect(ingestion.ingest).toHaveBeenCalledWith({
      sourceType: DocumentSourceType.TEXT,
      source: "  hello world  ",
      content: "  raw document content  ",
      mimeType: " text/plain ",
    });

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      title: "Project Notes",
      sourceType: DocumentSourceType.TEXT,
      source: "hello world",
      content: "Hello BrainOS document content",
      mimeType: "text/plain",
    });

    expect(result.id).toBe("doc-1");
  });

  it("rejects an empty title", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await expect(
      service.createDocument({
        userId: "user-1",
        title: "   ",
        sourceType: DocumentSourceType.TEXT,
        content: "Some content",
      }),
    ).rejects.toThrow(
      "Document title is required.",
    );

    expect(ingestion.ingest).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects a missing source type", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await expect(
      service.createDocument({
        userId: "user-1",
        title: "Project Notes",
        sourceType: undefined as any,
        content: "Some content",
      }),
    ).rejects.toThrow(
      "Document source type is required.",
    );

    expect(ingestion.ingest).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("propagates ingestion errors", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    ingestion.ingest.mockRejectedValue(
      new Error(
        "Text documents require non-empty content.",
      ),
    );

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await expect(
      service.createDocument({
        userId: "user-1",
        title: "Project Notes",
        sourceType: DocumentSourceType.TEXT,
        content: "   ",
      }),
    ).rejects.toThrow(
      "Text documents require non-empty content.",
    );

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("lists documents with the default limit", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    repository.listByUser.mockResolvedValue([]);

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await service.listDocuments({
      userId: "user-1",
    });

    expect(repository.listByUser).toHaveBeenCalledWith(
      "user-1",
      undefined,
      20,
    );
  });

  it("rejects an invalid list limit", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await expect(
      service.listDocuments({
        userId: "user-1",
        limit: 51,
      }),
    ).rejects.toThrow(
      "Document list limit must be an integer between 1 and 50.",
    );

    expect(repository.listByUser).not.toHaveBeenCalled();
  });

  it("returns a document owned by the authenticated user", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    const document = {
      id: "doc-1",
      title: "Notes",
      sourceType: DocumentSourceType.TEXT,
      source: "content",
      content: "Document content",
      mimeType: "text/plain",
      status: DocumentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repository.findByIdForUser.mockResolvedValue(
      document,
    );

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    const result = await service.getDocument({
      documentId: "doc-1",
      userId: "user-1",
    });

    expect(result).toEqual(document);

    expect(
      repository.findByIdForUser,
    ).toHaveBeenCalledWith(
      "doc-1",
      "user-1",
    );
  });

  it("throws when the document does not exist for the user", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    repository.findByIdForUser.mockResolvedValue(
      null,
    );

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await expect(
      service.getDocument({
        documentId: "doc-1",
        userId: "user-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates document status", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    repository.updateStatus.mockResolvedValue(
      undefined,
    );

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await service.updateDocumentStatus({
      documentId: "doc-1",
      userId: "user-1",
      status: DocumentStatus.READY,
    });

    expect(
      repository.updateStatus,
    ).toHaveBeenCalledWith(
      "doc-1",
      "user-1",
      DocumentStatus.READY,
    );
  });

  it("does not allow DELETED through status update", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await expect(
      service.updateDocumentStatus({
        documentId: "doc-1",
        userId: "user-1",
        status: DocumentStatus.DELETED,
      }),
    ).rejects.toThrow(
      "Use deleteDocument to delete a document.",
    );

    expect(
      repository.updateStatus,
    ).not.toHaveBeenCalled();
  });

  it("soft deletes a document", async () => {
    const repository = createRepositoryMock();
    const ingestion = createIngestionMock();

    repository.softDeleteByIdForUser.mockResolvedValue(
      undefined,
    );

    const service = new DocumentService(
      repository as any,
      ingestion as unknown as DocumentIngestionService,
    );

    await service.deleteDocument({
      documentId: "doc-1",
      userId: "user-1",
    });

    expect(
      repository.softDeleteByIdForUser,
    ).toHaveBeenCalledWith(
      "doc-1",
      "user-1",
    );
  });
});