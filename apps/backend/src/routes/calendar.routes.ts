import { Router } from "express";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  listCalendarEvents,
  updateCalendarEvent,
} from "../controllers/calendar/calendar.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/events", requireAuth, listCalendarEvents);
router.post("/events", requireAuth, createCalendarEvent);
router.get("/events/:id", requireAuth, getCalendarEventById);
router.patch("/events/:id", requireAuth, updateCalendarEvent);
router.delete("/events/:id", requireAuth, deleteCalendarEvent);

export default router;
