import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { DatabaseClient } from "../../../../lib/prisma.types";
import {
  CalendarConnectionStatus,
  EncryptedCredentialPayload,
  StoredConnectionRecord,
  UpdateConnectionInput,
  UserCalendarConnection,
} from "../calendar-connection.types";
import {
  CreateStoredConnectionData,
  UserCalendarConnectionRepository,
} from "./calendar-connection.repository";

/**
 * Columns selected for public metadata responses.
 * Strictly omits: ciphertext, iv, authTag, algorithm, keyVersion.
 */
const PUBLIC_METADATA_SELECT = {
  id: true,
  userId: true,
  providerId: true,
  accountEmail: true,
  displayName: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PublicSelectedRow = {
  id: string;
  userId: string;
  providerId: string;
  accountEmail: string | null;
  displayName: string | null;
  status: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * ============================================================================
 * Prisma User-Scoped Calendar Connection Repository
 * ============================================================================
 *
 * Implements persistent external calendar connection storage in PostgreSQL via Prisma.
 *
 * Invariants:
 * - Strict multi-tenant isolation: every single query requires and filters on userId.
 * - Compound filtering on { id, userId } ensures cross-user access fails closed.
 * - SQL projection hygiene: findById and listForUser never select or expose encrypted payload fields.
 * - findWithCredentials / findStoredRecord is the dedicated user-scoped credential retrieval path.
 * - PostgreSQL receives only authenticated ciphertext envelopes encrypted by AesGcmCredentialVault.
 */
export class PrismaUserCalendarConnectionRepository
  implements UserCalendarConnectionRepository
{
  constructor(private readonly db: DatabaseClient = prisma) {}

  async create(
    userId: string,
    data: CreateStoredConnectionData,
  ): Promise<UserCalendarConnection> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("userId is required for connection creation.");
    }
    if (
      !data.providerId ||
      typeof data.providerId !== "string" ||
      data.providerId.trim().length === 0
    ) {
      throw new Error("providerId is required.");
    }
    if (
      !data.encryptedCredentials ||
      !data.encryptedCredentials.ciphertext ||
      !data.encryptedCredentials.iv ||
      !data.encryptedCredentials.authTag
    ) {
      throw new Error("Valid encrypted credential payload is required.");
    }

    const keyVersionNum =
      typeof data.encryptedCredentials.keyVersion === "string"
        ? parseInt(data.encryptedCredentials.keyVersion.replace(/\D/g, ""), 10) || 1
        : 1;

    const created = await this.db.calendarConnection.create({
      data: {
        userId: userId.trim(),
        providerId: data.providerId.trim(),
        status: data.status ?? "CONNECTED",
        accountEmail: data.accountEmail ? data.accountEmail.trim() : null,
        displayName: data.displayName ? data.displayName.trim() : null,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ciphertext: data.encryptedCredentials.ciphertext,
        iv: data.encryptedCredentials.iv,
        authTag: data.encryptedCredentials.authTag,
        algorithm: "aes-256-gcm",
        keyVersion: keyVersionNum,
      },
      select: PUBLIC_METADATA_SELECT,
    });

    return this.mapToPublicConnection(created);
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<UserCalendarConnection | null> {
    if (
      !id ||
      typeof id !== "string" ||
      !userId ||
      typeof userId !== "string" ||
      id.trim().length === 0 ||
      userId.trim().length === 0
    ) {
      return null;
    }

    const record = await this.db.calendarConnection.findFirst({
      where: {
        id: id.trim(),
        userId: userId.trim(),
      },
      select: PUBLIC_METADATA_SELECT,
    });

    if (!record) {
      return null;
    }

    return this.mapToPublicConnection(record);
  }

  async findWithCredentials(
    id: string,
    userId: string,
  ): Promise<StoredConnectionRecord | null> {
    if (
      !id ||
      typeof id !== "string" ||
      !userId ||
      typeof userId !== "string" ||
      id.trim().length === 0 ||
      userId.trim().length === 0
    ) {
      return null;
    }

    const record = await this.db.calendarConnection.findFirst({
      where: {
        id: id.trim(),
        userId: userId.trim(),
      },
    });

    if (!record) {
      return null;
    }

    return this.mapToStoredRecord(record);
  }

  async findStoredRecord(
    id: string,
    userId: string,
  ): Promise<StoredConnectionRecord | null> {
    return this.findWithCredentials(id, userId);
  }

  async listForUser(userId: string): Promise<UserCalendarConnection[]> {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return [];
    }

    const records = await this.db.calendarConnection.findMany({
      where: {
        userId: userId.trim(),
      },
      select: PUBLIC_METADATA_SELECT,
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map((r) => this.mapToPublicConnection(r));
  }

  async update(
    id: string,
    userId: string,
    data: UpdateConnectionInput,
  ): Promise<UserCalendarConnection | null> {
    if (
      !id ||
      typeof id !== "string" ||
      !userId ||
      typeof userId !== "string" ||
      id.trim().length === 0 ||
      userId.trim().length === 0
    ) {
      return null;
    }

    // Compound ownership check fails closed for cross-user attempts
    const existing = await this.db.calendarConnection.findFirst({
      where: {
        id: id.trim(),
        userId: userId.trim(),
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const updateData: Prisma.CalendarConnectionUpdateInput = {};

    if (data.accountEmail !== undefined) {
      updateData.accountEmail = data.accountEmail ? data.accountEmail.trim() : null;
    }
    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName ? data.displayName.trim() : null;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata
        ? (data.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const updated = await this.db.calendarConnection.update({
      where: {
        id: id.trim(),
      },
      data: updateData,
      select: PUBLIC_METADATA_SELECT,
    });

    return this.mapToPublicConnection(updated);
  }

  async updateStatus(
    id: string,
    userId: string,
    status: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection | null> {
    if (
      !id ||
      typeof id !== "string" ||
      !userId ||
      typeof userId !== "string" ||
      id.trim().length === 0 ||
      userId.trim().length === 0
    ) {
      return null;
    }

    const existing = await this.db.calendarConnection.findFirst({
      where: {
        id: id.trim(),
        userId: userId.trim(),
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const updated = await this.db.calendarConnection.update({
      where: {
        id: id.trim(),
      },
      data: {
        status,
      },
      select: PUBLIC_METADATA_SELECT,
    });

    return this.mapToPublicConnection(updated);
  }

  async updateCredentials(
    id: string,
    userId: string,
    encryptedCredentials: EncryptedCredentialPayload,
    status?: CalendarConnectionStatus,
  ): Promise<UserCalendarConnection | null> {
    if (
      !id ||
      typeof id !== "string" ||
      !userId ||
      typeof userId !== "string" ||
      id.trim().length === 0 ||
      userId.trim().length === 0
    ) {
      return null;
    }

    const existing = await this.db.calendarConnection.findFirst({
      where: {
        id: id.trim(),
        userId: userId.trim(),
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const keyVersionNum =
      typeof encryptedCredentials.keyVersion === "string"
        ? parseInt(encryptedCredentials.keyVersion.replace(/\D/g, ""), 10) || 1
        : 1;

    const updateData: Prisma.CalendarConnectionUpdateInput = {
      ciphertext: encryptedCredentials.ciphertext,
      iv: encryptedCredentials.iv,
      authTag: encryptedCredentials.authTag,
      algorithm: "aes-256-gcm",
      keyVersion: keyVersionNum,
    };

    if (status) {
      updateData.status = status;
    }

    const updated = await this.db.calendarConnection.update({
      where: {
        id: id.trim(),
      },
      data: updateData,
      select: PUBLIC_METADATA_SELECT,
    });

    return this.mapToPublicConnection(updated);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    if (
      !id ||
      typeof id !== "string" ||
      !userId ||
      typeof userId !== "string" ||
      id.trim().length === 0 ||
      userId.trim().length === 0
    ) {
      return false;
    }

    // Direct database-level compound delete enforcing userId
    const result = await this.db.calendarConnection.deleteMany({
      where: {
        id: id.trim(),
        userId: userId.trim(),
      },
    });

    return result.count > 0;
  }

  private mapToPublicConnection(record: PublicSelectedRow): UserCalendarConnection {
    return {
      id: record.id,
      userId: record.userId,
      providerId: record.providerId,
      accountEmail: record.accountEmail,
      displayName: record.displayName,
      status: record.status as CalendarConnectionStatus,
      metadata: (record.metadata as Record<string, unknown> | null) ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapToStoredRecord(record: {
    id: string;
    userId: string;
    providerId: string;
    accountEmail: string | null;
    displayName: string | null;
    status: string;
    metadata: Prisma.JsonValue | null;
    ciphertext: string;
    iv: string;
    authTag: string;
    algorithm: string;
    keyVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }): StoredConnectionRecord {
    return {
      id: record.id,
      userId: record.userId,
      providerId: record.providerId,
      accountEmail: record.accountEmail,
      displayName: record.displayName,
      status: record.status as CalendarConnectionStatus,
      metadata: (record.metadata as Record<string, unknown> | null) ?? null,
      encryptedCredentials: {
        ciphertext: record.ciphertext,
        iv: record.iv,
        authTag: record.authTag,
        keyVersion: String(record.keyVersion),
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
