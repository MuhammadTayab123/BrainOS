import { Router } from "express";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEventById,
  listCalendarEvents,
  updateCalendarEvent,
} from "../controllers/calendar/calendar.controller";
import {
  deleteCalendarConnection,
  getCalendarConnectionById,
  listCalendarConnections,
  listCalendarProviders,
  updateCalendarConnection,
} from "../controllers/calendar/calendar-connection.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Native Calendar Event endpoints
router.get("/events", requireAuth, listCalendarEvents);
router.post("/events", requireAuth, createCalendarEvent);
router.get("/events/:id", requireAuth, getCalendarEventById);
router.patch("/events/:id", requireAuth, updateCalendarEvent);
router.delete("/events/:id", requireAuth, deleteCalendarEvent);

// Calendar Connection Lifecycle endpoints
router.get("/connections", requireAuth, listCalendarConnections);
router.get("/connections/:id", requireAuth, getCalendarConnectionById);
router.patch("/connections/:id", requireAuth, updateCalendarConnection);
router.delete("/connections/:id", requireAuth, deleteCalendarConnection);

// Calendar Provider Discovery
router.get("/providers", requireAuth, listCalendarProviders);

export default router;
