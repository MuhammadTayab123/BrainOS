import { Router } from "express";
import { getHealth } from "../controllers/health/health.controller";
import { validate } from "../middleware/validation.middleware";
import { healthSchema } from "../validators";

const router = Router();

router.get(
  "/health",
  validate(healthSchema),
  getHealth
);

export default router;