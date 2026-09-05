/**
 * Interface for guarding against duplicate/replayed protocol envelopes.
 */
export interface EnvelopeReplayGuard {
  /**
   * Atomically checks if an envelope ID has already been recorded and,
   * if unseen/expired, records it and returns true (accepted).
   * If already seen and active, returns false (rejected as replay/duplicate).
   *
   * MUST be called only after authentication and timestamp validation succeed.
   */
  checkAndRecord(
    envelopeId: string,
    timestamp: number,
  ): Promise<boolean> | boolean;

  /**
   * Optional manual prune of expired entries.
   */
  prune?(): Promise<void> | void;
}

export interface InMemoryEnvelopeReplayGuardOptions {
  /**
   * Maximum entries to retain in memory before forced eviction.
   * Defaults to 10,000.
   */
  maxEntries?: number;

  /**
   * Time-to-live for recorded envelope IDs in milliseconds.
   * Defaults to 120,000 ms (2 minutes, matching 2x the +/- 60s window).
   */
  ttlMs?: number;

  /**
   * Injectable clock function for deterministic testing.
   */
  clock?: () => number;
}

/**
 * Bounded, in-memory implementation of EnvelopeReplayGuard.
 * Atomically checks and records nonces to prevent race conditions in duplicate submissions.
 * Automatically evicts expired nonces and bounds memory growth.
 */
export class InMemoryEnvelopeReplayGuard implements EnvelopeReplayGuard {
  private readonly entries = new Map<string, number>(); // envelopeId -> expiresAtMs
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly clock: () => number;

  constructor(options: InMemoryEnvelopeReplayGuardOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
    this.ttlMs = options.ttlMs ?? 120_000;
    this.clock = options.clock ?? (() => Date.now());
  }

  /**
   * Atomically checks whether the envelope ID is currently active.
   * If active, returns false (duplicate).
   * If unseen or expired, records it with expiration and returns true (accepted).
   */
  checkAndRecord(envelopeId: string, _timestamp: number): boolean {
    const now = this.clock();
    const expiresAt = this.entries.get(envelopeId);

    if (expiresAt !== undefined && expiresAt > now) {
      return false;
    }

    if (this.entries.size >= this.maxEntries) {
      this.prune();
    }

    // If still at capacity after pruning expired items, evict the oldest entry
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(envelopeId, now + this.ttlMs);
    return true;
  }

  /**
   * Checks whether the envelope ID is currently seen and unexpired.
   */
  hasBeenSeen(envelopeId: string): boolean {
    const expiresAt = this.entries.get(envelopeId);
    if (expiresAt === undefined) {
      return false;
    }

    const now = this.clock();
    if (expiresAt <= now) {
      this.entries.delete(envelopeId);
      return false;
    }

    return true;
  }

  prune(): void {
    const now = this.clock();
    for (const [id, expiresAt] of this.entries.entries()) {
      if (expiresAt <= now) {
        this.entries.delete(id);
      }
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
