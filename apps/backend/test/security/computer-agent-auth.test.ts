import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ComputerAgentAuthService,
  generateAgentCredential,
  hashCredential,
  InMemoryComputerAgentCredentialStore,
  verifyCredential,
} from "../../src/services/computer/security/computer-agent-auth.service";

describe("ComputerAgent Authentication Contract", () => {
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe("credential generation", () => {
    it("credential generation produces non-empty unpredictable credentials", () => {
      const cred1 = generateAgentCredential();
      const cred2 = generateAgentCredential();
      const cred3 = generateAgentCredential(48);

      expect(typeof cred1).toBe("string");
      expect(cred1.length).toBeGreaterThan(32);
      expect(typeof cred2).toBe("string");
      expect(cred2.length).toBeGreaterThan(32);

      // Unpredictable: two consecutive random generations are never equal
      expect(cred1).not.toBe(cred2);

      // Custom length support
      expect(cred3.length).toBe(96); // 48 bytes -> 96 hex chars
    });

    it("rejects byte lengths below minimum security threshold", () => {
      expect(() => generateAgentCredential(8)).toThrow(
        "Credential byte length must be at least 16.",
      );
    });
  });

  describe("hashing contract", () => {
    it("hashing does not return the raw credential", () => {
      const rawCredential = generateAgentCredential();
      const hashed = hashCredential(rawCredential);

      expect(typeof hashed).toBe("string");
      expect(hashed).not.toBe(rawCredential);
      expect(hashed).not.toContain(rawCredential);

      // Contains salt and derived hash separated by colon
      const parts = hashed.split(":");
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBe(128); // 64 bytes in hex
    });

    it("produces distinct hashes for the same credential due to random salting", () => {
      const rawCredential = generateAgentCredential();
      const hash1 = hashCredential(rawCredential);
      const hash2 = hashCredential(rawCredential);

      expect(hash1).not.toBe(hash2);
      // Both verify against the same raw credential
      expect(verifyCredential(rawCredential, hash1)).toBe(true);
      expect(verifyCredential(rawCredential, hash2)).toBe(true);
    });

    it("rejects empty or non-string inputs to hashCredential", () => {
      expect(() => hashCredential("")).toThrow(
        "Credential must be a non-empty string.",
      );
      expect(() => hashCredential(null as unknown as string)).toThrow(
        "Credential must be a non-empty string.",
      );
      expect(() => hashCredential("secret", "")).toThrow(
        "Salt must be a non-empty string.",
      );
    });
  });

  describe("verification and authentication", () => {
    it("valid credential verifies successfully", async () => {
      const credential = generateAgentCredential();
      const hash = hashCredential(credential);

      expect(verifyCredential(credential, hash)).toBe(true);

      const store = new InMemoryComputerAgentCredentialStore();
      const authService = new ComputerAgentAuthService(store, mockLogger as any);

      authService.registerAgentHash("agent-alpha", hash);

      const result = await authService.authenticate({
        agentId: "agent-alpha",
        credential,
      });

      expect(result.authenticated).toBe(true);
    });

    it("invalid credential fails", async () => {
      const credential = generateAgentCredential();
      const hash = hashCredential(credential);

      expect(verifyCredential("wrong-credential", hash)).toBe(false);

      const store = new InMemoryComputerAgentCredentialStore();
      const authService = new ComputerAgentAuthService(store, mockLogger as any);

      authService.registerAgentHash("agent-alpha", hash);

      const result = await authService.authenticate({
        agentId: "agent-alpha",
        credential: "completely-incorrect-secret",
      });

      expect(result.authenticated).toBe(false);
      if (!result.authenticated) {
        expect(result.reason).toBe("Invalid credentials");
      }
    });

    it("malformed/empty credentials fail closed", async () => {
      const credential = generateAgentCredential();
      const hash = hashCredential(credential);

      // Primitive verification fails closed
      expect(verifyCredential("", hash)).toBe(false);
      expect(verifyCredential(null, hash)).toBe(false);
      expect(verifyCredential(undefined, hash)).toBe(false);
      expect(verifyCredential(12345, hash)).toBe(false);
      expect(verifyCredential(credential, "")).toBe(false);
      expect(verifyCredential(credential, null)).toBe(false);
      expect(verifyCredential(credential, "invalid-hash-string-no-colon")).toBe(false);
      expect(verifyCredential(credential, "salt-only:")).toBe(false);
      expect(verifyCredential(credential, ":hash-only")).toBe(false);
      expect(verifyCredential(credential, "salt:tooshort")).toBe(false);
      expect(verifyCredential(credential, "salt:non-hex-characters-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe(false);

      // Service authentication fails closed
      const store = new InMemoryComputerAgentCredentialStore();
      const authService = new ComputerAgentAuthService(store, mockLogger as any);

      authService.registerAgentHash("agent-alpha", hash);

      expect((await authService.authenticate({ agentId: "", credential })).authenticated).toBe(false);
      expect((await authService.authenticate({ agentId: "agent-alpha", credential: "" })).authenticated).toBe(false);
      expect((await authService.authenticate({ agentId: "   ", credential })).authenticated).toBe(false);
      expect((await authService.authenticate(null)).authenticated).toBe(false);
      expect((await authService.authenticate(undefined)).authenticated).toBe(false);
      expect((await authService.authenticate({})).authenticated).toBe(false);
      expect((await authService.authenticate({ agentId: "nonexistent", credential })).authenticated).toBe(false);
    });

    it("different credentials do not verify against each other", () => {
      const credA = generateAgentCredential();
      const credB = generateAgentCredential();

      const hashA = hashCredential(credA);
      const hashB = hashCredential(credB);

      expect(verifyCredential(credA, hashA)).toBe(true);
      expect(verifyCredential(credB, hashB)).toBe(true);

      expect(verifyCredential(credA, hashB)).toBe(false);
      expect(verifyCredential(credB, hashA)).toBe(false);
    });

    it("authenticated result preserves the agentId", async () => {
      const store = new InMemoryComputerAgentCredentialStore();
      const authService = new ComputerAgentAuthService(store, mockLogger as any);

      const registered = authService.registerAgent("agent-desktop-42");

      expect(registered.agentId).toBe("agent-desktop-42");
      expect(registered.credential.length).toBeGreaterThan(16);

      const result = await authService.authenticate({
        agentId: "agent-desktop-42",
        credential: registered.credential,
      });

      expect(result).toEqual({
        authenticated: true,
        agentId: "agent-desktop-42",
      });

      // Also supports positional args authenticate(agentId, credential)
      const positionalResult = await authService.authenticate(
        "agent-desktop-42",
        registered.credential,
      );

      expect(positionalResult).toEqual({
        authenticated: true,
        agentId: "agent-desktop-42",
      });
    });

    it("raw credentials are not written to logs", async () => {
      const secretCredential = "raw-unhashed-secret-credential-do-not-leak-999";
      const hash = hashCredential(secretCredential);

      const store = new InMemoryComputerAgentCredentialStore();
      const authService = new ComputerAgentAuthService(store, mockLogger as any);

      authService.registerAgentHash("secret-agent", hash);

      // Successful auth attempt
      await authService.authenticate({
        agentId: "secret-agent",
        credential: secretCredential,
      });

      // Failed auth attempt
      await authService.authenticate({
        agentId: "secret-agent",
        credential: "another-sensitive-token-12345",
      });

      // Registration via service
      const newlyRegistered = authService.registerAgent("auto-agent");

      // Verify no log method received the raw credential strings
      const allLoggedCalls = [
        ...mockLogger.info.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls,
        ...mockLogger.debug.mock.calls,
      ];

      for (const call of allLoggedCalls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain(secretCredential);
        expect(serialized).not.toContain("another-sensitive-token-12345");
        expect(serialized).not.toContain(newlyRegistered.credential);
      }

      // Also ensure stored record only contains the hash, not the raw credential
      const stored = store.get("auto-agent");
      expect(stored).toBeDefined();
      expect(stored?.credentialHash).toBeDefined();
      expect(stored?.credentialHash).not.toContain(newlyRegistered.credential);
      expect((stored as any).credential).toBeUndefined();
    });
  });
});
