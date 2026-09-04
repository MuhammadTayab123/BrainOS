import { Router } from "express";

import {
  completeTask,
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
} from "../controllers/task/task.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listTasks);
router.post("/", requireAuth, createTask);
router.get("/:id", requireAuth, getTaskById);
router.patch("/:id", requireAuth, updateTask);
router.post("/:id/complete", requireAuth, completeTask);
router.delete("/:id", requireAuth, deleteTask);

export default router;
