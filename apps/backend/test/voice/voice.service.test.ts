import { describe, expect, it, vi } from "vitest";
import { AssistantRuntime } from "../../src/services/assistant/assistant.runtime";
import { AssistantService } from "../../src/services/assistant/assistant.service";
import { AssistantResponse } from "../../src/services/assistant/assistant.types";
import {
  MockSTTProvider,
  MockTTSProvider,
  MockVADProvider,
  VoiceService,
  VoiceTurnInput,
} from "../../src/services/voice";

describe("VoiceService", () => {
  function createAssistantServiceMock(defaultText = "I am BrainOS.") {
    const defaultResponse: AssistantResponse = {
      text: defaultText,
      model: "omniroute/gpt-4o",
      provider: "omniroute",
      retrievedMemories: [],
      retrievedDocuments: [],
    };

    return {
      ask: vi.fn().mockResolvedValue(defaultResponse),
    } as unknown as AssistantService;
  }

  describe("Session Lifecycle", () => {
    it("creates, retrieves, and ends a voice session for an authenticated user", () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      const session = voiceService.createSession("user-123", "conv-abc");
      expect(session.id).toBeDefined();
      expect(session.userId).toBe("user-123");
      expect(session.conversationId).toBe("conv-abc");
      expect(session.status).toBe("IDLE");

      const retrieved = voiceService.getSession(session.id, "user-123");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);

      const ended = voiceService.endSession(session.id, "user-123");
      expect(ended).toBe(true);

      const updated = voiceService.getSession(session.id, "user-123");
      expect(updated?.status).toBe("CLOSED");
    });

    it("fails closed when creating a session with missing or whitespace userId", () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      expect(() => voiceService.createSession("")).toThrow(
        "Authenticated user ID is required to create a voice session.",
      );
      expect(() => voiceService.createSession("   ")).toThrow(
        "Authenticated user ID is required to create a voice session.",
      );
    });

    it("prevents unauthorized users from reading or ending another user's session", () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      const session = voiceService.createSession("user-owner");

      const unauthorizedGet = voiceService.getSession(session.id, "user-attacker");
      expect(unauthorizedGet).toBeUndefined();

      const unauthorizedEnd = voiceService.endSession(session.id, "user-attacker");
      expect(unauthorizedEnd).toBe(false);
    });

    it("supports the interruption contract for active sessions", () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      const session = voiceService.createSession("user-123");
      voiceService.interruptSession(session.id, "user-123");

      const updated = voiceService.getSession(session.id, "user-123");
      expect(updated?.status).toBe("INTERRUPTED");
    });

    it("throws when interrupting a non-existent or unauthorized session", () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      expect(() => voiceService.interruptSession("invalid-id", "user-123")).toThrow(
        "Voice session not found or unauthorized.",
      );
    });
  });

  describe("Finalized Transcript Handling & Assistant Delegation", () => {
    it("processes a finalized transcript directly through AssistantService", async () => {
      const assistantService = createAssistantServiceMock("Here are your reminders.");
      const voiceService = new VoiceService(assistantService);
      const runtime = new AssistantRuntime();
      const stateHistory: string[] = [];

      runtime.subscribe((event) => {
        if (event.type === "STATE_CHANGED") {
          stateHistory.push(event.snapshot.state);
        }
      });

      const input: VoiceTurnInput = {
        userId: "user-123",
        transcript: "Show me my reminders",
        conversationId: "conv-101",
        enableMemoryRetrieval: true,
        enableDocumentRetrieval: false,
        authorizedComputerActions: ["computer.read"],
        runtime,
      };

      const result = await voiceService.processTurn(input);

      expect(result.transcript).toBe("Show me my reminders");
      expect(result.assistantResponse.text).toBe("Here are your reminders.");
      expect(result.conversationId).toBe("conv-101");
      expect(result.status).toBe("IDLE");

      expect(assistantService.ask).toHaveBeenCalledTimes(1);
      expect(assistantService.ask).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          message: "Show me my reminders",
          conversationId: "conv-101",
          enableMemoryRetrieval: true,
          enableDocumentRetrieval: false,
          authorizedComputerActions: ["computer.read"],
          runtime,
        }),
      );

      // Verify runtime state transitions: LISTENING -> THINKING -> IDLE
      expect(stateHistory).toContain("LISTENING");
      expect(stateHistory).toContain("THINKING");
      expect(stateHistory[stateHistory.length - 1]).toBe("IDLE");
    });

    it("preserves session ID across multiple turns", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      const session = voiceService.createSession("user-123", "conv-existing");

      const turn1 = await voiceService.processTurn({
        userId: "user-123",
        sessionId: session.id,
        transcript: "First turn",
      });

      expect(turn1.sessionId).toBe(session.id);
      expect(turn1.conversationId).toBe("conv-existing");

      const turn2 = await voiceService.processTurn({
        userId: "user-123",
        sessionId: session.id,
        transcript: "Second turn",
      });

      expect(turn2.sessionId).toBe(session.id);
      expect(turn2.conversationId).toBe("conv-existing");
    });
  });

  describe("STT Audio Chunk Transcription", () => {
    it("transcribes audio chunks via STTProvider before delegating to AssistantService", async () => {
      const assistantService = createAssistantServiceMock("Command executed.");
      const mockStt = new MockSTTProvider();
      mockStt.customTranscript = "Turn off the lights";

      const voiceService = new VoiceService(assistantService, mockStt);

      const audioBuffer = Buffer.from([0, 1, 2, 3, 4]);
      const result = await voiceService.processTurn({
        userId: "user-123",
        audio: {
          data: audioBuffer,
          mimeType: "audio/webm",
          sampleRate: 16000,
        },
        sttOptions: {
          language: "en",
        },
      });

      expect(mockStt.recordedCalls).toHaveLength(1);
      expect(mockStt.recordedCalls[0].audio.mimeType).toBe("audio/webm");
      expect(mockStt.recordedCalls[0].options?.language).toBe("en");

      expect(result.transcript).toBe("Turn off the lights");
      expect(assistantService.ask).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-123",
          message: "Turn off the lights",
        }),
      );
    });

    it("fails closed if audio is provided without an STT provider configured", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      await expect(
        voiceService.processTurn({
          userId: "user-123",
          audio: { data: Buffer.from([1, 2, 3]) },
        }),
      ).rejects.toThrow(
        "STT Provider is not configured for voice audio transcription.",
      );
    });

    it("fails closed if neither transcript nor audio is provided", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      await expect(
        voiceService.processTurn({
          userId: "user-123",
        }),
      ).rejects.toThrow(
        "Either a finalized transcript or audio data must be provided.",
      );
    });

    it("fails closed if transcribed audio produces an empty transcript", async () => {
      const assistantService = createAssistantServiceMock();
      const mockStt = new MockSTTProvider();
      mockStt.customTranscript = "   ";

      const voiceService = new VoiceService(assistantService, mockStt);

      await expect(
        voiceService.processTurn({
          userId: "user-123",
          audio: { data: Buffer.from([1, 2, 3]) },
        }),
      ).rejects.toThrow(
        "Voice transcript is empty or could not be recognized.",
      );
    });
  });

  describe("TTS Speech Synthesis Delegation", () => {
    it("synthesizes speech via TTSProvider when synthesizeSpeech is true", async () => {
      const assistantService = createAssistantServiceMock("Good morning, Tayab.");
      const mockTts = new MockTTSProvider();
      const voiceService = new VoiceService(
        assistantService,
        undefined,
        mockTts,
      );

      const runtime = new AssistantRuntime();
      const stateHistory: string[] = [];
      runtime.subscribe((event) => {
        if (event.type === "STATE_CHANGED") {
          stateHistory.push(event.snapshot.state);
        }
      });

      const result = await voiceService.processTurn({
        userId: "user-123",
        transcript: "Good morning",
        synthesizeSpeech: true,
        ttsOptions: {
          voiceId: "alloy",
          format: "audio/mp3",
        },
        runtime,
      });

      expect(mockTts.recordedCalls).toHaveLength(1);
      expect(mockTts.recordedCalls[0].text).toBe("Good morning, Tayab.");
      expect(mockTts.recordedCalls[0].options?.voiceId).toBe("alloy");

      expect(result.audioResponse).toBeDefined();
      expect(result.audioResponse?.mimeType).toBe("audio/mp3");
      expect(result.audioResponse?.characterCount).toBe("Good morning, Tayab.".length);

      expect(stateHistory).toContain("SPEAKING");
    });

    it("skips TTS synthesis when synthesizeSpeech is false or undefined", async () => {
      const assistantService = createAssistantServiceMock("Response text");
      const mockTts = new MockTTSProvider();
      const voiceService = new VoiceService(
        assistantService,
        undefined,
        mockTts,
      );

      const result = await voiceService.processTurn({
        userId: "user-123",
        transcript: "Hello",
      });

      expect(mockTts.recordedCalls).toHaveLength(0);
      expect(result.audioResponse).toBeUndefined();
    });
  });

  describe("VAD Provider Frame Verification", () => {
    it("evaluates audio frames using VADProvider contract", async () => {
      const mockVad = new MockVADProvider();

      const frame1 = { audio: Buffer.from([1, 2, 3]), timestampMs: 0 };
      const res1 = await mockVad.processFrame(frame1);
      expect(res1.isSpeech).toBe(true);
      expect(res1.speechStart).toBe(true);
      expect(res1.probability).toBe(0.95);

      const frame2 = { audio: Buffer.from([4, 5, 6]), timestampMs: 20 };
      const res2 = await mockVad.processFrame(frame2);
      expect(res2.speechStart).toBe(false);

      mockVad.reset();
      expect(mockVad.recordedFrames).toHaveLength(0);
    });
  });

  describe("Cancellation with AbortSignal", () => {
    it("aborts immediately if signal is already aborted before turn processing", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      const controller = new AbortController();
      controller.abort();

      await expect(
        voiceService.processTurn({
          userId: "user-123",
          transcript: "Cancel me",
          signal: controller.signal,
        }),
      ).rejects.toThrow("Voice processing was aborted.");

      expect(assistantService.ask).not.toHaveBeenCalled();
    });

    it("propagates AbortSignal to STT transcription", async () => {
      const assistantService = createAssistantServiceMock();
      const mockStt = new MockSTTProvider();
      mockStt.delayMs = 100;

      const voiceService = new VoiceService(assistantService, mockStt);
      const controller = new AbortController();

      const promise = voiceService.processTurn({
        userId: "user-123",
        audio: { data: Buffer.from([1, 2, 3]) },
        signal: controller.signal,
      });

      setTimeout(() => controller.abort(), 20);

      await expect(promise).rejects.toThrow();
    });

    it("propagates AbortSignal to AssistantService and handles mid-flight interruption", async () => {
      const controller = new AbortController();

      const assistantService = {
        ask: vi.fn().mockImplementation(async ({ signal }) => {
          if (signal?.aborted) {
            throw new DOMException("The operation was aborted.", "AbortError");
          }
          controller.abort();
          return {
            text: "Interrupted",
            model: "model",
            provider: "omniroute",
            retrievedMemories: [],
            retrievedDocuments: [],
          };
        }),
      } as unknown as AssistantService;

      const voiceService = new VoiceService(assistantService);
      const session = voiceService.createSession("user-123");

      await expect(
        voiceService.processTurn({
          userId: "user-123",
          sessionId: session.id,
          transcript: "Interrupted message",
          signal: controller.signal,
        }),
      ).rejects.toThrow("Voice processing was aborted.");

      const updatedSession = voiceService.getSession(session.id, "user-123");
      expect(updatedSession?.status).toBe("INTERRUPTED");
    });
  });

  describe("Security & Ownership", () => {
    it("fails closed when userId is missing or empty in processTurn", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      await expect(
        voiceService.processTurn({
          userId: "",
          transcript: "Hello",
        }),
      ).rejects.toThrow(
        "Authenticated user ID is required for voice processing.",
      );

      await expect(
        voiceService.processTurn({
          userId: "   ",
          transcript: "Hello",
        }),
      ).rejects.toThrow(
        "Authenticated user ID is required for voice processing.",
      );
    });

    it("enforces strict session ownership and rejects cross-tenant session hijacking", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      const victimSession = voiceService.createSession("victim-user-123");

      await expect(
        voiceService.processTurn({
          userId: "attacker-user-456",
          sessionId: victimSession.id,
          transcript: "Attempt hijack",
        }),
      ).rejects.toThrow("Unauthorized voice session access.");

      expect(assistantService.ask).not.toHaveBeenCalled();
    });

    it("fails closed when an unknown sessionId is provided", async () => {
      const assistantService = createAssistantServiceMock();
      const voiceService = new VoiceService(assistantService);

      await expect(
        voiceService.processTurn({
          userId: "user-123",
          sessionId: "non-existent-session-id",
          transcript: "Hello",
        }),
      ).rejects.toThrow("Voice session not found.");
    });
  });
});
