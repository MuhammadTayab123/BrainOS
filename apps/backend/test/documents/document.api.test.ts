import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentSourceType, DocumentStatus } from "@prisma/client";

const fakes = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  records: [] as Array<Record<string, unknown>>,
  create: vi.fn(),
  listByUser: vi.fn(),
  findByIdForUser: vi.fn(),
  updateStatus: vi.fn(),
  softDeleteByIdForUser: vi.fn(),
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
        return fakes.listByUser(userId, status, limit);
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
        record.status = DocumentStatus.DELETED;
      },
    );
  });

  describe("authentication", () => {
    it.each([
      ["GET", "/api/v1/documents"],
      ["GET", "/api/v1/documents/document-a"],
      ["POST", "/api/v1/documents"],
      ["PATCH", "/api/v1/documents/document-a/status"],
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
            message: "Authentication required.",
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
          mimeType: "text/plain",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: "document-new",
        title: "My Notes",
        sourceType: "TEXT",
        source: "hello world",
        mimeType: "text/plain",
        status: "PENDING",
      });

      expect(fakes.create).toHaveBeenCalledWith({
        userId: "user-a",
        title: "My Notes",
        sourceType: "TEXT",
        source: "hello world",
        mimeType: "text/plain",
      });
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
      expect(fakes.create).not.toHaveBeenCalled();
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
      expect(response.body.data[0]).toMatchObject({
        id: "document-a",
        title: "Project Notes",
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
      expect(response.body.error.code).toBe(
        "INVALID_STATUS",
      );
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
      expect(response.body.data).toMatchObject({
        id: "document-a",
        title: "Project Notes",
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
