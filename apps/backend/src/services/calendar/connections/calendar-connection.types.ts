import { AppError } from "../../../errors/AppError";

/**
 * ============================================================================
 * BrainOS User-Scoped Calendar Connection Types & Models
 * ============================================================================
 */

export type CalendarConnectionStatus =
  | "CONNECTED"
  | "NEEDS_REAUTH"
  | "DISCONNECTED"
  | "ERROR";

/**
 * Sanitized user-facing connection metadata.
 * Strictly decoupled from and never contains raw or decrypted credentials.
 */
export interface UserCalendarConnection {
  id: string;
  userId: string;
  providerId: string;
  accountEmail?: string | null;
  displayName?: string | null;
  status: CalendarConnectionStatus;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generic external calendar credentials envelope.
 * Decoupled from any vendor-specific OAuth SDK.
 */
export interface CalendarConnectionCredentials {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  tokenType?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Authenticated ciphertext envelope produced by CredentialVault.
 */
export interface EncryptedCredentialPayload {
  ciphertext: string; // hex-encoded
  iv: string;         // hex-encoded initialization vector (12 bytes for GCM)
  authTag: string;    // hex-encoded GCM authentication tag (16 bytes)
  keyVersion?: string;
}

/**
 * Internal record stored in repository containing metadata + encrypted credentials.
 */
export interface StoredConnectionRecord extends UserCalendarConnection {
  encryptedCredentials: EncryptedCredentialPayload;
}

export interface CreateConnectionInput {
  providerId: string;
  accountEmail?: string | null;
  displayName?: string | null;
  status?: CalendarConnectionStatus;
  metadata?: Record<string, unknown> | null;
  credentials: CalendarConnectionCredentials;
}

export interface UpdateConnectionInput {
  accountEmail?: string | null;
  displayName?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * ============================================================================
 * Calendar Connection Domain Errors
 * ============================================================================
 */

export class CalendarConnectionError extends AppError {
  constructor(
    message: string,
    options?: { statusCode?: number; code?: string; isOperational?: boolean },
  ) {
    super({
      message,
      statusCode: options?.statusCode ?? 500,
      code: options?.code ?? "CALENDAR_CONNECTION_ERROR",
      isOperational: options?.isOperational ?? true,
    });
  }
}

export class CalendarConnectionNotFoundError extends CalendarConnectionError {
  constructor(message = "Calendar connection not found.") {
    super(message, {
      statusCode: 404,
      code: "CALENDAR_CONNECTION_NOT_FOUND",
    });
  }
}

export class CalendarConnectionAuthError extends CalendarConnectionError {
  constructor(message = "Calendar connection authentication failed.") {
    super(message, {
      statusCode: 401,
      code: "CALENDAR_CONNECTION_AUTH_ERROR",
    });
  }
}

export class CalendarConnectionStateError extends CalendarConnectionError {
  constructor(message: string) {
    super(message, {
      statusCode: 409,
      code: "CALENDAR_CONNECTION_STATE_ERROR",
    });
  }
}

export class CredentialVaultError extends CalendarConnectionError {
  constructor(message = "Credential vault encryption or decryption failed.") {
    super(message, {
      statusCode: 500,
      code: "CREDENTIAL_VAULT_ERROR",
    });
  }
}
