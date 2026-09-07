import { AssistantService } from "../assistant/assistant.service";
import { AssistantRuntime } from "../assistant/assistant.runtime";
import { STTProvider } from "./providers/stt.provider";
import { TTSProvider } from "./providers/tts.provider";
import { VADProvider } from "./providers/vad.provider";
import {
  TTSResult,
  VoiceSession,
  VoiceSessionStatus,
  VoiceTurnInput,
  VoiceTurnResult,
} from "./voice.types";
import { randomUUID } from "crypto";

export class VoiceService {
  private readonly sessions = new Map<string, VoiceSession>();

  constructor(
    private readonly assistantService: AssistantService,
    private readonly sttProvider?: STTProvider,
    private readonly ttsProvider?: TTSProvider,
    private readonly vadProvider?: VADProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  createSession(userId: string, conversationId?: string): VoiceSession {
    if (!userId || userId.trim().length === 0) {
      throw new Error("Authenticated user ID is required to create a voice session.");
    }

    const trimmedUserId = userId.trim();
    const now = this.clock();
    const session: VoiceSession = {
      id: randomUUID(),
      userId: trimmedUserId,
      conversationId: conversationId?.trim() || undefined,
      status: "IDLE",
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string, userId: string): VoiceSession | undefined {
    if (!sessionId || !userId) {
      return undefined;
    }

    const session = this.sessions.get(sessionId.trim());
    if (!session || session.userId !== userId.trim()) {
      return undefined;
    }

    return session;
  }

  endSession(sessionId: string, userId: string): boolean {
    if (!sessionId || !userId) {
      return false;
    }

    const session = this.getSession(sessionId, userId);
    if (!session) {
      return false;
    }

    session.status = "CLOSED";
    session.updatedAt = this.clock();
    return true;
  }

  interruptSession(sessionId: string, userId: string): void {
    if (!sessionId || !userId) {
      return;
    }

    const session = this.getSession(sessionId, userId);
    if (!session) {
      throw new Error("Voice session not found or unauthorized.");
    }

    session.status = "INTERRUPTED";
    session.updatedAt = this.clock();
  }

  async processTurn(input: VoiceTurnInput): Promise<VoiceTurnResult> {
    if (!input.userId || input.userId.trim().length === 0) {
      throw new Error("Authenticated user ID is required for voice processing.");
    }

    const userId = input.userId.trim();

    if (input.signal?.aborted) {
      throw new DOMException("Voice processing was aborted.", "AbortError");
    }

    let session: VoiceSession | undefined;
    if (input.sessionId) {
      session = this.sessions.get(input.sessionId.trim());
      if (!session) {
        throw new Error("Voice session not found.");
      }
      if (session.userId !== userId) {
        throw new Error("Unauthorized voice session access.");
      }
    } else {
      session = this.createSession(userId, input.conversationId);
    }

    session.status = "LISTENING";
    session.updatedAt = this.clock();

    const runtime = input.runtime;
    if (runtime) {
      runtime.setState("LISTENING");
    }

    // 1. Resolve finalized transcript (either provided directly or via STT)
    let transcript = input.transcript?.trim();

    if (!transcript) {
      if (!input.audio) {
        session.status = "ERROR";
        session.updatedAt = this.clock();
        throw new Error("Either a finalized transcript or audio data must be provided.");
      }

      if (!this.sttProvider) {
        session.status = "ERROR";
        session.updatedAt = this.clock();
        throw new Error("STT Provider is not configured for voice audio transcription.");
      }

      if (input.signal?.aborted) {
        session.status = "INTERRUPTED";
        session.updatedAt = this.clock();
        throw new DOMException("Voice processing was aborted.", "AbortError");
      }

      const sttResult = await this.sttProvider.transcribe(input.audio, {
        ...input.sttOptions,
        signal: input.signal,
      });

      transcript = sttResult.transcript?.trim();
    }

    if (!transcript || transcript.length === 0) {
      session.status = "ERROR";
      session.updatedAt = this.clock();
      throw new Error("Voice transcript is empty or could not be recognized.");
    }

    if (input.signal?.aborted) {
      session.status = "INTERRUPTED";
      session.updatedAt = this.clock();
      throw new DOMException("Voice processing was aborted.", "AbortError");
    }

    // 2. Delegate to AssistantService (preserving existing BrainOS brain, tools, memory, context)
    session.status = "PROCESSING";
    session.updatedAt = this.clock();

    if (runtime) {
      runtime.setState("THINKING");
    }

    const conversationId = input.conversationId || session.conversationId;

    const assistantResponse = await this.assistantService.ask({
      userId,
      message: transcript,
      conversationId,
      enableMemoryRetrieval: input.enableMemoryRetrieval,
      enableDocumentRetrieval: input.enableDocumentRetrieval,
      authorizedComputerActions: input.authorizedComputerActions,
      runtime,
      signal: input.signal,
    });

    if (input.signal?.aborted) {
      session.status = "INTERRUPTED";
      session.updatedAt = this.clock();
      throw new DOMException("Voice processing was aborted.", "AbortError");
    }

    // 3. Optional TTS synthesis
    let audioResponse: TTSResult | undefined;
    if (input.synthesizeSpeech && this.ttsProvider && assistantResponse.text) {
      session.status = "SPEAKING";
      session.updatedAt = this.clock();

      if (runtime) {
        runtime.setState("SPEAKING");
      }

      audioResponse = await this.ttsProvider.synthesize(assistantResponse.text, {
        ...input.ttsOptions,
        signal: input.signal,
      });
    }

    session.status = "IDLE";
    session.updatedAt = this.clock();

    if (runtime) {
      runtime.setState("IDLE");
    }

    return {
      sessionId: session.id,
      conversationId,
      transcript,
      assistantResponse,
      audioResponse,
      status: session.status,
    };
  }
}
