import { Request, Response } from "express";
import {
  AudioChunk,
  STTOptions,
  TTSOptions,
  VoiceService,
  VoiceTurnInput,
  VoiceTurnResult,
} from "../../services/voice";
import {
  createSTTProvider,
  createTTSProvider,
  createVADProvider,
} from "../../services/voice/provider.factory";
import { assistantService } from "../assistant/assistant.controller";
import { AssistantRuntime } from "../../services/assistant/assistant.runtime";

interface ValidatedAudioPayload {
  data: Buffer;
  mimeType?: string;
  sampleRate?: number;
  channels?: number;
  isFinal?: boolean;
}

interface ValidatedVoiceTurnRequest {
  sessionId?: string;
  conversationId?: string;
  transcript?: string;
  audio?: ValidatedAudioPayload;
  synthesizeSpeech?: boolean;
  ttsOptions?: TTSOptions;
  sttOptions?: STTOptions;
  enableMemoryRetrieval?: boolean;
  enableDocumentRetrieval?: boolean;
  authorizedComputerActions?: string[];
}

type TurnValidationResult =
  | { success: true; data: ValidatedVoiceTurnRequest }
  | { success: false; status: number; code: string; message: string };

function validateVoiceTurnRequest(body: unknown): TurnValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      success: false,
      status: 400,
      code: "INVALID_BODY",
      message: "Request body must be a valid JSON object.",
    };
  }

  const raw = body as Record<string, unknown>;

  const {
    sessionId,
    conversationId,
    transcript,
    audio,
    synthesizeSpeech,
    ttsOptions,
    sttOptions,
    enableMemoryRetrieval,
    enableDocumentRetrieval,
    authorizedComputerActions,
  } = raw;

  // Session ID validation
  if (
    sessionId !== undefined &&
    (typeof sessionId !== "string" || sessionId.trim().length === 0)
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_SESSION_ID",
      message: "sessionId must be a non-empty string when provided.",
    };
  }

  // Conversation ID validation
  if (
    conversationId !== undefined &&
    (typeof conversationId !== "string" || conversationId.trim().length === 0)
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_CONVERSATION_ID",
      message: "conversationId must be a non-empty string when provided.",
    };
  }

  // Transcript validation
  let sanitizedTranscript: string | undefined;
  if (transcript !== undefined) {
    if (typeof transcript !== "string") {
      return {
        success: false,
        status: 400,
        code: "INVALID_TRANSCRIPT",
        message: "transcript must be a string when provided.",
      };
    }
    const trimmed = transcript.trim();
    if (trimmed.length > 0) {
      sanitizedTranscript = trimmed;
    }
  }

  // Audio payload validation
  let validatedAudio: ValidatedAudioPayload | undefined;
  if (audio !== undefined) {
    if (typeof audio !== "object" || audio === null || Array.isArray(audio)) {
      return {
        success: false,
        status: 400,
        code: "INVALID_AUDIO",
        message: "audio must be an object with base64 data.",
      };
    }

    const audioObj = audio as Record<string, unknown>;
    if (typeof audioObj.data !== "string" || audioObj.data.trim().length === 0) {
      return {
        success: false,
        status: 400,
        code: "INVALID_AUDIO_DATA",
        message: "audio.data must be a non-empty base64 string.",
      };
    }

    try {
      const buffer = Buffer.from(audioObj.data.trim(), "base64");
      if (buffer.length === 0) {
        return {
          success: false,
          status: 400,
          code: "INVALID_AUDIO_DATA",
          message: "audio.data could not be decoded as valid base64 data.",
        };
      }

      const mimeType =
        typeof audioObj.mimeType === "string" ? audioObj.mimeType.trim() : undefined;
      const sampleRate =
        typeof audioObj.sampleRate === "number" && Number.isFinite(audioObj.sampleRate) && audioObj.sampleRate > 0
          ? Math.floor(audioObj.sampleRate)
          : undefined;
      const channels =
        typeof audioObj.channels === "number" && Number.isFinite(audioObj.channels) && audioObj.channels > 0
          ? Math.floor(audioObj.channels)
          : undefined;
      const isFinal =
        typeof audioObj.isFinal === "boolean" ? audioObj.isFinal : undefined;

      validatedAudio = {
        data: buffer,
        mimeType,
        sampleRate,
        channels,
        isFinal,
      };
    } catch {
      return {
        success: false,
        status: 400,
        code: "INVALID_AUDIO_DATA",
        message: "audio.data could not be decoded as base64 data.",
      };
    }
  }

  // Either transcript or audio must be present
  if (!sanitizedTranscript && !validatedAudio) {
    return {
      success: false,
      status: 400,
      code: "INVALID_TURN_INPUT",
      message: "Either a non-empty transcript or audio payload is required.",
    };
  }

  if (
    synthesizeSpeech !== undefined &&
    typeof synthesizeSpeech !== "boolean"
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_SYNTHESIZE_SPEECH",
      message: "synthesizeSpeech must be a boolean when provided.",
    };
  }

  if (
    enableMemoryRetrieval !== undefined &&
    typeof enableMemoryRetrieval !== "boolean"
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_MEMORY_RETRIEVAL",
      message: "enableMemoryRetrieval must be a boolean when provided.",
    };
  }

  if (
    enableDocumentRetrieval !== undefined &&
    typeof enableDocumentRetrieval !== "boolean"
  ) {
    return {
      success: false,
      status: 400,
      code: "INVALID_DOCUMENT_RETRIEVAL",
      message: "enableDocumentRetrieval must be a boolean when provided.",
    };
  }

  let sanitizedActions: string[] | undefined;
  if (authorizedComputerActions !== undefined) {
    if (!Array.isArray(authorizedComputerActions)) {
      return {
        success: false,
        status: 400,
        code: "INVALID_AUTHORIZED_ACTIONS",
        message: "authorizedComputerActions must be an array of strings.",
      };
    }
    sanitizedActions = authorizedComputerActions
      .filter((act): act is string => typeof act === "string" && act.trim().length > 0)
      .map((act) => act.trim());
  }

  let sanitizedTtsOptions: TTSOptions | undefined;
  if (ttsOptions !== undefined) {
    if (typeof ttsOptions !== "object" || ttsOptions === null) {
      return {
        success: false,
        status: 400,
        code: "INVALID_TTS_OPTIONS",
        message: "ttsOptions must be an object when provided.",
      };
    }
    const rawTts = ttsOptions as Record<string, unknown>;
    sanitizedTtsOptions = {
      voiceId: typeof rawTts.voiceId === "string" ? rawTts.voiceId.trim() : undefined,
      speed: typeof rawTts.speed === "number" && Number.isFinite(rawTts.speed) && rawTts.speed > 0 ? rawTts.speed : undefined,
      pitch: typeof rawTts.pitch === "number" && Number.isFinite(rawTts.pitch) ? rawTts.pitch : undefined,
      format: typeof rawTts.format === "string" ? (rawTts.format.trim() as any) : undefined,
    };
  }

  let sanitizedSttOptions: STTOptions | undefined;
  if (sttOptions !== undefined) {
    if (typeof sttOptions !== "object" || sttOptions === null) {
      return {
        success: false,
        status: 400,
        code: "INVALID_STT_OPTIONS",
        message: "sttOptions must be an object when provided.",
      };
    }
    const rawStt = sttOptions as Record<string, unknown>;
    sanitizedSttOptions = {
      language: typeof rawStt.language === "string" ? rawStt.language.trim() : undefined,
      prompt: typeof rawStt.prompt === "string" ? rawStt.prompt.trim() : undefined,
      temperature: typeof rawStt.temperature === "number" && Number.isFinite(rawStt.temperature) ? rawStt.temperature : undefined,
    };
  }

  return {
    success: true,
    data: {
      sessionId: typeof sessionId === "string" ? sessionId.trim() : undefined,
      conversationId: typeof conversationId === "string" ? conversationId.trim() : undefined,
      transcript: sanitizedTranscript,
      audio: validatedAudio,
      synthesizeSpeech: synthesizeSpeech as boolean | undefined,
      ttsOptions: sanitizedTtsOptions,
      sttOptions: sanitizedSttOptions,
      enableMemoryRetrieval: enableMemoryRetrieval as boolean | undefined,
      enableDocumentRetrieval: enableDocumentRetrieval as boolean | undefined,
      authorizedComputerActions: sanitizedActions,
    },
  };
}

function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (
      msg.includes("DATABASE_URL") ||
      msg.includes("PrismaClient") ||
      msg.includes("password") ||
      msg.includes("secret") ||
      msg.includes("API_KEY")
    ) {
      return "An internal server error occurred.";
    }
    return msg;
  }
  return "Voice processing failed.";
}

function serializeTurnResult(result: VoiceTurnResult) {
  let serializedAudio:
    | {
        audioBase64: string;
        mimeType: string;
        durationMs?: number;
        characterCount?: number;
      }
    | undefined;

  if (result.audioResponse) {
    serializedAudio = {
      audioBase64: Buffer.from(result.audioResponse.audio).toString("base64"),
      mimeType: result.audioResponse.mimeType,
      durationMs: result.audioResponse.durationMs,
      characterCount: result.audioResponse.characterCount,
    };
  }

  return {
    sessionId: result.sessionId,
    conversationId: result.conversationId,
    transcript: result.transcript,
    assistantResponse: result.assistantResponse,
    audioResponse: serializedAudio,
    status: result.status,
  };
}

let defaultVoiceService: VoiceService | undefined;

export function getDefaultVoiceService(): VoiceService {
  if (!defaultVoiceService) {
    defaultVoiceService = new VoiceService(
      assistantService,
      createSTTProvider(),
      createTTSProvider(),
      createVADProvider(),
    );
  }
  return defaultVoiceService;
}

export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  createSession = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const { conversationId } = req.body ?? {};

    if (
      conversationId !== undefined &&
      (typeof conversationId !== "string" || conversationId.trim().length === 0)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_CONVERSATION_ID",
          message: "conversationId must be a non-empty string when provided.",
        },
      });
    }

    try {
      const session = this.voiceService.createSession(
        req.user.id,
        typeof conversationId === "string" ? conversationId.trim() : undefined,
      );

      return res.status(201).json({
        success: true,
        data: session,
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error);
      return res.status(500).json({
        success: false,
        error: {
          code: "SESSION_CREATION_FAILED",
          message,
        },
      });
    }
  };

  getSession = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const rawSessionId = req.params.id;
    if (typeof rawSessionId !== "string" || rawSessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_SESSION_ID",
          message: "Session ID parameter is required.",
        },
      });
    }

    const session = this.voiceService.getSession(rawSessionId.trim(), req.user.id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Voice session not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: session,
    });
  };

  interruptSession = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const rawSessionId = req.params.id;
    if (typeof rawSessionId !== "string" || rawSessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_SESSION_ID",
          message: "Session ID parameter is required.",
        },
      });
    }

    try {
      this.voiceService.interruptSession(rawSessionId.trim(), req.user.id);
      return res.status(200).json({
        success: true,
        data: { interrupted: true },
      });
    } catch {
      return res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Voice session not found or unauthorized.",
        },
      });
    }
  };

  endSession = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const rawSessionId = req.params.id;
    if (typeof rawSessionId !== "string" || rawSessionId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_SESSION_ID",
          message: "Session ID parameter is required.",
        },
      });
    }

    const ended = this.voiceService.endSession(rawSessionId.trim(), req.user.id);
    if (!ended) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Voice session not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { ended: true },
    });
  };

  processTurn = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const validation = validateVoiceTurnRequest(req.body);
    if (!validation.success) {
      return res.status(validation.status).json({
        success: false,
        error: {
          code: validation.code,
          message: validation.message,
        },
      });
    }

    const data = validation.data;
    const audioChunk: AudioChunk | undefined = data.audio
      ? {
          data: data.audio.data,
          mimeType: data.audio.mimeType,
          sampleRate: data.audio.sampleRate,
          channels: data.audio.channels,
          isFinal: data.audio.isFinal,
        }
      : undefined;

    const turnInput: VoiceTurnInput = {
      userId: req.user.id,
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      transcript: data.transcript,
      audio: audioChunk,
      synthesizeSpeech: data.synthesizeSpeech,
      ttsOptions: data.ttsOptions,
      sttOptions: data.sttOptions,
      enableMemoryRetrieval: data.enableMemoryRetrieval,
      enableDocumentRetrieval: data.enableDocumentRetrieval,
      authorizedComputerActions: data.authorizedComputerActions,
    };

    try {
      const result = await this.voiceService.processTurn(turnInput);
      return res.status(200).json({
        success: true,
        data: serializeTurnResult(result),
      });
    } catch (error: any) {
      const message = sanitizeErrorMessage(error);
      if (
        message.includes("not found") ||
        message.includes("Unauthorized")
      ) {
        return res.status(404).json({
          success: false,
          error: {
            code: "VOICE_TURN_FAILED",
            message,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: {
          code: "VOICE_TURN_FAILED",
          message,
        },
      });
    }
  };

  streamTurn = async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
    }

    const validation = validateVoiceTurnRequest(req.body);
    if (!validation.success) {
      return res.status(validation.status).json({
        success: false,
        error: {
          code: validation.code,
          message: validation.message,
        },
      });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const runtime = new AssistantRuntime();
    const abortController = new AbortController();
    let isClosed = false;

    const unsubscribe = runtime.subscribe((event) => {
      if (isClosed || res.writableEnded) {
        return;
      }

      if (event.type === "STATE_CHANGED") {
        res.write(formatSseEvent("state_changed", event.snapshot));
      } else if (event.type === "TASK_EVENT") {
        res.write(formatSseEvent("task_event", event.event));
      } else if (event.type === "TEXT_DELTA") {
        res.write(formatSseEvent("text_delta", { delta: event.delta }));
      }
    });

    const cleanup = () => {
      if (!isClosed) {
        isClosed = true;
        abortController.abort();
        unsubscribe();
      }
    };

    req.on?.("close", () => {
      if (!("complete" in req) || !req.complete) {
        cleanup();
      }
    });

    res.on?.("close", () => {
      if (!res.writableEnded) {
        cleanup();
      }
    });

    const data = validation.data;
    const audioChunk: AudioChunk | undefined = data.audio
      ? {
          data: data.audio.data,
          mimeType: data.audio.mimeType,
          sampleRate: data.audio.sampleRate,
          channels: data.audio.channels,
          isFinal: data.audio.isFinal,
        }
      : undefined;

    const turnInput: VoiceTurnInput = {
      userId: req.user.id,
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      transcript: data.transcript,
      audio: audioChunk,
      synthesizeSpeech: data.synthesizeSpeech,
      ttsOptions: data.ttsOptions,
      sttOptions: data.sttOptions,
      enableMemoryRetrieval: data.enableMemoryRetrieval,
      enableDocumentRetrieval: data.enableDocumentRetrieval,
      authorizedComputerActions: data.authorizedComputerActions,
      signal: abortController.signal,
      runtime,
    };

    try {
      const result = await this.voiceService.processTurn(turnInput);

      if (!isClosed && !res.writableEnded) {
        res.write(formatSseEvent("voice_result", serializeTurnResult(result)));
        res.write(formatSseEvent("done", {}));
        res.end();
      }
    } catch (error) {
      if (!isClosed && !res.writableEnded) {
        const sanitized = sanitizeErrorMessage(error);
        res.write(formatSseEvent("error", { message: sanitized }));
        res.write(formatSseEvent("done", {}));
        res.end();
      }
    } finally {
      cleanup();
    }
  };
}

// Module-level default controller functions
const defaultController = new VoiceController(getDefaultVoiceService());

export const createVoiceSession = defaultController.createSession;
export const getVoiceSession = defaultController.getSession;
export const interruptVoiceSession = defaultController.interruptSession;
export const endVoiceSession = defaultController.endSession;
export const processVoiceTurn = defaultController.processTurn;
export const streamVoiceTurn = defaultController.streamTurn;
