/**
 * ============================================================================
 * BrainOS Frontend Voice Audio Utilities (Mission 69)
 * Browser audio capture via MediaRecorder and playback via HTMLAudioElement.
 * Zero external npm dependencies.
 * ============================================================================
 */

export interface RecordedAudioResult {
  base64Data: string;
  mimeType: string;
  durationMs: number;
}

export interface VoiceRecorderController {
  stop: () => Promise<RecordedAudioResult>;
  cancel: () => void;
}

export interface AudioPlaybackController {
  stop: () => void;
  promise: Promise<void>;
}

/**
 * Checks if browser audio recording is supported.
 */
export function isAudioRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window.MediaRecorder !== "undefined"
  );
}

/**
 * Converts a Blob to a base64-encoded string (without the data URL prefix).
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === "function") {
    const buffer = await blob.arrayBuffer();
    if (typeof Buffer !== "undefined") {
      return Buffer.from(buffer).toString("base64");
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const base64 = reader.result.split(",")[1] ?? "";
          resolve(base64);
        } else {
          reject(new Error("Failed to encode audio blob as base64."));
        }
      };
      reader.onerror = () => {
        reject(reader.error || new Error("Failed to read audio blob."));
      };
      reader.readAsDataURL(blob);
    });
  }

  throw new Error("Unable to convert blob to base64 in this environment.");
}

/**
 * Starts recording audio from the user's microphone.
 * Returns a controller with `stop()` and `cancel()` methods.
 */
export async function startVoiceRecording(options?: {
  maxDurationMs?: number;
}): Promise<VoiceRecorderController> {
  if (!isAudioRecordingSupported()) {
    throw new Error("Microphone recording is not supported in this browser.");
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (err: any) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      throw new Error("Microphone permission was denied.");
    }
    throw new Error(`Failed to access microphone: ${err.message || "Unknown error"}`);
  }

  const startTime = Date.now();
  const chunks: Blob[] = [];

  // Determine supported mimeType
  let mimeType = "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    mimeType = "audio/webm;codecs=opus";
  } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
    mimeType = "audio/ogg;codecs=opus";
  } else if (MediaRecorder.isTypeSupported("audio/wav")) {
    mimeType = "audio/wav";
  } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
    mimeType = "audio/mp4";
  }

  const mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const cleanupStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      stream = null;
    }
  };

  let maxTimer: NodeJS.Timeout | null = null;
  if (options?.maxDurationMs && options.maxDurationMs > 0) {
    maxTimer = setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    }, options.maxDurationMs);
  }

  mediaRecorder.start(100); // collect in 100ms slices

  let isStopped = false;
  let isCancelled = false;

  const cancel = () => {
    if (isStopped || isCancelled) return;
    isCancelled = true;
    if (maxTimer) clearTimeout(maxTimer);
    try {
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    } catch {
      // Ignore recorder stop errors
    }
    cleanupStream();
  };

  const stop = async (): Promise<RecordedAudioResult> => {
    if (isCancelled) {
      throw new Error("Voice recording was cancelled.");
    }

    if (maxTimer) clearTimeout(maxTimer);

    return new Promise<RecordedAudioResult>((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        cleanupStream();

        if (isCancelled) {
          reject(new Error("Voice recording was cancelled."));
          return;
        }

        const durationMs = Date.now() - startTime;
        const audioBlob = new Blob(chunks, { type: mimeType });

        if (audioBlob.size === 0) {
          reject(new Error("Recorded audio is empty."));
          return;
        }

        try {
          const base64Data = await blobToBase64(audioBlob);
          resolve({
            base64Data,
            mimeType,
            durationMs,
          });
        } catch (err) {
          reject(err);
        }
      };

      try {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      } catch (err) {
        cleanupStream();
        reject(err);
      }
      isStopped = true;
    });
  };

  return {
    stop,
    cancel,
  };
}

/**
 * Plays base64 audio data in the browser using HTMLAudioElement.
 * Returns an AudioPlaybackController allowing safe cancellation and completion tracking.
 */
export function playAudioBase64(
  base64Data: string,
  mimeType: string = "audio/wav",
): AudioPlaybackController {
  if (typeof window === "undefined") {
    return {
      stop: () => {},
      promise: Promise.resolve(),
    };
  }

  const audioSrc = `data:${mimeType};base64,${base64Data}`;
  const audio = new Audio(audioSrc);

  let isCancelled = false;

  const promise = new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      resolve();
    };

    audio.onerror = (err) => {
      if (isCancelled) {
        resolve();
      } else {
        reject(new Error("Audio playback failed in browser."));
      }
    };

    audio.play().catch((err) => {
      if (isCancelled || err.name === "AbortError") {
        resolve();
      } else {
        reject(new Error(`Failed to start audio playback: ${err.message || "Unknown error"}`));
      }
    });
  });

  const stop = () => {
    isCancelled = true;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Ignore pause errors
    }
  };

  return {
    stop,
    promise,
  };
}
