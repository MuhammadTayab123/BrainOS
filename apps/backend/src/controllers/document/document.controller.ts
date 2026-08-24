import { Request, Response } from "express";
import { DocumentSourceType, DocumentStatus } from "@prisma/client";

import { DocumentService } from "../../services/documents/document.service";
import { DocumentRepository } from "../../services/documents/repositories/document.repository";

const documentService = new DocumentService(
  new DocumentRepository(),
);

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  });
}

function getId(req: Request): string | null {
  const rawId = req.params.id;

  if (typeof rawId !== "string") {
    return null;
  }

  const id = rawId.trim();

  return id.length > 0 ? id : null;
}

export async function createDocument(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return unauthorized(res);
  }

  const {
  title,
  sourceType,
  source,
  content,
  mimeType,
} = req.body;

  if (
    typeof title !== "string" ||
    title.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_TITLE",
        message: "Document title is required.",
      },
    });
  }

  if (
    !Object.values(DocumentSourceType).includes(
      sourceType,
    )
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SOURCE_TYPE",
        message:
          "Source type must be UPLOAD, TEXT, or URL.",
      },
    });
  }

  if (
  content !== undefined &&
  typeof content !== "string"
) {
  return res.status(400).json({
    success: false,
    error: {
      code: "INVALID_CONTENT",
      message: "Document content must be a string.",
    },
  });
}

  if (
    mimeType !== undefined &&
    typeof mimeType !== "string"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MIME_TYPE",
        message: "MIME type must be a string.",
      },
    });
  }

  const document =
    await documentService.createDocument({
      userId: req.user.id,
      title: title.trim(),
      sourceType,
      source:
        typeof source === "string"
          ? source.trim()
          : undefined,
          content:
        typeof content === "string"
          ? content.trim()
          : undefined,
        mimeType:
        typeof mimeType === "string"
          ? mimeType.trim()
          : undefined,
    });

  return res.status(201).json({
    success: true,
    data: document,
  });
}

export async function listDocuments(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return unauthorized(res);
  }

  const rawLimit = req.query.limit;
  const rawStatus = req.query.status;

  let limit: number | undefined;

  if (rawLimit !== undefined) {
    if (
      typeof rawLimit !== "string" ||
      !/^\d+$/.test(rawLimit)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message:
            "Limit must be an integer between 1 and 50.",
        },
      });
    }

    limit = Number.parseInt(rawLimit, 10);

    if (limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message:
            "Limit must be an integer between 1 and 50.",
        },
      });
    }
  }

  let status: DocumentStatus | undefined;

  if (rawStatus !== undefined) {
    if (
      typeof rawStatus !== "string" ||
      !Object.values(DocumentStatus).includes(
        rawStatus as DocumentStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message:
            "Status must be PENDING, READY, FAILED, DELETED, or CANCELLED.",
        },
      });
    }

    status = rawStatus as DocumentStatus;
  }

  const documents =
    await documentService.listDocuments({
      userId: req.user.id,
      status,
      limit,
    });

  return res.status(200).json({
    success: true,
    data: documents,
  });
}

export async function getDocumentById(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return unauthorized(res);
  }

  const documentId = getId(req);

  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DOCUMENT_ID",
        message: "Document ID is required.",
      },
    });
  }

  const document =
    await documentService.getDocument({
      documentId,
      userId: req.user.id,
    });

  return res.status(200).json({
    success: true,
    data: document,
  });
}

export async function updateDocumentStatus(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return unauthorized(res);
  }

  const documentId = getId(req);

  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DOCUMENT_ID",
        message: "Document ID is required.",
      },
    });
  }

  const { status } = req.body;

  if (
    !Object.values(DocumentStatus).includes(status)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATUS",
        message: "Valid document status is required.",
      },
    });
  }

  await documentService.updateDocumentStatus({
    documentId,
    userId: req.user.id,
    status,
  });

  return res.status(200).json({
    success: true,
    data: {
      id: documentId,
      status,
    },
  });
}

export async function deleteDocumentById(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return unauthorized(res);
  }

  const documentId = getId(req);

  if (!documentId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DOCUMENT_ID",
        message: "Document ID is required.",
      },
    });
  }

  await documentService.deleteDocument({
    documentId,
    userId: req.user.id,
  });

  return res.status(200).json({
    success: true,
    data: {
      id: documentId,
    },
  });
}
