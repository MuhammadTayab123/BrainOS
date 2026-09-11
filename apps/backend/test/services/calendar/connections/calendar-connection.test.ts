import crypto from "node:crypto";
import { describe, expect, it, beforeEach } from "vitest";
import {
  AesGcmCredentialVault,
  CalendarConnectionManager,
  CalendarConnectionNotFoundError,
  CalendarConnectionStateError,
  CredentialVaultError,
  InMemoryUserCalendarConnectionRepository,
  UserCalendarConnection,
} from "../../../../src/services/calendar/connections";
import {
  CalendarProviderRegistry,
  MockCalendarProvider,
} from "../../../../src/services/calendar/providers";

describe("User-Scoped Calendar Account & Provider Binding Architecture (Mission 91)", () => {
  let vault: AesGcmCredentialVault;
  let repository: InMemoryUserCalendarConnectionRepository;
  let registry: CalendarProviderRegistry;
  let manager: CalendarConnectionManager;
  let mockDriver: MockCalendarProvider;

  const validKey = crypto.randomBytes(32);

  beforeEach(() => {
    vault = new AesGcmCredentialVault({ key: validKey });
    repository = new InMemoryUserCalendarConnectionRepository();
    registry = new CalendarProviderRegistry();
    mockDriver = new MockCalendarProvider({ id: "mock-cal-driver", name: "Mock Driver" });
    registry.register(mockDriver);

    manager = new CalendarConnectionManager(repository, vault, registry);
  });

  describe("Credential Vault & AES-256-GCM Authenticated Encryption", () => {
    it("encrypts and decrypts credentials successfully (roundtrip)", async () => {
      const expiresAt = new Date("2026-12-31T23:59:59Z");
      const credentials = {
        accessToken: "secret-access-token-123",
        refreshToken: "secret-refresh-token-456",
        expiresAt,
        tokenType: "Bearer",
        scopes: ["calendar.read", "calendar.events"],
        metadata: { accountId: "acc-99" },
      };

      const encrypted = await vault.encrypt(credentials);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      // Verify raw tokens are NOT in ciphertext in plaintext
      expect(encrypted.ciphertext).not.toContain("secret-access-token");
      expect(encrypted.ciphertext).not.toContain("secret-refresh-token");

      const decrypted = await vault.decrypt(encrypted);
      expect(decrypted.accessToken).toBe("secret-access-token-123");
      expect(decrypted.refreshToken).toBe("secret-refresh-token-456");
      expect(decrypted.expiresAt?.toISOString()).toBe(expiresAt.toISOString());
      expect(decrypted.tokenType).toBe("Bearer");
      expect(decrypted.scopes).toEqual(["calendar.read", "calendar.events"]);
      expect(decrypted.metadata).toEqual({ accountId: "acc-99" });
    });

    it("rejects decryption when using the wrong key", async () => {
      const credentials = { accessToken: "test-token" };
      const encrypted = await vault.encrypt(credentials);

      const wrongKeyVault = new AesGcmCredentialVault({ key: crypto.randomBytes(32) });
      await expect(wrongKeyVault.decrypt(encrypted)).rejects.toThrow(CredentialVaultError);
    });

    it("rejects decryption when ciphertext is corrupted", async () => {
      const credentials = { accessToken: "test-token" };
      const encrypted = await vault.encrypt(credentials);

      const corrupted = {
        ...encrypted,
        ciphertext: "ff" + encrypted.ciphertext.slice(2),
      };

      await expect(vault.decrypt(corrupted)).rejects.toThrow(CredentialVaultError);
    });

    it("rejects decryption when authTag is tampered", async () => {
      const credentials = { accessToken: "test-token" };
      const encrypted = await vault.encrypt(credentials);

      const tampered = {
        ...encrypted,
        authTag: "00000000000000000000000000000000",
      };

      await expect(vault.decrypt(tampered)).rejects.toThrow(CredentialVaultError);
    });

    it("rejects invalid key lengths", () => {
      expect(() => new AesGcmCredentialVault({ key: crypto.randomBytes(16) })).toThrow(
        CredentialVaultError,
      );
    });
  });

  describe("Connection Lifecycle (Create, List, Get, Update, Delete)", () => {
    it("creates a connection with sanitized metadata response", async () => {
      const connection = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        accountEmail: "tayyab@example.com",
        displayName: "Work Calendar",
        status: "CONNECTED",
        metadata: { department: "Engineering" },
        credentials: {
          accessToken: "sensitive-token-abc",
          refreshToken: "sensitive-refresh-xyz",
        },
      });

      expect(connection.id).toBeDefined();
      expect(connection.userId).toBe("user-1");
      expect(connection.providerId).toBe("mock-cal-driver");
      expect(connection.accountEmail).toBe("tayyab@example.com");
      expect(connection.displayName).toBe("Work Calendar");
      expect(connection.status).toBe("CONNECTED");
      expect(connection.metadata).toEqual({ department: "Engineering" });

      // Verification: credentials MUST NOT be on the returned metadata
      expect((connection as any).credentials).toBeUndefined();
      expect((connection as any).encryptedCredentials).toBeUndefined();
      expect((connection as any).accessToken).toBeUndefined();
    });

    it("lists connections for a specific user and preserves metadata hygiene", async () => {
      await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        displayName: "Personal",
        credentials: { accessToken: "token-1" },
      });

      await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        displayName: "Work",
        credentials: { accessToken: "token-2" },
      });

      const list = await manager.listConnections("user-1");
      const names = list.map((c) => c.displayName);
      expect(names).toContain("Work");
      expect(names).toContain("Personal");

      for (const item of list) {
        expect((item as any).credentials).toBeUndefined();
        expect((item as any).encryptedCredentials).toBeUndefined();
      }
    });

    it("retrieves connection by ID for the owning user", async () => {
      const created = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        accountEmail: "user1@domain.com",
        credentials: { accessToken: "tok" },
      });

      const fetched = await manager.getConnection("user-1", created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.accountEmail).toBe("user1@domain.com");
    });

    it("updates connection metadata and status", async () => {
      const created = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        displayName: "Initial Name",
        credentials: { accessToken: "tok" },
      });

      const updated = await manager.updateConnection("user-1", created.id, {
        displayName: "Updated Name",
      });
      expect(updated.displayName).toBe("Updated Name");

      const reauthUpdated = await manager.updateConnectionStatus(
        "user-1",
        created.id,
        "NEEDS_REAUTH",
      );
      expect(reauthUpdated.status).toBe("NEEDS_REAUTH");
    });

    it("updates credentials securely (e.g. token refresh)", async () => {
      const created = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        credentials: { accessToken: "old-token" },
      });

      await manager.updateCredentials("user-1", created.id, {
        accessToken: "refreshed-token",
        refreshToken: "new-refresh",
      });

      const scoped = await manager.getScopedProvider("user-1", created.id);
      const boundCreds = scoped.getBoundCredentials();
      expect(boundCreds.accessToken).toBe("refreshed-token");
      expect(boundCreds.refreshToken).toBe("new-refresh");
    });

    it("deletes a connection and fails closed on subsequent lookups", async () => {
      const created = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        credentials: { accessToken: "tok" },
      });

      await manager.deleteConnection("user-1", created.id);

      await expect(manager.getConnection("user-1", created.id)).rejects.toThrow(
        CalendarConnectionNotFoundError,
      );
    });

    it("rejects connection creation when provider is not in registry", async () => {
      await expect(
        manager.createConnection("user-1", {
          providerId: "unregistered-provider",
          credentials: { accessToken: "tok" },
        }),
      ).rejects.toThrow("driver 'unregistered-provider' is not registered");
    });
  });

  describe("Strict Multi-Tenant User Isolation", () => {
    let connUser1: UserCalendarConnection;
    let connUser2: UserCalendarConnection;

    beforeEach(async () => {
      connUser1 = await manager.createConnection("user-alice", {
        providerId: "mock-cal-driver",
        accountEmail: "alice@gmail.com",
        displayName: "Alice Calendar",
        credentials: { accessToken: "alice-token-123" },
      });

      connUser2 = await manager.createConnection("user-bob", {
        providerId: "mock-cal-driver",
        accountEmail: "bob@outlook.com",
        displayName: "Bob Calendar",
        credentials: { accessToken: "bob-token-456" },
      });
    });

    it("prevents User B from getting User A's connection (fails closed with 404)", async () => {
      await expect(
        manager.getConnection("user-bob", connUser1.id),
      ).rejects.toThrow(CalendarConnectionNotFoundError);
    });

    it("prevents User A from getting User B's connection (fails closed with 404)", async () => {
      await expect(
        manager.getConnection("user-alice", connUser2.id),
      ).rejects.toThrow(CalendarConnectionNotFoundError);
    });

    it("prevents User B from listing User A's connections", async () => {
      const aliceList = await manager.listConnections("user-alice");
      expect(aliceList.length).toBe(1);
      expect(aliceList[0].id).toBe(connUser1.id);

      const bobList = await manager.listConnections("user-bob");
      expect(bobList.length).toBe(1);
      expect(bobList[0].id).toBe(connUser2.id);
    });

    it("prevents User B from updating or deleting User A's connection", async () => {
      await expect(
        manager.updateConnection("user-bob", connUser1.id, { displayName: "Hacked" }),
      ).rejects.toThrow(CalendarConnectionNotFoundError);

      await expect(
        manager.updateConnectionStatus("user-bob", connUser1.id, "DISCONNECTED"),
      ).rejects.toThrow(CalendarConnectionNotFoundError);

      await expect(
        manager.deleteConnection("user-bob", connUser1.id),
      ).rejects.toThrow(CalendarConnectionNotFoundError);

      // Verify Alice's connection was completely untouched
      const aliceConn = await manager.getConnection("user-alice", connUser1.id);
      expect(aliceConn.displayName).toBe("Alice Calendar");
      expect(aliceConn.status).toBe("CONNECTED");
    });

    it("prevents User B from binding a scoped provider for User A's connection", async () => {
      await expect(
        manager.getScopedProvider("user-bob", connUser1.id),
      ).rejects.toThrow(CalendarConnectionNotFoundError);
    });
  });

  describe("Provider Binding Path and Credential Access Control", () => {
    it("successfully binds a user-scoped provider for a CONNECTED connection", async () => {
      const conn = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        accountEmail: "user@domain.com",
        displayName: "Primary Calendar",
        status: "CONNECTED",
        credentials: {
          accessToken: "valid-secret-token",
          tokenType: "Bearer",
        },
      });

      const scopedProvider = await manager.getScopedProvider("user-1", conn.id);

      expect(scopedProvider.userId).toBe("user-1");
      expect(scopedProvider.connectionId).toBe(conn.id);
      expect(scopedProvider.id).toBe(`mock-cal-driver:${conn.id}`);
      expect(scopedProvider.name).toContain("Mock Driver");

      const boundCreds = scopedProvider.getBoundCredentials();
      expect(boundCreds.accessToken).toBe("valid-secret-token");

      // Verify capabilities are mirrored
      expect(scopedProvider.capabilities.supportsRecurring).toBe(true);
    });

    it("does NOT mutate or register the user-scoped provider in the global registry", async () => {
      const conn = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        credentials: { accessToken: "token-abc" },
      });

      const scopedProvider = await manager.getScopedProvider("user-1", conn.id);
      expect(scopedProvider).toBeDefined();

      // Verify registry still ONLY contains the base driver
      expect(registry.list().length).toBe(1);
      expect(registry.has(scopedProvider.id)).toBe(false);
      expect(registry.get(scopedProvider.id)).toBeUndefined();
    });

    it("rejects provider binding when connection is in NEEDS_REAUTH state", async () => {
      const conn = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        status: "NEEDS_REAUTH",
        credentials: { accessToken: "expired-token" },
      });

      await expect(manager.getScopedProvider("user-1", conn.id)).rejects.toThrow(
        CalendarConnectionStateError,
      );
    });

    it("rejects provider binding when connection is in DISCONNECTED state", async () => {
      const conn = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        status: "DISCONNECTED",
        credentials: { accessToken: "disconnected-token" },
      });

      await expect(manager.getScopedProvider("user-1", conn.id)).rejects.toThrow(
        CalendarConnectionStateError,
      );
    });

    it("rejects provider binding when connection is in ERROR state", async () => {
      const conn = await manager.createConnection("user-1", {
        providerId: "mock-cal-driver",
        status: "ERROR",
        credentials: { accessToken: "bad-token" },
      });

      await expect(manager.getScopedProvider("user-1", conn.id)).rejects.toThrow(
        CalendarConnectionStateError,
      );
    });
  });

  describe("Concurrent Connections for Different Users", () => {
    it("handles multiple concurrent connections independently without crosstalk", async () => {
      const users = ["user-alpha", "user-beta", "user-gamma"];

      const createdConnections = await Promise.all(
        users.map((uid) =>
          manager.createConnection(uid, {
            providerId: "mock-cal-driver",
            accountEmail: `${uid}@test.local`,
            credentials: { accessToken: `token-for-${uid}` },
          }),
        ),
      );

      // Verify each user only sees their own connection
      for (let i = 0; i < users.length; i++) {
        const uid = users[i];
        const conn = createdConnections[i];

        const userList = await manager.listConnections(uid);
        expect(userList.length).toBe(1);
        expect(userList[0].id).toBe(conn.id);

        const scopedProvider = await manager.getScopedProvider(uid, conn.id);
        expect(scopedProvider.getBoundCredentials().accessToken).toBe(`token-for-${uid}`);
      }
    });
  });
});
