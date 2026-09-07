import { Router } from "express";
import {
  createVoiceSession,
  getVoiceSession,
  interruptVoiceSession,
  endVoiceSession,
  processVoiceTurn,
  streamVoiceTurn,
  VoiceController,
} from "../controllers/voice/voice.controller";
import { VoiceService } from "../services/voice";
import { requireAuth } from "../middleware/auth.middleware";

export function createVoiceRouter(
  voiceService?: VoiceService,
  authMiddleware = requireAuth,
): Router {
  const controller = voiceService
    ? new VoiceController(voiceService)
    : undefined;

  const router = Router();

  router.post(
    "/sessions",
    authMiddleware,
    controller ? controller.createSession : createVoiceSession,
  );
  router.get(
    "/sessions/:id",
    authMiddleware,
    controller ? controller.getSession : getVoiceSession,
  );
  router.post(
    "/sessions/:id/interrupt",
    authMiddleware,
    controller ? controller.interruptSession : interruptVoiceSession,
  );
  router.post(
    "/sessions/:id/end",
    authMiddleware,
    controller ? controller.endSession : endVoiceSession,
  );
  router.post(
    "/turn",
    authMiddleware,
    controller ? controller.processTurn : processVoiceTurn,
  );
  router.post(
    "/turn/stream",
    authMiddleware,
    controller ? controller.streamTurn : streamVoiceTurn,
  );

  return router;
}

const defaultVoiceRouter = createVoiceRouter();
export default defaultVoiceRouter;
