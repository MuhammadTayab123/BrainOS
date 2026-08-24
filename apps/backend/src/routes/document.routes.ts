import { Router } from "express";

import {
  createDocument,
  listDocuments,
  getDocumentById,
  updateDocumentStatus,
  deleteDocumentById,
} from "../controllers/document/document.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createDocument);
router.get("/", requireAuth, listDocuments);
router.get("/:id", requireAuth, getDocumentById);
router.patch("/:id/status", requireAuth, updateDocumentStatus);
router.delete("/:id", requireAuth, deleteDocumentById);

export default router;
