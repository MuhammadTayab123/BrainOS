import { Router } from "express";

import {
  authenticateComputerAgent,
  createComputerAgent,
  deleteComputerAgent,
  getComputerAgentById,
  listComputerAgents,
  revokeComputerAgent,
} from "../controllers/computer-agent/computer-agent.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listComputerAgents);
router.post("/", requireAuth, createComputerAgent);
router.post("/authenticate", authenticateComputerAgent);
router.get("/:id", requireAuth, getComputerAgentById);
router.post("/:id/revoke", requireAuth, revokeComputerAgent);
router.delete("/:id", requireAuth, deleteComputerAgent);

export default router;
