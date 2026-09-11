import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { Prisma } from "@prisma/client";

import { prisma } from "../../../../src/lib/prisma";
import {
  AesGcmCredentialVault,
  CalendarConnectionCredentials,
  CalendarConnectionManager,
  CalendarConnectionNotFoundError,
  CalendarConnectionStateError,
  PrismaUserCalendarConnectionRepository,
  UserCalendarConnection,
} from "../../../../src/services/calendar/connections";
import {
  CalendarProviderRegistry,
  MockCalendarProvider,
} from "../../../../src/services/calendar/providers";
import { assertSafeTestEnvironment } from "../../../safety";

const userA = {
  id: "conn-integration-user-a",
  clerkId: "conn-integration-clerk-a",
  email: "conn-user-a@example.test",
};

const userB = {
  id: "conn-integration-user-b",
  clerkId: "conn-integration-clerk-b",
  email: "conn-user-b@example.test",
};

const cascadeUser = {
  id: "conn-integration-user-cascade",
  clerkId: "conn-integration-clerk-cascade",
  email: "conn-cascade@example.test",
};

const allTestUserIds = [userA.id, userB.id, cascadeUser.id];

const repository = new PrismaUserCalendarConnectionRepository(prisma);
const vault = new AesGcmCredentialVault();

async function cleanupIntegrationRows(): Promise<void> {
  assertSafeTestEnvironment();

  await prisma.calendarConnection.deleteMany({
    where: {
      userId: {
        in: allTestUserIds,
      },
    },
  });
}

describe("PrismaUserCalendarConnectionRepository PostgreSQL integration", () => {
  beforeAll(async () => {
    assertSafeTestEnvironment();

    // Verify test database safety
    const database = await prisma.$queryRaw<Array<{ database: string }>>(
      Prisma.sql`SELECT current_database() AS "database"`,
    );
    expect(database).toEqual([{ database: "brainos_test" }]);

    await cleanupIntegrationRows();

    // Upsert primary test users
    for (const u of [userA, userB]) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { clerkId: u.clerkId, email: u.email },
        create: { ...u, firstName: "Integration", lastName: "Tester" },
      });
    }
  });

  beforeEach(async () => {
    await cleanupIntegrationRows();
  });

  afterAll(async () => {
    await cleanupIntegrationRows();

    assertSafeTestEnvironment();

    await prisma.user.deleteMany({
      where: {
        id: {
          in: allTestUserIds,
        },
      },
    });
  });

  describe("create and persistence", () => {
    it("persists encrypted connection and returns sanitized public metadata", async () => {
      const credentials: CalendarConnectionCredentials = {
        accessToken: "secret-oauth-token-abc",
        refreshToken: "secret-refresh-token-xyz",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        tokenType: "Bearer",
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
      };

      const encrypted = await vault.encrypt(credentials);

      const created = await repository.create(userA.id, {
        providerId: "mock",
        accountEmail: "alice@example.com",
        displayName: "Alice Work Calendar",
        status: "CONNECTED",
        metadata: { department: "Engineering" },
        encryptedCredentials: encrypted,
      });

      expect(created.id).toBeDefined();
      expect(created.userId).toBe(userA.id);
      expect(created.providerId).toBe("mock");
      expect(created.accountEmail).toBe("alice@example.com");
      expect(created.displayName).toBe("Alice Work Calendar");
      expect(created.status).toBe("CONNECTED");
      expect(created.metadata).toEqual({ department: "Engineering" });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);

      // Verify at the raw database level that ciphertext exists and plaintext does not
      const rawDbRecord = await prisma.calendarConnection.findUnique({
        where: { id: created.id },
      });

      expect(rawDbRecord).not.toBeNull();
      expect(rawDbRecord?.ciphertext).toBe(encrypted.ciphertext);
      expect(rawDbRecord?.iv).toBe(encrypted.iv);
      expect(rawDbRecord?.authTag).toBe(encrypted.authTag);
      expect(rawDbRecord?.algorithm).toBe("aes-256-gcm");
      expect(rawDbRecord?.keyVersion).toBe(1);

      // Verify no plaintext tokens stored in raw table
      const rawJson = JSON.stringify(rawDbRecord);
      expect(rawJson).not.toContain("secret-oauth-token-abc");
      expect(rawJson).not.toContain("secret-refresh-token-xyz");
    });
  });

  describe("projection hygiene", () => {
    it("findById and listForUser strictly omit all credential fields", async () => {
      const encrypted = await vault.encrypt({
        accessToken: "classified-token-999",
      });

      const created = await repository.create(userA.id, {
        providerId: "mock",
        accountEmail: "hygiene@example.com",
        encryptedCredentials: encrypted,
      });

      // 1. findById check
      const found = await repository.findById(created.id, userA.id);
      expect(found).not.toBeNull();
      expect((found as any).ciphertext).toBeUndefined();
      expect((found as any).iv).toBeUndefined();
      expect((found as any).authTag).toBeUndefined();
      expect((found as any).algorithm).toBeUndefined();
      expect((found as any).keyVersion).toBeUndefined();
      expect((found as any).encryptedCredentials).toBeUndefined();

      // 2. listForUser check
      const list = await repository.listForUser(userA.id);
      expect(list.length).toBe(1);
      const item = list[0];
      expect((item as any).ciphertext).toBeUndefined();
      expect((item as any).iv).toBeUndefined();
      expect((item as any).authTag).toBeUndefined();
      expect((item as any).algorithm).toBeUndefined();
      expect((item as any).keyVersion).toBeUndefined();
      expect((item as any).encryptedCredentials).toBeUndefined();
    });
  });

  describe("findWithCredentials / findStoredRecord credential roundtrip", () => {
    it("retrieves encrypted payload and decrypts back to original credentials", async () => {
      const originalCredentials: CalendarConnectionCredentials = {
        accessToken: "roundtrip-token-123",
        refreshToken: "roundtrip-refresh-456",
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        scopes: ["calendar.read", "calendar.write"],
      };

      const encrypted = await vault.encrypt(originalCredentials);

      const created = await repository.create(userA.id, {
        providerId: "mock",
        accountEmail: "roundtrip@example.com",
        encryptedCredentials: encrypted,
      });

      // Retrieve via findWithCredentials
      const stored = await repository.findWithCredentials(created.id, userA.id);
      expect(stored).not.toBeNull();
      expect(stored?.encryptedCredentials.ciphertext).toBe(encrypted.ciphertext);
      expect(stored?.encryptedCredentials.iv).toBe(encrypted.iv);
      expect(stored?.encryptedCredentials.authTag).toBe(encrypted.authTag);

      // Decrypt using vault
      const decrypted = await vault.decrypt(stored!.encryptedCredentials);
      expect(decrypted.accessToken).toBe("roundtrip-token-123");
      expect(decrypted.refreshToken).toBe("roundtrip-refresh-456");
      expect(decrypted.scopes).toEqual(["calendar.read", "calendar.write"]);

      // Verify findStoredRecord alias produces the identical result
      const aliasStored = await repository.findStoredRecord(created.id, userA.id);
      expect(aliasStored).toEqual(stored);
    });
  });

  describe("metadata updates", () => {
    it("updates displayName, accountEmail, and metadata while preserving credentials", async () => {
      const encrypted = await vault.encrypt({ accessToken: "stable-token" });

      const created = await repository.create(userA.id, {
        providerId: "mock",
        accountEmail: "initial@example.com",
        displayName: "Initial Name",
        metadata: { initial: true },
        encryptedCredentials: encrypted,
      });

      const updated = await repository.update(created.id, userA.id, {
        accountEmail: "updated@example.com",
        displayName: "Updated Name",
        metadata: { initial: false, updated: true },
      });

      expect(updated).not.toBeNull();
      expect(updated?.accountEmail).toBe("updated@example.com");
      expect(updated?.displayName).toBe("Updated Name");
      expect(updated?.metadata).toEqual({ initial: false, updated: true });

      // Confirm credentials in DB were not corrupted or wiped
      const stored = await repository.findWithCredentials(created.id, userA.id);
      expect(stored?.encryptedCredentials.ciphertext).toBe(encrypted.ciphertext);
    });
  });

  describe("status updates", () => {
    it("transitions status to NEEDS_REAUTH and DISCONNECTED", async () => {
      const encrypted = await vault.encrypt({ accessToken: "token-status" });

      const created = await repository.create(userA.id, {
        providerId: "mock",
        encryptedCredentials: encrypted,
      });
      expect(created.status).toBe("CONNECTED");

      const needsReauth = await repository.updateStatus(
        created.id,
        userA.id,
        "NEEDS_REAUTH",
      );
      expect(needsReauth?.status).toBe("NEEDS_REAUTH");

      const disconnected = await repository.updateStatus(
        created.id,
        userA.id,
        "DISCONNECTED",
      );
      expect(disconnected?.status).toBe("DISCONNECTED");
    });
  });

  describe("credential rotation / updateCredentials", () => {
    it("replaces encrypted payload with fresh ciphertext and resets status", async () => {
      const initialEncrypted = await vault.encrypt({ accessToken: "old-token" });

      const created = await repository.create(userA.id, {
        providerId: "mock",
        status: "NEEDS_REAUTH",
        encryptedCredentials: initialEncrypted,
      });

      const freshCredentials: CalendarConnectionCredentials = {
        accessToken: "new-rotated-token",
        refreshToken: "new-refresh-token",
      };
      const freshEncrypted = await vault.encrypt(freshCredentials);

      const rotated = await repository.updateCredentials(
        created.id,
        userA.id,
        freshEncrypted,
        "CONNECTED",
      );

      expect(rotated).not.toBeNull();
      expect(rotated?.status).toBe("CONNECTED");

      // Verify in database that new ciphertext is stored and decrypts to new token
      const stored = await repository.findWithCredentials(created.id, userA.id);
      expect(stored?.encryptedCredentials.ciphertext).toBe(freshEncrypted.ciphertext);

      const decrypted = await vault.decrypt(stored!.encryptedCredentials);
      expect(decrypted.accessToken).toBe("new-rotated-token");
      expect(decrypted.refreshToken).toBe("new-refresh-token");
    });
  });

  describe("delete", () => {
    it("deletes owned connection and returns true, then fails closed as null", async () => {
      const encrypted = await vault.encrypt({ accessToken: "delete-me" });

      const created = await repository.create(userA.id, {
        providerId: "mock",
        encryptedCredentials: encrypted,
      });

      const deleted = await repository.delete(created.id, userA.id);
      expect(deleted).toBe(true);

      const found = await repository.findById(created.id, userA.id);
      expect(found).toBeNull();

      const stored = await repository.findWithCredentials(created.id, userA.id);
      expect(stored).toBeNull();

      // Second delete returns false
      const reDelete = await repository.delete(created.id, userA.id);
      expect(reDelete).toBe(false);
    });
  });

  describe("strict cross-user multi-tenant isolation", () => {
    it("enforces fail-closed behavior across all methods when accessing another user's connection", async () => {
      const encrypted = await vault.encrypt({ accessToken: "alice-secret" });

      const aliceConn = await repository.create(userA.id, {
        providerId: "mock",
        accountEmail: "alice@company.com",
        encryptedCredentials: encrypted,
      });

      // 1. User B cannot find Alice's connection by ID
      const crossFind = await repository.findById(aliceConn.id, userB.id);
      expect(crossFind).toBeNull();

      // 2. User B list does not contain Alice's connection
      const userBList = await repository.listForUser(userB.id);
      expect(userBList.find((c) => c.id === aliceConn.id)).toBeUndefined();

      // 3. User B cannot retrieve Alice's credentials
      const crossCreds = await repository.findWithCredentials(
        aliceConn.id,
        userB.id,
      );
      expect(crossCreds).toBeNull();

      // 4. User B cannot update Alice's metadata
      const crossUpdate = await repository.update(aliceConn.id, userB.id, {
        displayName: "Hacked Display Name",
      });
      expect(crossUpdate).toBeNull();

      // Verify Alice's record was untouched
      const originalAlice = await repository.findById(aliceConn.id, userA.id);
      expect(originalAlice?.displayName).toBeNull();

      // 5. User B cannot update Alice's status
      const crossStatus = await repository.updateStatus(
        aliceConn.id,
        userB.id,
        "DISCONNECTED",
      );
      expect(crossStatus).toBeNull();

      // 6. User B cannot overwrite Alice's credentials
      const maliciousEncrypted = await vault.encrypt({ accessToken: "evil-token" });
      const crossCredUpdate = await repository.updateCredentials(
        aliceConn.id,
        userB.id,
        maliciousEncrypted,
      );
      expect(crossCredUpdate).toBeNull();

      // 7. User B cannot delete Alice's connection
      const crossDelete = await repository.delete(aliceConn.id, userB.id);
      expect(crossDelete).toBe(false);

      // Verify Alice's connection is still active and intact
      const intactAlice = await repository.findById(aliceConn.id, userA.id);
      expect(intactAlice).not.toBeNull();
      expect(intactAlice?.status).toBe("CONNECTED");
    });
  });

  describe("cascade deletion on User removal", () => {
    it("automatically cascade-deletes all calendar connections when the User is deleted", async () => {
      // Create dedicated cascade test user
      await prisma.user.upsert({
        where: { id: cascadeUser.id },
        update: { clerkId: cascadeUser.clerkId, email: cascadeUser.email },
        create: { ...cascadeUser, firstName: "Cascade", lastName: "Tester" },
      });

      const encrypted1 = await vault.encrypt({ accessToken: "cascade-token-1" });
      const encrypted2 = await vault.encrypt({ accessToken: "cascade-token-2" });

      const conn1 = await repository.create(cascadeUser.id, {
        providerId: "mock",
        encryptedCredentials: encrypted1,
      });
      const conn2 = await repository.create(cascadeUser.id, {
        providerId: "mock",
        encryptedCredentials: encrypted2,
      });

      // Confirm both connections exist in DB
      const preCount = await prisma.calendarConnection.count({
        where: { userId: cascadeUser.id },
      });
      expect(preCount).toBe(2);

      // Delete the User at the Prisma/PostgreSQL level
      await prisma.user.delete({
        where: { id: cascadeUser.id },
      });

      // Confirm all connections were cascade-deleted by PostgreSQL
      const postCount = await prisma.calendarConnection.count({
        where: { userId: cascadeUser.id },
      });
      expect(postCount).toBe(0);

      // Confirm individual lookups return null
      expect(await repository.findById(conn1.id, cascadeUser.id)).toBeNull();
      expect(await repository.findById(conn2.id, cascadeUser.id)).toBeNull();
    });
  });

  describe("CalendarConnectionManager integration with Prisma repository", () => {
    it("successfully creates, retrieves, and binds a scoped provider backed by PostgreSQL", async () => {
      const mockDriver = new MockCalendarProvider({ id: "mock", name: "Mock Driver" });
      const registry = new CalendarProviderRegistry();
      registry.register(mockDriver);

      const manager = new CalendarConnectionManager(
        repository,
        vault,
        registry,
      );

      // 1. Create connection through manager
      const connection = await manager.createConnection(userA.id, {
        providerId: "mock",
        accountEmail: "manager-test@example.com",
        displayName: "Manager Integration",
        credentials: {
          accessToken: "manager-access-token",
          refreshToken: "manager-refresh-token",
        },
      });

      expect(connection.id).toBeDefined();
      expect(connection.status).toBe("CONNECTED");

      // 2. Get connection through manager
      const retrieved = await manager.getConnection(userA.id, connection.id);
      expect(retrieved.id).toBe(connection.id);
      expect(retrieved.accountEmail).toBe("manager-test@example.com");

      // 3. Bind scoped provider through manager
      const scopedProvider = await manager.getScopedProvider(
        userA.id,
        connection.id,
      );
      expect(scopedProvider).toBeDefined();
      expect(scopedProvider.id).toBe(`mock:${connection.id}`);
      expect(scopedProvider.userId).toBe(userA.id);
      expect(scopedProvider.connectionId).toBe(connection.id);

      // Provider executes successfully with decrypted credentials
      const createdEvent = await scopedProvider.createEvent({
        title: "Database Backed Event",
        startTime: new Date("2026-11-01T10:00:00Z"),
        endTime: new Date("2026-11-01T11:00:00Z"),
      });
      expect(createdEvent.externalId).toBeDefined();
      expect(createdEvent.title).toBe("Database Backed Event");

      // 4. Cross-user access through manager fails closed
      await expect(
        manager.getConnection(userB.id, connection.id),
      ).rejects.toThrow(CalendarConnectionNotFoundError);

      await expect(
        manager.getScopedProvider(userB.id, connection.id),
      ).rejects.toThrow(CalendarConnectionNotFoundError);

      // 5. State enforcement: disconnected connection rejects binding
      await manager.updateConnectionStatus(
        userA.id,
        connection.id,
        "DISCONNECTED",
      );

      await expect(
        manager.getScopedProvider(userA.id, connection.id),
      ).rejects.toThrow(CalendarConnectionStateError);
    });
  });
});
