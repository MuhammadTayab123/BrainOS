import { Router } from "express";

import {
  createMemory,
  searchMemories,
} from "../controllers/memory/memory.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createMemory);

router.post("/search", requireAuth, searchMemories);

export default router;