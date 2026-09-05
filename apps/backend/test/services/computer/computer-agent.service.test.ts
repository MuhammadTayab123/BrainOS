import { describe, expect, it, vi } from "vitest";

import { ComputerAgentStatus } from "@prisma/client";

import { NotFoundError } from "../../../src/errors";
import { ComputerAgentService } from "../../../src/services/computer/computer-agent.service";
import { hashCredential } from "../../../src/services/computer/security/computer-agent-auth.service";

describe("ComputerAgentService", () => {
  const createMockRepository = () => {
    return {
      create: vi.fn(),
      listByUser: vi.fn(),
      findByIdForUser: vi.fn(),
      findById: vi.fn(),
      revokeByIdForUser: vi.fn(),
      createCredential: vi.fn(),
      findActiveCredentialsByAgentId: vi.fn(),
      findActiveCredentials: vi.fn(),
      updateLastAuthenticatedAt: vi.fn(),
      softDeleteByIdForUser: vi.fn(),
    } as any;
  };

  const createMockLogger = () => {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any;
  };

  describe("registerAgent", () => {
    it("registers an agent and stores only the credential hash", async () => {
      const repository = createMockRepository();
      const logger = createMockLogger();

      const createdAgent = {
        id: "agent-1",
        userId: "user-1",
        name: "My Work Laptop",
        status: ComputerAgentStatus.ACTIVE,
        lastAuthenticatedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(createdAgent);
      repository.createCredential.mockResolvedValue({
        id: "cred-1",
        agentId: "agent-1",
        credentialHash: "scrypt:hash",
      });

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        logger,
      );

      const result = await service.registerAgent({
        userId: "user-1",
        name: "My Work Laptop",
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: "user-1",
        name: "My Work Laptop",
        id: undefined,
      });

      expect(repository.createCredential).toHaveBeenCalledWith({
        agentId: "agent-1",
        credentialHash: expect.stringMatching(/^[\da-f]+:[\da-f]+$/),
      });

      expect(result.agent).toEqual(createdAgent);
      expect(typeof result.credential).toBe("string");
      expect(result.credential.length).toBeGreaterThanOrEqual(32);

      // Verify logger never received the raw credential
      expect(logger.info).toHaveBeenCalledWith(
        "Registered computer agent",
        {
          agentId: "agent-1",
          userId: "user-1",
        },
      );
    });

    it("atomically creates agent and credential using createWithCredential", async () => {
      const repository = {
        ...createMockRepository(),
        createWithCredential: vi.fn(),
      };
      const logger = createMockLogger();

      const createdAgent = {
        id: "agent-1",
        userId: "user-1",
        name: "My Work Laptop",
        status: ComputerAgentStatus.ACTIVE,
        lastAuthenticatedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.createWithCredential.mockResolvedValue(createdAgent);

      const service = new ComputerAgentService(
        repository as any,
        undefined as any,
        logger,
      );

      const result = await service.registerAgent({
        userId: "user-1",
        name: "My Work Laptop",
      });

      expect(repository.createWithCredential).toHaveBeenCalledWith({
        userId: "user-1",
        name: "My Work Laptop",
        id: undefined,
        credentialHash: expect.stringMatching(/^[\da-f]+:[\da-f]+$/),
      });

      expect(result.agent).toEqual(createdAgent);
      expect(typeof result.credential).toBe("string");
      expect(result.credential.length).toBeGreaterThanOrEqual(32);
    });

    it("rejects registration with empty userId or name", async () => {
      const repository = createMockRepository();
      const service = new ComputerAgentService(repository);

      await expect(
        service.registerAgent({
          userId: "",
          name: "Laptop",
        }),
      ).rejects.toThrow("User ID is required.");

      await expect(
        service.registerAgent({
          userId: "user-1",
          name: "",
        }),
      ).rejects.toThrow("Computer agent name is required.");
    });
  });

  describe("rotateCredential", () => {
    it("rotates credential for an active agent without revoking previous", async () => {
      const repository = {
        ...createMockRepository(),
        revokeCredentialsByAgentId: vi.fn(),
      };
      const logger = createMockLogger();

      const agent = {
        id: "agent-1",
        userId: "user-1",
        name: "Laptop",
        status: ComputerAgentStatus.ACTIVE,
      };

      repository.findByIdForUser.mockResolvedValue(agent);
      repository.createCredential.mockResolvedValue({
        id: "cred-2",
        agentId: "agent-1",
        credentialHash: "scrypt:newhash",
      });

      const service = new ComputerAgentService(
        repository as any,
        undefined as any,
        logger,
      );

      const result = await service.rotateCredential("agent-1", "user-1");

      expect(repository.findByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-1",
      );
      expect(repository.revokeCredentialsByAgentId).not.toHaveBeenCalled();
      expect(repository.createCredential).toHaveBeenCalledWith({
        agentId: "agent-1",
        credentialHash: expect.stringMatching(/^[\da-f]+:[\da-f]+$/),
      });

      expect(result.agent).toEqual(agent);
      expect(typeof result.credential).toBe("string");
      expect(logger.info).toHaveBeenCalledWith(
        "Rotated computer agent credential",
        {
          agentId: "agent-1",
          userId: "user-1",
          revokedPrevious: false,
        },
      );
    });

    it("rotates credential and revokes previous credentials when requested", async () => {
      const repository = {
        ...createMockRepository(),
        revokeCredentialsByAgentId: vi.fn().mockResolvedValue(undefined),
      };
      const logger = createMockLogger();

      const agent = {
        id: "agent-1",
        userId: "user-1",
        name: "Laptop",
        status: ComputerAgentStatus.ACTIVE,
      };

      repository.findByIdForUser.mockResolvedValue(agent);
      repository.createCredential.mockResolvedValue({
        id: "cred-2",
        agentId: "agent-1",
        credentialHash: "scrypt:newhash",
      });

      const service = new ComputerAgentService(
        repository as any,
        undefined as any,
        logger,
      );

      const result = await service.rotateCredential("agent-1", "user-1", {
        revokePrevious: true,
      });

      expect(repository.revokeCredentialsByAgentId).toHaveBeenCalledWith(
        "agent-1",
      );
      expect(repository.createCredential).toHaveBeenCalledWith({
        agentId: "agent-1",
        credentialHash: expect.stringMatching(/^[\da-f]+:[\da-f]+$/),
      });
      expect(result.agent).toEqual(agent);
    });

    it("delegates to rotateCredentialForUser when available on repository", async () => {
      const agent = {
        id: "agent-1",
        userId: "user-1",
        name: "Laptop",
        status: ComputerAgentStatus.ACTIVE,
      };

      const repository = {
        ...createMockRepository(),
        rotateCredentialForUser: vi.fn().mockResolvedValue(agent),
      };
      const logger = createMockLogger();

      const service = new ComputerAgentService(
        repository as any,
        undefined as any,
        logger,
      );

      const result = await service.rotateCredential("agent-1", "user-1", {
        revokePrevious: true,
      });

      expect(repository.rotateCredentialForUser).toHaveBeenCalledWith({
        agentId: "agent-1",
        userId: "user-1",
        credentialHash: expect.stringMatching(/^[\da-f]+:[\da-f]+$/),
        revokePrevious: true,
      });

      expect(result.agent).toEqual(agent);
      expect(typeof result.credential).toBe("string");
      expect(result.credential.length).toBeGreaterThanOrEqual(32);

      // Verify no raw credential leaked to logger
      const loggedParams = JSON.stringify(logger.info.mock.calls);
      expect(loggedParams).not.toContain(result.credential);
    });

    it("rejects rotating credentials for a revoked agent", async () => {
      const repository = createMockRepository();
      const agent = {
        id: "agent-1",
        userId: "user-1",
        name: "Laptop",
        status: ComputerAgentStatus.REVOKED,
      };

      repository.findByIdForUser.mockResolvedValue(agent);

      const service = new ComputerAgentService(repository);

      await expect(
        service.rotateCredential("agent-1", "user-1"),
      ).rejects.toThrow(
        "Cannot rotate credentials for an inactive or revoked agent.",
      );
    });

    it("throws NotFoundError when rotating credentials for an unowned or missing agent", async () => {
      const repository = createMockRepository();
      repository.findByIdForUser.mockResolvedValue(null);

      const service = new ComputerAgentService(repository);

      await expect(
        service.rotateCredential("agent-1", "user-other"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("listAgents", () => {
    it("lists agents for a user", async () => {
      const repository = createMockRepository();
      const agents = [
        {
          id: "agent-1",
          userId: "user-1",
          name: "Laptop",
          status: ComputerAgentStatus.ACTIVE,
        },
      ];
      repository.listByUser.mockResolvedValue(agents);

      const service = new ComputerAgentService(repository);
      const result = await service.listAgents({
        userId: "user-1",
        limit: 10,
      });

      expect(repository.listByUser).toHaveBeenCalledWith({
        userId: "user-1",
        limit: 10,
      });
      expect(result).toEqual(agents);
    });

    it("throws when limit is out of range", async () => {
      const repository = createMockRepository();
      const service = new ComputerAgentService(repository);

      await expect(
        service.listAgents({
          userId: "user-1",
          limit: 100,
        }),
      ).rejects.toThrow("Agent list limit must be an integer between 1 and 50.");
    });
  });

  describe("getAgent", () => {
    it("returns agent owned by user", async () => {
      const repository = createMockRepository();
      const agent = {
        id: "agent-1",
        userId: "user-1",
        name: "Laptop",
        status: ComputerAgentStatus.ACTIVE,
      };
      repository.findByIdForUser.mockResolvedValue(agent);

      const service = new ComputerAgentService(repository);
      const result = await service.getAgent("agent-1", "user-1");

      expect(repository.findByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-1",
      );
      expect(result).toEqual(agent);
    });

    it("throws NotFoundError when agent is missing", async () => {
      const repository = createMockRepository();
      repository.findByIdForUser.mockResolvedValue(null);

      const service = new ComputerAgentService(repository);

      await expect(
        service.getAgent("agent-1", "user-1"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("revokeAgent and deleteAgent", () => {
    it("revokes an agent owned by user", async () => {
      const repository = createMockRepository();
      const logger = createMockLogger();
      repository.revokeByIdForUser.mockResolvedValue(undefined);

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        logger,
      );

      await service.revokeAgent("agent-1", "user-1");

      expect(repository.revokeByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-1",
      );
      expect(logger.info).toHaveBeenCalledWith("Revoked computer agent", {
        agentId: "agent-1",
        userId: "user-1",
      });
    });

    it("soft deletes an agent owned by user", async () => {
      const repository = createMockRepository();
      const logger = createMockLogger();
      repository.softDeleteByIdForUser.mockResolvedValue(undefined);

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        logger,
      );

      await service.deleteAgent("agent-1", "user-1");

      expect(repository.softDeleteByIdForUser).toHaveBeenCalledWith(
        "agent-1",
        "user-1",
      );
      expect(logger.info).toHaveBeenCalledWith("Deleted computer agent", {
        agentId: "agent-1",
        userId: "user-1",
      });
    });
  });

  describe("authenticateAgent", () => {
    it("fails closed on invalid or missing payload", async () => {
      const repository = createMockRepository();
      const service = new ComputerAgentService(repository);

      const res1 = await service.authenticateAgent("", "cred");
      expect(res1).toEqual({
        authenticated: false,
        reason: "Invalid or missing credentials",
      });

      const res2 = await service.authenticateAgent("agent-1", "");
      expect(res2).toEqual({
        authenticated: false,
        reason: "Invalid or missing credentials",
      });
    });

    it("fails when agent does not exist", async () => {
      const repository = createMockRepository();
      repository.findById.mockResolvedValue(null);

      const service = new ComputerAgentService(repository);
      const res = await service.authenticateAgent("unknown-agent", "some-credential");

      expect(res).toEqual({
        authenticated: false,
        reason: "Unknown agent ID",
      });
    });

    it("fails when agent is revoked", async () => {
      const repository = createMockRepository();
      repository.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-1",
        name: "Revoked Laptop",
        status: ComputerAgentStatus.REVOKED,
      });

      const service = new ComputerAgentService(repository);
      const res = await service.authenticateAgent("agent-1", "some-credential");

      expect(res).toEqual({
        authenticated: false,
        reason: "Agent is revoked or inactive",
      });
      expect(repository.findActiveCredentialsByAgentId).not.toHaveBeenCalled();
    });

    it("fails when agent has no active credentials", async () => {
      const repository = createMockRepository();
      repository.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-1",
        name: "Active Laptop",
        status: ComputerAgentStatus.ACTIVE,
      });
      repository.findActiveCredentialsByAgentId.mockResolvedValue([]);

      const service = new ComputerAgentService(repository);
      const res = await service.authenticateAgent("agent-1", "some-credential");

      expect(res).toEqual({
        authenticated: false,
        reason: "Invalid credentials",
      });
    });

    it("fails when candidate credential does not match stored hash", async () => {
      const repository = createMockRepository();
      const validCredential = "valid-secret-credential";
      const validHash = hashCredential(validCredential);

      repository.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-1",
        name: "Active Laptop",
        status: ComputerAgentStatus.ACTIVE,
      });
      repository.findActiveCredentialsByAgentId.mockResolvedValue([
        {
          id: "cred-1",
          agentId: "agent-1",
          credentialHash: validHash,
        },
      ]);

      const service = new ComputerAgentService(repository);
      const res = await service.authenticateAgent("agent-1", "wrong-secret-credential");

      expect(res).toEqual({
        authenticated: false,
        reason: "Invalid credentials",
      });
      expect(repository.updateLastAuthenticatedAt).not.toHaveBeenCalled();
    });

    it("authenticates successfully with valid credential and updates lastAuthenticatedAt", async () => {
      const repository = createMockRepository();
      const logger = createMockLogger();
      const rawCredential = "super-secret-agent-credential";
      const credentialHash = hashCredential(rawCredential);

      repository.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-1",
        name: "Active Laptop",
        status: ComputerAgentStatus.ACTIVE,
      });
      repository.findActiveCredentialsByAgentId.mockResolvedValue([
        {
          id: "cred-1",
          agentId: "agent-1",
          credentialHash,
        },
      ]);
      repository.updateLastAuthenticatedAt.mockResolvedValue(undefined);

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        logger,
      );

      const res = await service.authenticateAgent({
        agentId: "agent-1",
        credential: rawCredential,
      });

      expect(res).toEqual({
        authenticated: true,
        agentId: "agent-1",
      });
      expect(repository.updateLastAuthenticatedAt).toHaveBeenCalledWith("agent-1");
      expect(logger.info).toHaveBeenCalledWith(
        "Computer agent authenticated successfully",
        {
          agentId: "agent-1",
        },
      );
    });

    it("supports credential rotation by matching against multiple active credentials", async () => {
      const repository = createMockRepository();
      const oldCredential = "old-agent-credential";
      const newCredential = "new-agent-credential";

      const oldHash = hashCredential(oldCredential);
      const newHash = hashCredential(newCredential);

      repository.findById.mockResolvedValue({
        id: "agent-1",
        userId: "user-1",
        name: "Active Laptop",
        status: ComputerAgentStatus.ACTIVE,
      });
      repository.findActiveCredentialsByAgentId.mockResolvedValue([
        {
          id: "cred-2",
          agentId: "agent-1",
          credentialHash: newHash,
        },
        {
          id: "cred-1",
          agentId: "agent-1",
          credentialHash: oldHash,
        },
      ]);
      repository.updateLastAuthenticatedAt.mockResolvedValue(undefined);

      const service = new ComputerAgentService(repository);

      const resOld = await service.authenticateAgent("agent-1", oldCredential);
      expect(resOld).toEqual({
        authenticated: true,
        agentId: "agent-1",
      });

      const resNew = await service.authenticateAgent("agent-1", newCredential);
      expect(resNew).toEqual({
        authenticated: true,
        agentId: "agent-1",
      });
    });
  });

  describe("Permissions Management (grantPermission, revokePermission, listPermissions)", () => {
    const createMockPermRepo = () => ({
      grantPermission: vi.fn(),
      revokePermission: vi.fn(),
      listPermissions: vi.fn(),
      hasActivePermission: vi.fn(),
      revokeAllByAgentId: vi.fn(),
    });

    it("grants permission to an agent", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const logger = createMockLogger();

      const permRecord = {
        id: "perm-1",
        agentId: "agent-1",
        action: "computer_write_file",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      permRepo.grantPermission.mockResolvedValue(permRecord);

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        logger,
        permRepo as any,
      );

      const result = await service.grantPermission(
        "agent-1",
        "user-1",
        "computer_write_file",
      );

      expect(permRepo.grantPermission).toHaveBeenCalledWith({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });
      expect(result).toEqual(permRecord);
      expect(logger.info).toHaveBeenCalledWith(
        "Granted computer agent permission",
        {
          agentId: "agent-1",
          userId: "user-1",
          action: "computer_write_file",
        },
      );
    });

    it("revokes permission from an agent", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const logger = createMockLogger();
      permRepo.revokePermission.mockResolvedValue(undefined);

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        logger,
        permRepo as any,
      );

      await service.revokePermission(
        "agent-1",
        "user-1",
        "computer_write_file",
      );

      expect(permRepo.revokePermission).toHaveBeenCalledWith({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });
      expect(logger.info).toHaveBeenCalledWith(
        "Revoked computer agent permission",
        {
          agentId: "agent-1",
          userId: "user-1",
          action: "computer_write_file",
        },
      );
    });

    it("lists active permissions for an agent", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const permissions = [
        { id: "p-1", agentId: "agent-1", action: "computer_launch_application" },
      ];
      permRepo.listPermissions.mockResolvedValue(permissions);

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        undefined as any,
        permRepo as any,
      );

      const result = await service.listPermissions("agent-1", "user-1");

      expect(permRepo.listPermissions).toHaveBeenCalledWith({
        agentId: "agent-1",
        userId: "user-1",
      });
      expect(result).toEqual(permissions);
    });

    it("rejects permission grant with read-only actions (read-only grant rejected)", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const service = new ComputerAgentService(
        repository,
        undefined as any,
        undefined as any,
        permRepo as any,
      );

      await expect(
        service.grantPermission("agent-1", "user-1", "computer_read_file"),
      ).rejects.toThrow(
        'Action "computer_read_file" is read-only and does not require or support persistent permissions.',
      );

      await expect(
        service.grantPermission("agent-1", "user-1", "computer_get_status"),
      ).rejects.toThrow(
        'Action "computer_get_status" is read-only and does not require or support persistent permissions.',
      );

      await expect(
        service.grantPermission("agent-1", "user-1", "computer_list_files"),
      ).rejects.toThrow(
        'Action "computer_list_files" is read-only and does not require or support persistent permissions.',
      );

      await expect(
        service.grantPermission("agent-1", "user-1", "computer_list_applications"),
      ).rejects.toThrow(
        'Action "computer_list_applications" is read-only and does not require or support persistent permissions.',
      );

      expect(permRepo.grantPermission).not.toHaveBeenCalled();
    });

    it("rejects permission revoke with read-only actions", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const service = new ComputerAgentService(
        repository,
        undefined as any,
        undefined as any,
        permRepo as any,
      );

      await expect(
        service.revokePermission("agent-1", "user-1", "computer_read_file"),
      ).rejects.toThrow(
        'Action "computer_read_file" is read-only and does not require or support persistent permissions.',
      );

      expect(permRepo.revokePermission).not.toHaveBeenCalled();
    });

    it("rejects permission grant and revoke with unknown action name", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const service = new ComputerAgentService(
        repository,
        undefined as any,
        undefined as any,
        permRepo as any,
      );

      await expect(
        service.grantPermission("agent-1", "user-1", "unknown_action"),
      ).rejects.toThrow('Unknown or unregistered computer action "unknown_action".');

      await expect(
        service.revokePermission("agent-1", "user-1", "unknown_action"),
      ).rejects.toThrow('Unknown or unregistered computer action "unknown_action".');

      expect(permRepo.grantPermission).not.toHaveBeenCalled();
      expect(permRepo.revokePermission).not.toHaveBeenCalled();
    });

    it("successfully grants privileged actions (computer_write_file and computer_launch_application)", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      permRepo.grantPermission.mockResolvedValue({
        id: "perm-launch",
        agentId: "agent-1",
        action: "computer_launch_application",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const service = new ComputerAgentService(
        repository,
        undefined as any,
        undefined as any,
        permRepo as any,
      );

      const result = await service.grantPermission(
        "agent-1",
        "user-1",
        "computer_launch_application",
      );

      expect(permRepo.grantPermission).toHaveBeenCalledWith({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_launch_application",
      });
      expect(result.action).toBe("computer_launch_application");
    });

    it("rejects permission grant with empty userId or agentId", async () => {
      const repository = createMockRepository();
      const permRepo = createMockPermRepo();
      const service = new ComputerAgentService(
        repository,
        undefined as any,
        undefined as any,
        permRepo as any,
      );

      await expect(
        service.grantPermission("agent-1", "", "computer_write_file"),
      ).rejects.toThrow("User ID is required.");

      await expect(
        service.grantPermission("", "user-1", "computer_write_file"),
      ).rejects.toThrow("Agent ID is required.");
    });
  });
});
