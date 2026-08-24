import { Router } from "express";

import {
  createDocument,
  searchDocumentChunks,
  listDocuments,
  getDocumentById,
  updateDocumentStatus,
  deleteDocumentById,
} from "../controllers/document/document.controller";

import { requireAuth } from "../middleware/auth.middleware";
import { documentUpload } from "../middleware/document-upload.middleware";

const router = Router();

router.post(
  "/",
  requireAuth,
  documentUpload,
  createDocument,
);

router.post(
  "/search",
  requireAuth,
  searchDocumentChunks,
);

router.get(
  "/",
  requireAuth,
  listDocuments,
);

router.get(
  "/:id",
  requireAuth,
  getDocumentById,
);

router.patch(
  "/:id/status",
  requireAuth,
  updateDocumentStatus,
);

router.delete(
  "/:id",
  requireAuth,
  deleteDocumentById,
);

export default router;