import { randomUUID } from "node:crypto";
import {
  CalendarConnectionStatus,
  EncryptedCredentialPayload,
  StoredConnectionRecord,
  UpdateConnectionInput,
  UserCalendarConnection,
} from "../calendar-connection.types";

/**
 * ============================================================================
 * User-Scoped Calendar Connection Repository Contract & In-Memory Store
 * ============================================================================
 *
 * Invariants:
 * - Every single repository method requires userId.
 * - Cross-user access returns null / empty / false (fail-closed).
 * - Metadata queries (findById, listForUser) sanitize records and strip credentials.
 */

export interface CreateStoredConnectionData {
  providerId: string;
  accountEmail?: string | null;
  displayName?: string | null;
  status?: CalendarConnectionStatus;
  metadata?: Record<string, unknown> | null;
  encryptedCredentials: EncryptedCredentialPayload;
}

export interface UserCalendarConnectionRepository {
  create(
    userId: string,
    data: CreateStoredConnectionData,
  ): Promise<UserCalendarConnection>;

  findById(
    id: string,
    userId: string,
  ): Promise<UserCalendarConnection | null>;

  findWithCredentials(
    id: string,
    userId: string,
  ): Promise<StoredConnectionRecord | null>;

  findStoredRecord(
    id: string,
    userId: string,
  ): Promise<StoredConnectionRecord | null>;

  listForUser(userId: string): Promise<UserCalendarConnection[]>;

  update(
    id: string,
    userId: string,
    data: UpdateConnectionInput,
  ): Promise<UserCalendarConnection | null>;

  updateStatus(
    id: string,
    userId: string,
    status: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection | null>;

  updateCredentials(
    id: string,
    userId: string,
    encryptedCredentials: EncryptedCredentialPayload,
    status?: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection | null>;

  delete(id: string, userId: string): Promise<boolean>;
}

export class InMemoryUserCalendarConnectionRepository
  implements UserCalendarConnectionRepository
{
  private records = new Map<string, StoredConnectionRecord>();

  private sanitize(record: StoredConnectionRecord): UserCalendarConnection {
    return {
      id: record.id,
      userId: record.userId,
      providerId: record.providerId,
      accountEmail: record.accountEmail ?? null,
      displayName: record.displayName ?? null,
      status: record.status,
      metadata: record.metadata ? JSON.parse(JSON.stringify(record.metadata)) : null,
      createdAt: new Date(record.createdAt.getTime()),
      updatedAt: new Date(record.updatedAt.getTime()),
    };
  }

  private cloneRecord(record: StoredConnectionRecord): StoredConnectionRecord {
    return {
      ...this.sanitize(record),
      encryptedCredentials: { ...record.encryptedCredentials },
    };
  }

  async create(
    userId: string,
    data: CreateStoredConnectionData,
  ): Promise<UserCalendarConnection> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("userId is required for connection creation.");
    }
    if (!data.providerId || typeof data.providerId !== "string") {
      throw new Error("providerId is required.");
    }

    const now = new Date();
    const id = randomUUID();

    const record: StoredConnectionRecord = {
      id,
      userId: userId.trim(),
      providerId: data.providerId.trim(),
      accountEmail: data.accountEmail ? data.accountEmail.trim() : null,
      displayName: data.displayName ? data.displayName.trim() : null,
      status: data.status ?? "CONNECTED",
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
      encryptedCredentials: { ...data.encryptedCredentials },
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(id, record);
    return this.sanitize(record);
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<UserCalendarConnection | null> {
    if (!id || !userId) return null;

    const record = this.records.get(id);
    if (!record || record.userId !== userId) {
      return null;
    }

    return this.sanitize(record);
  }

  async findWithCredentials(
    id: string,
    userId: string,
  ): Promise<StoredConnectionRecord | null> {
    if (!id || !userId) return null;

    const record = this.records.get(id);
    if (!record || record.userId !== userId) {
      return null;
    }

    return this.cloneRecord(record);
  }

  async findStoredRecord(
    id: string,
    userId: string,
  ): Promise<StoredConnectionRecord | null> {
    return this.findWithCredentials(id, userId);
  }

  async listForUser(userId: string): Promise<UserCalendarConnection[]> {
    if (!userId) return [];

    return Array.from(this.records.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => this.sanitize(r));
  }

  async update(
    id: string,
    userId: string,
    data: UpdateConnectionInput,
  ): Promise<UserCalendarConnection | null> {
    if (!id || !userId) return null;

    const record = this.records.get(id);
    if (!record || record.userId !== userId) {
      return null;
    }

    const updated: StoredConnectionRecord = {
      ...record,
      accountEmail:
        data.accountEmail !== undefined
          ? data.accountEmail
            ? data.accountEmail.trim()
            : null
          : record.accountEmail,
      displayName:
        data.displayName !== undefined
          ? data.displayName
            ? data.displayName.trim()
            : null
          : record.displayName,
      metadata:
        data.metadata !== undefined
          ? data.metadata
            ? JSON.parse(JSON.stringify(data.metadata))
            : null
          : record.metadata,
      updatedAt: new Date(),
    };

    this.records.set(id, updated);
    return this.sanitize(updated);
  }

  async updateStatus(
    id: string,
    userId: string,
    status: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection | null> {
    if (!id || !userId) return null;

    const record = this.records.get(id);
    if (!record || record.userId !== userId) {
      return null;
    }

    record.status = status;
    record.updatedAt = new Date();
    this.records.set(id, record);

    return this.sanitize(record);
  }

  async updateCredentials(
    id: string,
    userId: string,
    encryptedCredentials: EncryptedCredentialPayload,
    status?: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection | null> {
    if (!id || !userId) return null;

    const record = this.records.get(id);
    if (!record || record.userId !== userId) {
      return null;
    }

    record.encryptedCredentials = { ...encryptedCredentials };
    if (status) {
      record.status = status;
    }
    record.updatedAt = new Date();
    this.records.set(id, record);

    return this.sanitize(record);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (!id || !userId) return false;

    const record = this.records.get(id);
    if (!record || record.userId !== userId) {
      return false;
    }

    return this.records.delete(id);
  }

  public clear(): void {
    this.records.clear();
  }
}
