import { Router } from "express";

import {
  createMemory,
  deleteMemoryById,
  getMemoryById,
  listMemories,
  searchMemories,
  updateMemoryById,
} from "../controllers/memory/memory.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createMemory);
router.get("/", requireAuth, listMemories);
router.get("/:id", requireAuth, getMemoryById);
router.delete("/:id", requireAuth, deleteMemoryById);
router.patch("/:id", requireAuth, updateMemoryById);

router.post("/search", requireAuth, searchMemories);

export default router;