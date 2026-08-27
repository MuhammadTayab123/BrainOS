import { Router } from "express";

import {
  createAutomation,
  deleteAutomation,
  getAutomationById,
  listAutomations,
  pauseAutomation,
  resumeAutomation,
  updateAutomation,
} from "../controllers/automation/automation.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post("/", requireAuth, createAutomation);
router.get("/", requireAuth, listAutomations);

router.get("/:id", requireAuth, getAutomationById);
router.patch("/:id", requireAuth, updateAutomation);

router.post("/:id/pause", requireAuth, pauseAutomation);

router.post("/:id/resume", requireAuth, resumeAutomation);

router.delete("/:id", requireAuth, deleteAutomation);

export default router;
