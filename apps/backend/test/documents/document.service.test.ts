import { describe, expect, it, vi } from "vitest";
import { DocumentStatus, DocumentSourceType } from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { DocumentService } from "../../src/services/documents/document.service";

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

  it("creates a document with normalized fields", async () => {
    const repository = createRepositoryMock();

    repository.create.mockResolvedValue({
      id: "doc-1",
      title: "Project Notes",
      sourceType: DocumentSourceType.TEXT,
      source: "hello world",
      mimeType: "text/plain",
      status: DocumentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const service = new DocumentService(repository as any);

    const result = await service.createDocument({
      userId: "user-1",
      title: "  Project Notes  ",
      sourceType: DocumentSourceType.TEXT,
      source: "  hello world  ",
      mimeType: " text/plain ",
    });

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      title: "Project Notes",
      sourceType: DocumentSourceType.TEXT,
      source: "hello world",
      mimeType: "text/plain",
    });

    expect(result.id).toBe("doc-1");
  });

  it("rejects an empty title", async () => {
    const repository = createRepositoryMock();
    const service = new DocumentService(repository as any);

    await expect(
      service.createDocument({
        userId: "user-1",
        title: "   ",
        sourceType: DocumentSourceType.TEXT,
      }),
    ).rejects.toThrow(
      "Document title is required.",
    );
  });

  it("lists documents with the default limit", async () => {
    const repository = createRepositoryMock();
    repository.listByUser.mockResolvedValue([]);

    const service = new DocumentService(repository as any);

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
    const service = new DocumentService(repository as any);

    await expect(
      service.listDocuments({
        userId: "user-1",
        limit: 51,
      }),
    ).rejects.toThrow(
      "Document list limit must be an integer between 1 and 50.",
    );
  });

  it("returns a document owned by the authenticated user", async () => {
    const repository = createRepositoryMock();

    const document = {
      id: "doc-1",
      title: "Notes",
      sourceType: DocumentSourceType.TEXT,
      source: "content",
      mimeType: "text/plain",
      status: DocumentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repository.findByIdForUser.mockResolvedValue(document);

    const service = new DocumentService(repository as any);

    const result = await service.getDocument({
      documentId: "doc-1",
      userId: "user-1",
    });

    expect(result).toEqual(document);
    expect(repository.findByIdForUser).toHaveBeenCalledWith(
      "doc-1",
      "user-1",
    );
  });

  it("throws when the document does not exist for the user", async () => {
    const repository = createRepositoryMock();
    repository.findByIdForUser.mockResolvedValue(null);

    const service = new DocumentService(repository as any);

    await expect(
      service.getDocument({
        documentId: "doc-1",
        userId: "user-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates document status", async () => {
    const repository = createRepositoryMock();
    repository.updateStatus.mockResolvedValue(undefined);

    const service = new DocumentService(repository as any);

    await service.updateDocumentStatus({
      documentId: "doc-1",
      userId: "user-1",
      status: DocumentStatus.READY,
    });

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "doc-1",
      "user-1",
      DocumentStatus.READY,
    );
  });

  it("does not allow DELETED through status update", async () => {
    const repository = createRepositoryMock();
    const service = new DocumentService(repository as any);

    await expect(
      service.updateDocumentStatus({
        documentId: "doc-1",
        userId: "user-1",
        status: DocumentStatus.DELETED,
      }),
    ).rejects.toThrow(
      "Use deleteDocument to delete a document.",
    );
  });

  it("soft deletes a document", async () => {
    const repository = createRepositoryMock();
    repository.softDeleteByIdForUser.mockResolvedValue(
      undefined,
    );

    const service = new DocumentService(repository as any);

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
