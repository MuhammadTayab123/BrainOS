import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DocumentSourceType,
  DocumentStatus,
} from "@prisma/client";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  records: [] as Array<Record<string, unknown>>,
  create: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  updateStatus: vi.fn(),
  softDeleteByIdForUser: vi.fn(),
  searchDocumentChunks: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () =>
    (_req: unknown, _res: unknown, next: () => void) =>
      next(),

  getAuth: () => ({
    userId: "user-a",
    sessionId: "test-session",
    isAuthenticated: true,
  }),
}));

vi.mock("../../src/services/auth/auth.service", () => ({
  getAuthenticatedUser: fakes.authenticatedUser,
}));

vi.mock(
  "../../src/services/documents/repositories/document.repository",
  () => ({
    DocumentRepository: class {
      create(data: Record<string, unknown>) {
        return fakes.create(data);
      }

      listByUser(
        userId: string,
        status?: DocumentStatus,
        limit?: number,
      ) {
        return fakes.listByUser(
          userId,
          status,
          limit,
        );
      }

      findByIdForUser(
        documentId: string,
        userId: string,
      ) {
        return fakes.findByIdForUser(
          documentId,
          userId,
        );
      }

      updateStatus(
        documentId: string,
        userId: string,
        status: DocumentStatus,
      ) {
        return fakes.updateStatus(
          documentId,
          userId,
          status,
        );
      }

      softDeleteByIdForUser(
        documentId: string,
        userId: string,
      ) {
        return fakes.softDeleteByIdForUser(
          documentId,
          userId,
        );
      }
    },
  }),
);

vi.mock(
  "../../src/services/documents/retrieval/document-retrieval.service",
  () => ({
    DocumentRetrievalService: class {
      search(input: {
        userId: string;
        query: string;
        limit?: number;
      }) {
        return fakes.searchDocumentChunks(input);
      }
    },
  }),
);

import app from "../../src/app";

import {
  NotFoundError,
  UnauthorizedError,
} from "../../src/errors";

const userA = {
  id: "user-a",
  clerkId: "clerk-a",
  email: "user-a@example.test",
  firstName: null,
  lastName: null,
  imageUrl: null,
};

function publicDocument(
  record: Record<string, unknown>,
) {
  const {
    id,
    title,
    sourceType,
    source,
    content,
    mimeType,
    status,
    createdAt,
    updatedAt,
  } = record;

  return {
    id,
    title,
    sourceType,
    source,
    content,
    mimeType,
    status,
    createdAt,
    updatedAt,
  };
}

function addDocument(
  overrides: Record<string, unknown> = {},
) {
  const record = {
    id: "document-a",
    userId: "user-a",
    title: "Project Notes",
    sourceType: DocumentSourceType.TEXT,
    source: "BrainOS notes",
    content: "Document content",
    mimeType: "text/plain",
    status: DocumentStatus.PENDING,
    createdAt: new Date(
      "2026-01-01T00:00:00.000Z",
    ),
    updatedAt: new Date(
      "2026-01-01T00:00:00.000Z",
    ),
    deletedAt: null,
    ...overrides,
  };

  fakes.records.push(record);

  return record;
}

function findActive(
  documentId: string,
  userId: string,
) {
  return fakes.records.find(
    (record) =>
      record.id === documentId &&
      record.userId === userId &&
      record.deletedAt === null,
  );
}

describe("authenticated document API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fakes.records.length = 0;

    fakes.authenticatedUser.mockResolvedValue(
      userA,
    );

    fakes.create.mockImplementation(
      async (data: Record<string, unknown>) => {
        const document = addDocument({
          id: "document-new",
          userId: data.userId,
          title: data.title,
          sourceType: data.sourceType,
          source: data.source ?? null,
          content: data.content ?? null,
          mimeType: data.mimeType ?? null,
        });

        return publicDocument(document);
      },
    );

    fakes.listByUser.mockImplementation(
      async (
        userId: string,
        status?: DocumentStatus,
        limit = 20,
      ) =>
        fakes.records
          .filter(
            (record) =>
              record.userId === userId &&
              record.deletedAt === null &&
              (status === undefined ||
                record.status === status),
          )
          .slice(0, limit)
          .map(publicDocument),
    );

    fakes.findByIdForUser.mockImplementation(
      async (
        documentId: string,
        userId: string,
      ) => {
        const record = findActive(
          documentId,
          userId,
        );

        return record
          ? publicDocument(record)
          : null;
      },
    );

    fakes.updateStatus.mockImplementation(
      async (
        documentId: string,
        userId: string,
        status: DocumentStatus,
      ) => {
        const record = findActive(
          documentId,
          userId,
        );

        if (!record) {
          throw new NotFoundError(
            "Document not found for the authenticated user.",
          );
        }

        record.status = status;
        record.updatedAt = new Date(
          "2026-01-02T00:00:00.000Z",
        );
      },
    );

    fakes.softDeleteByIdForUser.mockImplementation(
      async (
        documentId: string,
        userId: string,
      ) => {
        const record = findActive(
          documentId,
          userId,
        );

        if (!record) {
          throw new NotFoundError(
            "Document not found for the authenticated user.",
          );
        }

        record.deletedAt = new Date(
          "2026-01-02T00:00:00.000Z",
        );

        record.status =
          DocumentStatus.DELETED;
      },
    );

    fakes.searchDocumentChunks.mockResolvedValue(
      [
        {
          id: "chunk-1",
          documentId: "document-a",
          chunkIndex: 0,
          content: "BrainOS document content",
          similarity: 0.91,
        },
      ],
    );
  });

  describe("authentication", () => {
    it.each([
      ["GET", "/api/v1/documents"],
      ["GET", "/api/v1/documents/document-a"],
      ["POST", "/api/v1/documents"],
      ["POST", "/api/v1/documents/search"],
      [
        "PATCH",
        "/api/v1/documents/document-a/status",
      ],
      ["DELETE", "/api/v1/documents/document-a"],
    ])(
      "returns 401 for unauthenticated %s %s",
      async (method, path) => {
        fakes.authenticatedUser.mockRejectedValueOnce(
          new UnauthorizedError(),
        );

        const response =
          method === "GET"
            ? await request(app).get(path)
            : method === "POST"
              ? await request(app)
                  .post(path)
                  .send({})
              : method === "PATCH"
                ? await request(app)
                    .patch(path)
                    .send({})
                : await request(app).delete(path);

        expect(response.status).toBe(401);

        expect(response.body).toEqual({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Authentication required.",
          },
        });
      },
    );
  });

  describe("create", () => {
    it("creates a document using the authenticated user", async () => {
      const response = await request(app)
        .post("/api/v1/documents")
        .send({
          title: "  My Notes  ",
          sourceType: "TEXT",
          source: "  hello world  ",
          content:
            "  This is my document content.  ",
          mimeType: "text/plain",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject({
        id: "document-new",
        title: "My Notes",
        sourceType: "TEXT",
        source: "hello world",
        content:
          "This is my document content.",
        mimeType: "text/plain",
        status: "PENDING",
      });

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "My Notes",
        sourceType: "TEXT",
        source: "hello world",
        content:
          "This is my document content.",
        mimeType: "text/plain",
      });
    });

    it("accepts a plain-text file upload", async () => {
      const response = await request(app)
        .post("/api/v1/documents")
        .field("title", "Uploaded Notes")
        .field("sourceType", "UPLOAD")
        .attach(
          "file",
          Buffer.from(
            "Hello from an uploaded text file",
          ),
          "notes.txt",
        );

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject({
        id: "document-new",
        title: "Uploaded Notes",
        sourceType: "UPLOAD",
        content:
          "Hello from an uploaded text file",
        mimeType: "text/plain",
        status: "PENDING",
      });

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "Uploaded Notes",
        sourceType: "UPLOAD",
        source: "notes.txt",
        content:
          "Hello from an uploaded text file",
        mimeType: "text/plain",
      });
    });

    it("accepts a document without content", async () => {
      const response = await request(app)
        .post("/api/v1/documents")
        .send({
          title: "Metadata Only",
          sourceType: "URL",
          source: "https://example.com",
        });

      expect(response.status).toBe(201);

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "Metadata Only",
        sourceType: "URL",
        source: "https://example.com",
        content: undefined,
        mimeType: undefined,
      });
    });

    it("rejects non-string content", async () => {
      const response = await request(app)
        .post("/api/v1/documents")
        .send({
          title: "Notes",
          sourceType: "TEXT",
          content: 123,
        });

      expect(response.status).toBe(400);

      expect(response.body.error.code).toBe(
        "INVALID_CONTENT",
      );

      expect(
        fakes.create,
      ).not.toHaveBeenCalled();
    });

    it("rejects an empty title", async () => {
      const response = await request(app)
        .post("/api/v1/documents")
        .send({
          title: "   ",
          sourceType: "TEXT",
        });

      expect(response.status).toBe(400);

      expect(response.body.error.code).toBe(
        "INVALID_TITLE",
      );

      expect(
        fakes.create,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid source type", async () => {
      const response = await request(app)
        .post("/api/v1/documents")
        .send({
          title: "Notes",
          sourceType: "INVALID",
        });

      expect(response.status).toBe(400);

      expect(response.body.error.code).toBe(
        "INVALID_SOURCE_TYPE",
      );
    });

    it("accepts a PDF file upload", async () => {
      const fs = await import(
        "node:fs/promises"
      );
      const path = await import(
        "node:path"
      );

      const pdfPath = path.join(
        process.cwd(),
        "test",
        "fixtures",
        "document-sample.pdf",
      );

      const pdfBuffer =
        await fs.readFile(pdfPath);

      const response = await request(app)
        .post("/api/v1/documents")
        .field("title", "Uploaded PDF")
        .field("sourceType", "UPLOAD")
        .attach("file", pdfBuffer, {
          filename:
            "document-sample.pdf",
          contentType:
            "application/pdf",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      expect(
        response.body.data,
      ).toMatchObject({
        id: "document-new",
        title: "Uploaded PDF",
        sourceType: "UPLOAD",
        content:
          expect.stringContaining("BrainOS"),
        mimeType: "application/pdf",
        status: "PENDING",
      });

      expect(
        fakes.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-a",
          title: "Uploaded PDF",
          sourceType: "UPLOAD",
          source:
            "document-sample.pdf",
          mimeType: "application/pdf",
        }),
      );
    });
  });

  describe("search", () => {
    it("returns semantic document chunk matches", async () => {
      const response = await request(app)
        .post("/api/v1/documents/search")
        .send({
          query: "  BrainOS  ",
          limit: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toEqual([
        {
          id: "chunk-1",
          documentId: "document-a",
          chunkIndex: 0,
          content: "BrainOS document content",
          similarity: 0.91,
        },
      ]);

      expect(
        fakes.searchDocumentChunks,
      ).toHaveBeenCalledWith({
        userId: "user-a",
        query: "BrainOS",
        limit: 5,
      });
    });

    it("uses the default search limit", async () => {
      const response = await request(app)
        .post("/api/v1/documents/search")
        .send({
          query: "BrainOS",
        });

      expect(response.status).toBe(200);

      expect(
        fakes.searchDocumentChunks,
      ).toHaveBeenCalledWith({
        userId: "user-a",
        query: "BrainOS",
        limit: undefined,
      });
    });

    it("rejects an empty search query", async () => {
      const response = await request(app)
        .post("/api/v1/documents/search")
        .send({
          query: "   ",
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_QUERY",
          message:
            "Search query is required.",
        },
      });

      expect(
        fakes.searchDocumentChunks,
      ).not.toHaveBeenCalled();
    });

    it("rejects a non-string search query", async () => {
      const response = await request(app)
        .post("/api/v1/documents/search")
        .send({
          query: 123,
        });

      expect(response.status).toBe(400);

      expect(response.body.error.code).toBe(
        "INVALID_QUERY",
      );

      expect(
        fakes.searchDocumentChunks,
      ).not.toHaveBeenCalled();
    });

    it("rejects an invalid search limit", async () => {
      const response = await request(app)
        .post("/api/v1/documents/search")
        .send({
          query: "BrainOS",
          limit: 21,
        });

      expect(response.status).toBe(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message:
            "Limit must be an integer between 1 and 20.",
        },
      });

      expect(
        fakes.searchDocumentChunks,
      ).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("returns only active owner-scoped documents", async () => {
      addDocument();

      addDocument({
        id: "document-b",
        userId: "user-b",
      });

      addDocument({
        id: "document-deleted",
        deletedAt: new Date(),
      });

      const response = await request(app).get(
        "/api/v1/documents",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);

      expect(
        response.body.data[0],
      ).toMatchObject({
        id: "document-a",
        title: "Project Notes",
        content: "Document content",
      });

      expect(
        fakes.listByUser,
      ).toHaveBeenCalledWith(
        "user-a",
        undefined,
        20,
      );
    });

    it("filters by status", async () => {
      addDocument();

      const response = await request(app).get(
        "/api/v1/documents?status=READY",
      );

      expect(response.status).toBe(200);

      expect(
        fakes.listByUser,
      ).toHaveBeenCalledWith(
        "user-a",
        DocumentStatus.READY,
        20,
      );
    });

    it("rejects an invalid status", async () => {
      const response = await request(app).get(
        "/api/v1/documents?status=INVALID",
      );

      expect(response.status).toBe(400);

      expect(
        response.body.error.code,
      ).toBe("INVALID_STATUS");
    });
  });

  describe("get", () => {
    it("returns an owner-scoped document", async () => {
      addDocument();

      const response = await request(app).get(
        "/api/v1/documents/document-a",
      );

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(
        response.body.data,
      ).toMatchObject({
        id: "document-a",
        title: "Project Notes",
        content: "Document content",
      });

      expect(
        fakes.findByIdForUser,
      ).toHaveBeenCalledWith(
        "document-a",
        "user-a",
      );
    });
  });

  describe("status", () => {
    it("updates document status", async () => {
      addDocument();

      const response = await request(app)
        .patch(
          "/api/v1/documents/document-a/status",
        )
        .send({
          status: "READY",
        });

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: "document-a",
          status: "READY",
        },
      });

      expect(
        fakes.updateStatus,
      ).toHaveBeenCalledWith(
        "document-a",
        "user-a",
        DocumentStatus.READY,
      );
    });
  });

  describe("delete", () => {
    it("soft deletes an owner-scoped document", async () => {
      addDocument();

      const response = await request(app).delete(
        "/api/v1/documents/document-a",
      );

      expect(response.status).toBe(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: "document-a",
        },
      });

      expect(
        fakes.softDeleteByIdForUser,
      ).toHaveBeenCalledWith(
        "document-a",
        "user-a",
      );
    });
  });
});