import { Router } from "express";
import { DevController } from "../controllers/dev.controller";

const router = Router();
const controller = new DevController();

router.get(
  "/test-embedding",
  controller.testEmbedding.bind(controller)
);

export default router;