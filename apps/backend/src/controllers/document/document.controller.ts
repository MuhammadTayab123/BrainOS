import { Request, Response } from "express";
import {
  DocumentSourceType,
  DocumentStatus,
} from "@prisma/client";

import { DocumentService } from "../../services/documents/document.service";
import { DocumentRepository } from "../../services/documents/repositories/document.repository";

import { DocumentRetrievalService } from "../../services/documents/retrieval/document-retrieval.service";
import { EmbeddingsService } from "../../services/memory/embeddings.service";
import { OllamaProvider } from "../../services/memory/providers";
import { DocumentChunkRepository } from "../../services/documents/repositories/chunks/document-chunk.repository";

const documentService = new DocumentService(
  new DocumentRepository(),
);

const documentRetrievalService =
  new DocumentRetrievalService(
    new EmbeddingsService(
      new OllamaProvider(),
    ),
    new DocumentChunkRepository(),
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

  const uploadedFile = req.file;

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
        message:
          "Document content must be a string.",
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
        message:
          "Document MIME type must be a string.",
      },
    });
  }

  if (
    uploadedFile &&
    sourceType !== DocumentSourceType.UPLOAD
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SOURCE_TYPE",
        message:
          "Uploaded files require sourceType UPLOAD.",
      },
    });
  }

  if (
    sourceType === DocumentSourceType.UPLOAD &&
    !uploadedFile
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "FILE_REQUIRED",
        message:
          "An uploaded file is required for UPLOAD documents.",
      },
    });
  }

  let uploadedContent: string | undefined;
  let uploadedFileBuffer: Buffer | undefined;

  if (uploadedFile) {
    if (
      uploadedFile.mimetype === "text/plain"
    ) {
      uploadedContent =
        uploadedFile.buffer.toString("utf8");
    } else {
      uploadedFileBuffer = uploadedFile.buffer;
    }
  }

  const document =
    await documentService.createDocument({
      userId: req.user.id,
      title: title.trim(),
      sourceType,
      source:
        typeof source === "string"
          ? source.trim()
          : uploadedFile?.originalname,
      content:
        uploadedContent ??
        (typeof content === "string"
          ? content.trim()
          : undefined),
      mimeType:
        typeof mimeType === "string"
          ? mimeType.trim()
          : uploadedFile?.mimetype,
      fileBuffer: uploadedFileBuffer,
    });

  return res.status(201).json({
    success: true,
    data: document,
  });
}

export async function searchDocumentChunks(
  req: Request,
  res: Response,
) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { query, limit } = req.body;

  if (
    typeof query !== "string" ||
    query.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_QUERY",
        message: "Search query is required.",
      },
    });
  }

  if (
    limit !== undefined &&
    (
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 20
    )
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_LIMIT",
        message:
          "Limit must be an integer between 1 and 20.",
      },
    });
  }

  const results =
    await documentRetrievalService.search({
      userId: req.user.id,
      query: query.trim(),
      limit,
    });

  return res.status(200).json({
    success: true,
    data: results,
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
            "Invalid document status.",
        },
      });
    }

    status =
      rawStatus as DocumentStatus;
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
    !Object.values(DocumentStatus).includes(
      status,
    )
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATUS",
        message:
          "Valid document status is required.",
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