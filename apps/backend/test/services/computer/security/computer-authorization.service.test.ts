import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ComputerAuthorizationService,
  DefaultComputerAuthorizationService,
} from "../../../../src/services/computer/security/computer-authorization.service";
import { ComputerAgentRepository } from "../../../../src/services/computer/repositories/computer-agent.repository";
import { ComputerAgentPermissionRepository } from "../../../../src/services/computer/repositories/computer-agent-permission.repository";
import { ComputerAgentRecord } from "../../../../src/services/computer/computer-agent.types";

describe("DefaultComputerAuthorizationService", () => {
  let mockAgentRepo: ComputerAgentRepository;
  let mockPermissionRepo: ComputerAgentPermissionRepository;
  let service: ComputerAuthorizationService;

  const validAgent: ComputerAgentRecord = {
    id: "agent-1",
    userId: "user-1",
    name: "MacBook Pro",
    status: "ACTIVE",
    lastAuthenticatedAt: new Date(),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    mockAgentRepo = {
      listByUser: vi.fn(),
      findByIdForUser: vi.fn(),
      findById: vi.fn(),
    } as unknown as ComputerAgentRepository;

    mockPermissionRepo = {
      listPermissions: vi.fn(),
      hasActivePermission: vi.fn(),
    } as unknown as ComputerAgentPermissionRepository;

    service = new DefaultComputerAuthorizationService(
      mockAgentRepo,
      mockPermissionRepo,
    );
  });

  describe("resolveActiveAgent", () => {
    it("returns null for empty or invalid userId", async () => {
      expect(await service.resolveActiveAgent("")).toBeNull();
      expect(await service.resolveActiveAgent("   ")).toBeNull();
      expect(await service.resolveActiveAgent(null as unknown as string)).toBeNull();
    });

    it("returns null when user has 0 active agents", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([]);

      const agent = await service.resolveActiveAgent("user-1");

      expect(agent).toBeNull();
      expect(mockAgentRepo.listByUser).toHaveBeenCalledWith({
        userId: "user-1",
        status: "ACTIVE",
      });
    });

    it("returns the agent when user has exactly 1 active agent", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);

      const agent = await service.resolveActiveAgent("user-1");

      expect(agent).toEqual(validAgent);
    });

    it("fails closed (returns null) when user has multiple (>1) active agents without target specification", async () => {
      const secondAgent: ComputerAgentRecord = {
        ...validAgent,
        id: "agent-2",
        name: "Windows Desktop",
      };
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([
        validAgent,
        secondAgent,
      ]);

      const agent = await service.resolveActiveAgent("user-1");

      expect(agent).toBeNull();
    });

    it("fails closed (returns null) on database query errors", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockRejectedValueOnce(
        new Error("Database connection lost"),
      );

      const agent = await service.resolveActiveAgent("user-1");

      expect(agent).toBeNull();
    });
  });

  describe("resolveServerGrantedActions", () => {
    it("returns empty array if user has no active agent", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([]);

      const actions = await service.resolveServerGrantedActions("user-1");

      expect(actions).toEqual([]);
      expect(mockPermissionRepo.listPermissions).not.toHaveBeenCalled();
    });

    it("returns only recognized privileged actions that require authorization", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
        {
          id: "p1",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "p2",
          agentId: "agent-1",
          action: "computer_read_file", // Read-only, not an ACTION requiring authorization
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "p3",
          agentId: "agent-1",
          action: "unknown_custom_action", // Unknown tool
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "p4",
          agentId: "agent-1",
          action: "computer_launch_application",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const actions = await service.resolveServerGrantedActions("user-1");

      expect(actions).toEqual([
        "computer_write_file",
        "computer_launch_application",
      ]);
      expect(mockPermissionRepo.listPermissions).toHaveBeenCalledWith({
        agentId: "agent-1",
        userId: "user-1",
      });
    });

    it("fails closed on database error when listing permissions", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      vi.mocked(mockPermissionRepo.listPermissions).mockRejectedValueOnce(
        new Error("Permission query failed"),
      );

      const actions = await service.resolveServerGrantedActions("user-1");

      expect(actions).toEqual([]);
    });
  });

  describe("resolveEffectiveActions (Security Invariants & Intersections)", () => {
    it("returns empty array when requestedActions is empty or undefined", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
        {
          id: "p1",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      expect(await service.resolveEffectiveActions("user-1", [])).toEqual([]);
      expect(await service.resolveEffectiveActions("user-1", undefined)).toEqual([]);
    });

    it("denies client attempting to authorize computer_launch_application without DB permission", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      // DB only has computer_write_file, not computer_launch_application
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
        {
          id: "p1",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const effective = await service.resolveEffectiveActions("user-1", [
        "computer_launch_application",
      ]);

      expect(effective).toEqual([]);
    });

    it("denies client attempting to authorize computer_write_file without DB permission", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      // DB has no permissions
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([]);

      const effective = await service.resolveEffectiveActions("user-1", [
        "computer_write_file",
      ]);

      expect(effective).toEqual([]);
    });

    it("allows permitted action when client requests it", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
        {
          id: "p1",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const effective = await service.resolveEffectiveActions("user-1", [
        "computer_write_file",
      ]);

      expect(effective).toEqual(["computer_write_file"]);
    });

    it("enforces client subset: server grants both actions, client only requests one", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
        {
          id: "p1",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: "p2",
          agentId: "agent-1",
          action: "computer_launch_application",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const effective = await service.resolveEffectiveActions("user-1", [
        "computer_write_file",
      ]);

      expect(effective).toEqual(["computer_write_file"]);
    });

    it("denies when DB permission was revoked (deletedAt is set / missing from active)", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      // Repository only returns active permissions; revoked permission is not returned
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([]);

      const effective = await service.resolveEffectiveActions("user-1", [
        "computer_write_file",
      ]);

      expect(effective).toEqual([]);
    });

    it("denies when agent is owned by a different user", async () => {
      // User-2 has no agents in repository when queried for user-2
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([]);

      const effective = await service.resolveEffectiveActions("user-2", [
        "computer_write_file",
      ]);

      expect(effective).toEqual([]);
    });

    it("denies unknown computer actions requested by client", async () => {
      vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
      vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
        {
          id: "p1",
          agentId: "agent-1",
          action: "computer_write_file",
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const effective = await service.resolveEffectiveActions("user-1", [
        "nonexistent_computer_tool",
        "bash_shell_exec",
      ]);

      expect(effective).toEqual([]);
    });

    describe("auto-resolution when requestedActions is omitted (undefined)", () => {
      it("auto-resolves all server-granted actions for the single active agent", async () => {
        vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
        vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
          {
            id: "p1",
            agentId: "agent-1",
            action: "computer_write_file",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
          {
            id: "p2",
            agentId: "agent-1",
            action: "computer_launch_application",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ]);

        const effective = await service.resolveEffectiveActions("user-1", undefined);

        expect(effective).toEqual([
          "computer_write_file",
          "computer_launch_application",
        ]);
      });

      it("auto-resolves to empty array when user has 0 active agents", async () => {
        vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([]);

        const effective = await service.resolveEffectiveActions("user-1", undefined);

        expect(effective).toEqual([]);
      });

      it("fails closed (returns empty array) when user has multiple (>1) active agents", async () => {
        const secondAgent: ComputerAgentRecord = {
          ...validAgent,
          id: "agent-2",
          name: "Second Desktop",
        };
        vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([
          validAgent,
          secondAgent,
        ]);

        const effective = await service.resolveEffectiveActions("user-1", undefined);

        expect(effective).toEqual([]);
      });

      it("auto-resolves to empty array when active agent has no DB permissions", async () => {
        vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
        vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([]);

        const effective = await service.resolveEffectiveActions("user-1", undefined);

        expect(effective).toEqual([]);
      });

      it("returns empty array when client explicitly provides empty array []", async () => {
        vi.mocked(mockAgentRepo.listByUser).mockResolvedValueOnce([validAgent]);
        vi.mocked(mockPermissionRepo.listPermissions).mockResolvedValueOnce([
          {
            id: "p1",
            agentId: "agent-1",
            action: "computer_write_file",
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ]);

        const effective = await service.resolveEffectiveActions("user-1", []);

        expect(effective).toEqual([]);
      });

      it("fails closed (returns empty array) on database errors during auto-resolution", async () => {
        vi.mocked(mockAgentRepo.listByUser).mockRejectedValueOnce(
          new Error("DB error"),
        );

        const effective = await service.resolveEffectiveActions("user-1", undefined);

        expect(effective).toEqual([]);
      });
    });
  });
});
