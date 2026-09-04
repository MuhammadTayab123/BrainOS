import crypto from "node:crypto";

import { logger } from "../../../logger";
import {
  ComputerAgentAuthResult,
  ComputerAgentCredentialStore,
  StoredAgentCredential,
} from "./computer-agent-auth.types";

const CREDENTIAL_KEY_BYTES = 64;
const DEFAULT_SALT_BYTES = 16;
const DEFAULT_CREDENTIAL_BYTES = 32;

/**
 * Generates a cryptographically random, unpredictable credential string.
 * Uses Node's built-in crypto module.
 */
export function generateAgentCredential(
  bytes = DEFAULT_CREDENTIAL_BYTES,
): string {
  if (typeof bytes !== "number" || bytes < 16) {
    throw new Error("Credential byte length must be at least 16.");
  }

  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Computes a secure one-way hash representation of a credential using scrypt and a random salt.
 * Never returns or persists the raw credential.
 */
export function hashCredential(
  credential: string,
  salt = crypto.randomBytes(DEFAULT_SALT_BYTES).toString("hex"),
): string {
  if (typeof credential !== "string" || credential.length === 0) {
    throw new Error("Credential must be a non-empty string.");
  }

  if (typeof salt !== "string" || salt.length === 0) {
    throw new Error("Salt must be a non-empty string.");
  }

  const derived = crypto.scryptSync(
    credential,
    salt,
    CREDENTIAL_KEY_BYTES,
  );

  return `${salt}:${derived.toString("hex")}`;
}

/**
 * Verifies a candidate credential against a stored secure hash using timing-safe comparison.
 * Fails closed on any empty, malformed, or mismatched values.
 */
export function verifyCredential(
  credential: unknown,
  storedHash: unknown,
): boolean {
  if (
    typeof credential !== "string" ||
    credential.length === 0 ||
    typeof storedHash !== "string" ||
    storedHash.length === 0
  ) {
    return false;
  }

  const parts = storedHash.split(":");

  if (parts.length !== 2) {
    return false;
  }

  const [salt, expectedHashHex] = parts;

  if (!salt || !expectedHashHex) {
    return false;
  }

  // Derived key length is 64 bytes -> 128 hex chars
  if (expectedHashHex.length !== CREDENTIAL_KEY_BYTES * 2) {
    return false;
  }

  try {
    const derived = crypto.scryptSync(
      credential,
      salt,
      CREDENTIAL_KEY_BYTES,
    );

    const expected = Buffer.from(expectedHashHex, "hex");

    if (derived.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * In-memory implementation of ComputerAgentCredentialStore.
 * Suitable for local, non-persistent, or test execution without external dependencies.
 */
export class InMemoryComputerAgentCredentialStore
  implements ComputerAgentCredentialStore
{
  private readonly records = new Map<string, StoredAgentCredential>();

  get(agentId: string): StoredAgentCredential | null {
    return this.records.get(agentId) ?? null;
  }

  save(record: StoredAgentCredential): void {
    this.records.set(record.agentId, record);
  }

  delete(agentId: string): boolean {
    return this.records.delete(agentId);
  }

  clear(): void {
    this.records.clear();
  }
}

/**
 * Transport-independent authentication service for Computer Agents.
 * Verifies credentials, manages credential registration, and fails closed.
 * Never logs or persists raw credentials.
 */
export class ComputerAgentAuthService {
  constructor(
    private readonly store: ComputerAgentCredentialStore = new InMemoryComputerAgentCredentialStore(),
    private readonly log = logger,
  ) {}

  /**
   * Registers a computer agent by generating an unpredictable credential,
   * storing only its secure hash representation, and returning the raw credential once.
   */
  registerAgent(agentId: string): {
    agentId: string;
    credential: string;
  } {
    if (typeof agentId !== "string" || agentId.trim().length === 0) {
      throw new Error("agentId is required.");
    }

    const cleanAgentId = agentId.trim();
    const credential = generateAgentCredential();
    const credentialHash = hashCredential(credential);

    this.store.save({
      agentId: cleanAgentId,
      credentialHash,
      createdAt: new Date(),
    });

    this.log.info("Registered computer agent credentials", {
      agentId: cleanAgentId,
    });

    return {
      agentId: cleanAgentId,
      credential,
    };
  }

  /**
   * Stores a pre-computed credential hash for an agent.
   */
  registerAgentHash(agentId: string, credentialHash: string): void {
    if (typeof agentId !== "string" || agentId.trim().length === 0) {
      throw new Error("agentId is required.");
    }

    if (
      typeof credentialHash !== "string" ||
      credentialHash.trim().length === 0
    ) {
      throw new Error("credentialHash is required.");
    }

    const cleanAgentId = agentId.trim();

    this.store.save({
      agentId: cleanAgentId,
      credentialHash: credentialHash.trim(),
      createdAt: new Date(),
    });

    this.log.info("Stored computer agent credential hash", {
      agentId: cleanAgentId,
    });
  }

  /**
   * Authenticates an agent credential against stored hashes in a timing-safe manner.
   * Fails closed on invalid inputs, missing agents, or invalid credentials.
   * Never logs raw credentials.
   */
  async authenticate(
    inputOrAgentId:
      | { agentId?: unknown; credential?: unknown }
      | unknown,
    maybeCredential?: unknown,
  ): Promise<ComputerAgentAuthResult> {
    let agentId: unknown;
    let credential: unknown;

    if (
      typeof inputOrAgentId === "object" &&
      inputOrAgentId !== null &&
      !Array.isArray(inputOrAgentId)
    ) {
      const obj = inputOrAgentId as Record<string, unknown>;
      agentId = obj.agentId;
      credential = obj.credential;
    } else {
      agentId = inputOrAgentId;
      credential = maybeCredential;
    }

    if (
      typeof agentId !== "string" ||
      agentId.trim().length === 0 ||
      typeof credential !== "string" ||
      credential.length === 0
    ) {
      this.log.warn(
        "Computer agent authentication failed: invalid credentials payload",
      );

      return {
        authenticated: false,
        reason: "Invalid or missing credentials",
      };
    }

    const cleanAgentId = agentId.trim();
    const stored = await this.store.get(cleanAgentId);

    if (!stored || !stored.credentialHash) {
      this.log.warn("Computer agent authentication failed: unknown agent", {
        agentId: cleanAgentId,
      });

      return {
        authenticated: false,
        reason: "Unknown agent ID",
      };
    }

    const isValid = verifyCredential(credential, stored.credentialHash);

    if (!isValid) {
      this.log.warn(
        "Computer agent authentication failed: invalid credential",
        {
          agentId: cleanAgentId,
        },
      );

      return {
        authenticated: false,
        reason: "Invalid credentials",
      };
    }

    this.log.info("Computer agent authenticated successfully", {
      agentId: cleanAgentId,
    });

    return {
      authenticated: true,
      agentId: cleanAgentId,
    };
  }
}
