import express, { RequestHandler, Router } from "express";
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

export const DEFAULT_VOICE_TURN_JSON_LIMIT = "10mb";
export const DEFAULT_VOICE_STANDARD_JSON_LIMIT = "100kb";

export interface VoiceRouterOptions {
  turnLimit?: string;
  standardLimit?: string;
}

export function createVoiceRouter(
  voiceService?: VoiceService,
  authMiddleware: RequestHandler = requireAuth,
  options?: VoiceRouterOptions,
): Router {
  const controller = voiceService
    ? new VoiceController(voiceService)
    : undefined;

  const standardJsonParser = express.json({
    limit: options?.standardLimit ?? DEFAULT_VOICE_STANDARD_JSON_LIMIT,
  });
  const turnJsonParser = express.json({
    limit: options?.turnLimit ?? DEFAULT_VOICE_TURN_JSON_LIMIT,
  });

  const router = Router();

  router.post(
    "/sessions",
    authMiddleware,
    standardJsonParser,
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
    standardJsonParser,
    controller ? controller.interruptSession : interruptVoiceSession,
  );
  router.post(
    "/sessions/:id/end",
    authMiddleware,
    standardJsonParser,
    controller ? controller.endSession : endVoiceSession,
  );
  router.post(
    "/turn",
    authMiddleware,
    turnJsonParser,
    controller ? controller.processTurn : processVoiceTurn,
  );
  router.post(
    "/turn/stream",
    authMiddleware,
    turnJsonParser,
    controller ? controller.streamTurn : streamVoiceTurn,
  );

  return router;
}

const defaultVoiceRouter = createVoiceRouter();
export default defaultVoiceRouter;

