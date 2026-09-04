import { Router } from "express";

import {
  cancelReminder,
  createReminder,
  deleteReminder,
  getReminderById,
  listReminders,
} from "../controllers/reminder/reminder.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, listReminders);
router.post("/", requireAuth, createReminder);
router.get("/:id", requireAuth, getReminderById);
router.post("/:id/cancel", requireAuth, cancelReminder);
router.delete("/:id", requireAuth, deleteReminder);

export default router;
