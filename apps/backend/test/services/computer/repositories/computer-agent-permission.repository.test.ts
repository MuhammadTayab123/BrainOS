import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../src/errors";
import { ComputerAgentPermissionRepository } from "../../../../src/services/computer/repositories/computer-agent-permission.repository";

describe("ComputerAgentPermissionRepository", () => {
  describe("grantPermission", () => {
    it("creates a new permission when no previous permission exists (missing grant -> create)", async () => {
      const findFirstAgent = vi.fn().mockResolvedValue({
        id: "agent-1",
        status: "ACTIVE",
      });
      const findFirstPerm = vi.fn().mockResolvedValue(null);
      const createPerm = vi.fn().mockResolvedValue({
        id: "perm-1",
        agentId: "agent-1",
        action: "computer_write_file",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const db = {
        computerAgent: {
          findFirst: findFirstAgent,
        },
        computerAgentPermission: {
          findFirst: findFirstPerm,
          create: createPerm,
        },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.grantPermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(findFirstAgent).toHaveBeenCalledWith({
        where: { id: "agent-1", userId: "user-1", deletedAt: null },
        select: { id: true, status: true },
      });
      expect(createPerm).toHaveBeenCalledWith({
        data: {
          agentId: "agent-1",
          action: "computer_write_file",
        },
        select: expect.any(Object),
      });
      expect(result.id).toBe("perm-1");
      expect(result.deletedAt).toBeNull();
    });

    it("returns existing active permission without duplicate insert (active grant -> no-op)", async () => {
      const findFirstAgent = vi.fn().mockResolvedValue({
        id: "agent-1",
        status: "ACTIVE",
      });
      const existingActive = {
        id: "perm-existing",
        agentId: "agent-1",
        action: "computer_write_file",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const findFirstPerm = vi.fn().mockResolvedValue(existingActive);
      const createPerm = vi.fn();
      const updatePerm = vi.fn();

      const db = {
        computerAgent: {
          findFirst: findFirstAgent,
        },
        computerAgentPermission: {
          findFirst: findFirstPerm,
          create: createPerm,
          update: updatePerm,
        },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.grantPermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(createPerm).not.toHaveBeenCalled();
      expect(updatePerm).not.toHaveBeenCalled();
      expect(result.id).toBe("perm-existing");
    });

    it("reactivates a soft-deleted permission (soft-deleted grant -> reactivate)", async () => {
      const findFirstAgent = vi.fn().mockResolvedValue({
        id: "agent-1",
        status: "ACTIVE",
      });
      const existingDeleted = {
        id: "perm-old",
        agentId: "agent-1",
        action: "computer_write_file",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date("2026-09-01"),
      };
      const findFirstPerm = vi.fn().mockResolvedValue(existingDeleted);
      const updatePerm = vi.fn().mockResolvedValue({
        ...existingDeleted,
        deletedAt: null,
      });

      const db = {
        computerAgent: {
          findFirst: findFirstAgent,
        },
        computerAgentPermission: {
          findFirst: findFirstPerm,
          update: updatePerm,
        },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.grantPermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(updatePerm).toHaveBeenCalledWith({
        where: { id: "perm-old" },
        data: {
          deletedAt: null,
          updatedAt: expect.any(Date),
        },
        select: expect.any(Object),
      });
      expect(result.id).toBe("perm-old");
      expect(result.deletedAt).toBeNull();
    });

    it("throws NotFoundError when granting to a non-existent or unowned agent", async () => {
      const db = {
        computerAgent: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      await expect(
        repository.grantPermission({
          agentId: "agent-missing",
          userId: "user-1",
          action: "computer_write_file",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws Error when granting to a revoked/inactive agent", async () => {
      const db = {
        computerAgent: {
          findFirst: vi.fn().mockResolvedValue({
            id: "agent-1",
            status: "REVOKED",
          }),
        },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      await expect(
        repository.grantPermission({
          agentId: "agent-1",
          userId: "user-1",
          action: "computer_write_file",
        }),
      ).rejects.toThrow(
        "Cannot grant permissions for an inactive or revoked agent.",
      );
    });

    it("executes inside $transaction when available", async () => {
      const findFirstAgent = vi.fn().mockResolvedValue({
        id: "agent-1",
        status: "ACTIVE",
      });
      const findFirstPerm = vi.fn().mockResolvedValue(null);
      const createPerm = vi.fn().mockResolvedValue({
        id: "perm-1",
        agentId: "agent-1",
        action: "computer_write_file",
        deletedAt: null,
      });

      const txClient = {
        computerAgent: { findFirst: findFirstAgent },
        computerAgentPermission: { findFirst: findFirstPerm, create: createPerm },
      };

      const db = {
        $transaction: vi.fn(async (cb: any) => cb(txClient)),
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.grantPermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe("perm-1");
    });

    it("recovers from concurrent P2002 unique constraint conflicts by returning active permission", async () => {
      const findFirstAgent = vi.fn().mockResolvedValue({
        id: "agent-1",
        status: "ACTIVE",
      });
      // Initial check didn't see permission (race condition)
      const findFirstPerm = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "perm-concurrent",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        });

      const p2002Error = new Error("Unique constraint failed");
      (p2002Error as any).code = "P2002";

      const createPerm = vi.fn().mockRejectedValue(p2002Error);

      const db = {
        computerAgent: {
          findFirst: findFirstAgent,
        },
        computerAgentPermission: {
          findFirst: findFirstPerm,
          create: createPerm,
        },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.grantPermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(createPerm).toHaveBeenCalled();
      expect(findFirstPerm).toHaveBeenCalledTimes(2);
      expect(result.id).toBe("perm-concurrent");
      expect(result.deletedAt).toBeNull();
    });
  });

  describe("revokePermission", () => {
    it("soft-deletes an active permission for an owned agent", async () => {
      const findFirstAgent = vi.fn().mockResolvedValue({ id: "agent-1" });
      const updateManyPerm = vi.fn().mockResolvedValue({ count: 1 });

      const db = {
        computerAgent: { findFirst: findFirstAgent },
        computerAgentPermission: { updateMany: updateManyPerm },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);
      const revokedAt = new Date("2026-09-05T12:00:00.000Z");

      await repository.revokePermission(
        {
          agentId: "agent-1",
          userId: "user-1",
          action: "computer_write_file",
        },
        revokedAt,
      );

      expect(updateManyPerm).toHaveBeenCalledWith({
        where: {
          agentId: "agent-1",
          action: "computer_write_file",
          deletedAt: null,
        },
        data: {
          deletedAt: revokedAt,
        },
      });
    });

    it("throws NotFoundError when revoking for unowned agent", async () => {
      const db = {
        computerAgent: { findFirst: vi.fn().mockResolvedValue(null) },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      await expect(
        repository.revokePermission({
          agentId: "agent-1",
          userId: "user-other",
          action: "computer_write_file",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError when permission is not found or already revoked", async () => {
      const db = {
        computerAgent: { findFirst: vi.fn().mockResolvedValue({ id: "agent-1" }) },
        computerAgentPermission: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      await expect(
        repository.revokePermission({
          agentId: "agent-1",
          userId: "user-1",
          action: "computer_write_file",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("listPermissions", () => {
    it("lists active permissions for an owned agent", async () => {
      const permissions = [
        { id: "p-1", agentId: "agent-1", action: "computer_launch_application" },
        { id: "p-2", agentId: "agent-1", action: "computer_write_file" },
      ];

      const db = {
        computerAgent: { findFirst: vi.fn().mockResolvedValue({ id: "agent-1" }) },
        computerAgentPermission: { findMany: vi.fn().mockResolvedValue(permissions) },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.listPermissions({
        agentId: "agent-1",
        userId: "user-1",
      });

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe("computer_launch_application");
      expect(result[1].action).toBe("computer_write_file");
    });

    it("throws NotFoundError when listing permissions for unowned agent", async () => {
      const db = {
        computerAgent: { findFirst: vi.fn().mockResolvedValue(null) },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      await expect(
        repository.listPermissions({
          agentId: "agent-1",
          userId: "user-other",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("hasActivePermission", () => {
    it("returns true when an active permission exists for active agent", async () => {
      const count = vi.fn().mockResolvedValue(1);
      const db = {
        computerAgentPermission: { count },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.hasActivePermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(count).toHaveBeenCalledWith({
        where: {
          agentId: "agent-1",
          action: "computer_write_file",
          deletedAt: null,
          agent: {
            id: "agent-1",
            userId: "user-1",
            status: "ACTIVE",
            deletedAt: null,
          },
        },
      });
      expect(result).toBe(true);
    });

    it("returns false when no active permission exists", async () => {
      const count = vi.fn().mockResolvedValue(0);
      const db = {
        computerAgentPermission: { count },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);

      const result = await repository.hasActivePermission({
        agentId: "agent-1",
        userId: "user-1",
        action: "computer_write_file",
      });

      expect(result).toBe(false);
    });
  });

  describe("revokeAllByAgentId", () => {
    it("soft-deletes all active permissions for the given agentId", async () => {
      const updateMany = vi.fn().mockResolvedValue({ count: 3 });
      const db = {
        computerAgentPermission: { updateMany },
      } as any;

      const repository = new ComputerAgentPermissionRepository(db);
      const revokedAt = new Date("2026-09-05T12:00:00.000Z");

      await repository.revokeAllByAgentId("agent-1", revokedAt);

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          agentId: "agent-1",
          deletedAt: null,
        },
        data: {
          deletedAt: revokedAt,
        },
      });
    });
  });
});
