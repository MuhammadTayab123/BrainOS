import { Router } from "express";
import { DevController } from "../controllers/dev.controller";

const router = Router();

const controller = new DevController();

router.get(
  "/test-embedding",
  controller.testEmbedding.bind(controller),
);

router.post(
  "/test-memory",
  controller.testMemory.bind(controller),
);

router.post(
  "/test-memory-search",
  controller.testMemorySearch.bind(controller),
);

export default router;