import { AssistantResponse } from "../assistant/assistant.types";
import { AssistantRuntime } from "../assistant/assistant.runtime";

/**
 * ============================================================================
 * BrainOS Voice Domain & Session Types
 * ============================================================================
 */

export type VoiceSessionStatus =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "INTERRUPTED"
  | "ERROR"
  | "CLOSED";

export interface AudioChunk {
  data: Buffer | Uint8Array;
  mimeType?: string;
  sampleRate?: number;
  channels?: number;
  isFinal?: boolean;
}

export interface STTOptions {
  language?: string;
  prompt?: string;
  temperature?: number;
  signal?: AbortSignal;
}

export interface STTResult {
  transcript: string;
  confidence?: number;
  isFinal: boolean;
  language?: string;
  durationMs?: number;
}

export interface TTSOptions {
  voiceId?: string;
  speed?: number;
  pitch?: number;
  format?: "audio/wav" | "audio/mp3" | "audio/pcm" | string;
  signal?: AbortSignal;
}

export interface TTSResult {
  audio: Buffer | Uint8Array;
  mimeType: string;
  durationMs?: number;
  characterCount?: number;
}

export interface VADFrame {
  audio: Buffer | Uint8Array;
  timestampMs?: number;
}

export interface VADResult {
  isSpeech: boolean;
  probability: number;
  speechStart?: boolean;
  speechEnd?: boolean;
}

export interface VoiceSession {
  id: string;
  userId: string;
  conversationId?: string;
  status: VoiceSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceTurnInput {
  userId: string;
  sessionId?: string;
  conversationId?: string;
  transcript?: string;
  audio?: AudioChunk;
  synthesizeSpeech?: boolean;
  ttsOptions?: TTSOptions;
  sttOptions?: STTOptions;
  enableMemoryRetrieval?: boolean;
  enableDocumentRetrieval?: boolean;
  authorizedComputerActions?: string[];
  signal?: AbortSignal;
  runtime?: AssistantRuntime;
}

export interface VoiceTurnResult {
  sessionId: string;
  conversationId?: string;
  transcript: string;
  assistantResponse: AssistantResponse;
  audioResponse?: TTSResult;
  status: VoiceSessionStatus;
}
