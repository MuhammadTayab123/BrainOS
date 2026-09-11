import crypto from "node:crypto";
import {
  CalendarConnectionCredentials,
  CredentialVaultError,
  EncryptedCredentialPayload,
} from "../calendar-connection.types";

/**
 * ============================================================================
 * BrainOS Credential Vault Contract & AES-256-GCM Implementation
 * ============================================================================
 *
 * Provides authenticated encryption at rest for external account credentials.
 * Invariants:
 * - Uses AES-256-GCM with unique 96-bit (12-byte) IV per encryption.
 * - Authenticated with 128-bit (16-byte) auth tag.
 * - Never logs keys, tokens, or plaintext.
 * - Fails closed on any corrupted ciphertext or tag mismatch.
 */

export interface CredentialVault {
  encrypt(
    credentials: CalendarConnectionCredentials,
  ): Promise<EncryptedCredentialPayload>;

  decrypt(
    payload: EncryptedCredentialPayload,
  ): Promise<CalendarConnectionCredentials>;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit standard for GCM
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32; // 256-bit key

export interface AesGcmCredentialVaultOptions {
  /**
   * 32-byte encryption key as Buffer, or 64-character hex string.
   * If not provided, reads process.env.BRAINOS_CREDENTIAL_ENCRYPTION_KEY.
   */
  key?: Buffer | string;
  keyVersion?: string;
}

export class AesGcmCredentialVault implements CredentialVault {
  private readonly keyBuffer: Buffer;
  private readonly keyVersion: string;

  constructor(options: AesGcmCredentialVaultOptions = {}) {
    this.keyVersion = options.keyVersion ?? "v1";

    if (options.key) {
      this.keyBuffer = this.parseKey(options.key);
    } else if (process.env.BRAINOS_CREDENTIAL_ENCRYPTION_KEY) {
      this.keyBuffer = this.parseKey(
        process.env.BRAINOS_CREDENTIAL_ENCRYPTION_KEY,
      );
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new CredentialVaultError(
          "BRAINOS_CREDENTIAL_ENCRYPTION_KEY environment variable is required in production.",
        );
      }
      // For local development and test defaults, generate a deterministic session key
      // Never used in production.
      this.keyBuffer = crypto.randomBytes(KEY_LENGTH_BYTES);
    }
  }

  private parseKey(key: Buffer | string): Buffer {
    let buf: Buffer;
    if (Buffer.isBuffer(key)) {
      buf = key;
    } else if (typeof key === "string") {
      if (key.length === KEY_LENGTH_BYTES * 2 && /^[0-9a-fA-F]+$/.test(key)) {
        buf = Buffer.from(key, "hex");
      } else if (key.length === KEY_LENGTH_BYTES) {
        buf = Buffer.from(key, "utf8");
      } else {
        throw new CredentialVaultError(
          `Invalid encryption key: key must be exactly ${KEY_LENGTH_BYTES} bytes (or ${KEY_LENGTH_BYTES * 2} hex characters).`,
        );
      }
    } else {
      throw new CredentialVaultError("Invalid encryption key type.");
    }

    if (buf.length !== KEY_LENGTH_BYTES) {
      throw new CredentialVaultError(
        `Invalid encryption key byte length: expected ${KEY_LENGTH_BYTES}, got ${buf.length}.`,
      );
    }

    return buf;
  }

  async encrypt(
    credentials: CalendarConnectionCredentials,
  ): Promise<EncryptedCredentialPayload> {
    if (!credentials || typeof credentials.accessToken !== "string") {
      throw new CredentialVaultError("Invalid credentials: accessToken is required.");
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH_BYTES);
      const cipher = crypto.createCipheriv(ALGORITHM, this.keyBuffer, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });

      const serializable = {
        ...credentials,
        expiresAt:
          credentials.expiresAt instanceof Date
            ? credentials.expiresAt.toISOString()
            : credentials.expiresAt,
      };

      const plaintext = Buffer.from(JSON.stringify(serializable), "utf8");
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return {
        ciphertext: encrypted.toString("hex"),
        iv: iv.toString("hex"),
        authTag: authTag.toString("hex"),
        keyVersion: this.keyVersion,
      };
    } catch (err) {
      if (err instanceof CredentialVaultError) throw err;
      throw new CredentialVaultError("Encryption failed.");
    }
  }

  async decrypt(
    payload: EncryptedCredentialPayload,
  ): Promise<CalendarConnectionCredentials> {
    if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) {
      throw new CredentialVaultError(
        "Invalid encrypted payload: ciphertext, iv, and authTag are required.",
      );
    }

    try {
      const iv = Buffer.from(payload.iv, "hex");
      const authTag = Buffer.from(payload.authTag, "hex");
      const ciphertext = Buffer.from(payload.ciphertext, "hex");

      if (iv.length !== IV_LENGTH_BYTES) {
        throw new CredentialVaultError(
          `Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, got ${iv.length}.`,
        );
      }

      if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
        throw new CredentialVaultError(
          `Invalid authTag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes, got ${authTag.length}.`,
        );
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, this.keyBuffer, iv, {
        authTagLength: AUTH_TAG_LENGTH_BYTES,
      });

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      const parsed = JSON.parse(decrypted.toString("utf8"));

      if (parsed.expiresAt && typeof parsed.expiresAt === "string") {
        parsed.expiresAt = new Date(parsed.expiresAt);
      }

      return parsed as CalendarConnectionCredentials;
    } catch (err) {
      if (err instanceof CredentialVaultError) throw err;
      // Fail closed on authentication tag mismatch, wrong key, or corrupted payload
      throw new CredentialVaultError(
        "Credential decryption failed: corrupted ciphertext, invalid key, or tampered authentication tag.",
      );
    }
  }
}
