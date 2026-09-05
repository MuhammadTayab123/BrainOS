import { describe, expect, it, vi, beforeEach } from "vitest";
import { ComputerAgentPermissionRepository } from "../../../../src/services/computer/repositories/computer-agent-permission.repository";
import {
  ComputerActionName,
  ComputerAgentActionAuthorizer,
  ComputerAgentActionContext,
  PrismaComputerActionPermissionProvider,
} from "../../../../src/services/computer/dispatch";

describe("PrismaComputerActionPermissionProvider", () => {
  let mockRepo: ComputerAgentPermissionRepository;
  let provider: PrismaComputerActionPermissionProvider;

  const validContext: ComputerAgentActionContext = {
    agentId: "agent-123",
    userId: "user-456",
  };

  beforeEach(() => {
    mockRepo = {
      hasActivePermission: vi.fn().mockResolvedValue(true),
      grantPermission: vi.fn(),
      revokePermission: vi.fn(),
      listPermissions: vi.fn(),
      revokeAllByAgentId: vi.fn(),
    } as unknown as ComputerAgentPermissionRepository;

    provider = new PrismaComputerActionPermissionProvider(mockRepo);
  });

  describe("isActionPermitted unit validation", () => {
    it("returns true when permission repository confirms active grant", async () => {
      const permitted = await provider.isActionPermitted(
        ComputerActionName.WRITE_FILE,
        validContext,
      );

      expect(mockRepo.hasActivePermission).toHaveBeenCalledWith({
        agentId: "agent-123",
        userId: "user-456",
        action: "computer_write_file",
      });
      expect(permitted).toBe(true);
    });

    it("returns false when permission repository returns false", async () => {
      (mockRepo.hasActivePermission as any).mockResolvedValueOnce(false);

      const permitted = await provider.isActionPermitted(
        ComputerActionName.WRITE_FILE,
        validContext,
      );

      expect(permitted).toBe(false);
    });

    it("fails closed on invalid context anomalies", async () => {
      expect(
        await provider.isActionPermitted(ComputerActionName.WRITE_FILE, null as any),
      ).toBe(false);

      expect(
        await provider.isActionPermitted(ComputerActionName.WRITE_FILE, {
          agentId: "",
          userId: "user-1",
        }),
      ).toBe(false);

      expect(
        await provider.isActionPermitted(ComputerActionName.WRITE_FILE, {
          agentId: "agent-1",
          userId: "   ",
        }),
      ).toBe(false);

      expect(
        await provider.isActionPermitted("", validContext),
      ).toBe(false);

      expect(mockRepo.hasActivePermission).not.toHaveBeenCalled();
    });

    it("fails closed when database query throws an error", async () => {
      (mockRepo.hasActivePermission as any).mockRejectedValueOnce(
        new Error("Database connection timeout"),
      );

      const permitted = await provider.isActionPermitted(
        ComputerActionName.WRITE_FILE,
        validContext,
      );

      expect(permitted).toBe(false);
    });
  });

  describe("Integration with ComputerAgentActionAuthorizer", () => {
    it("authorizes read-only actions WITHOUT checking database provider", async () => {
      const authorizer = new ComputerAgentActionAuthorizer({
        permissionProvider: provider,
      });

      const decision = await authorizer.authorize(
        ComputerActionName.GET_STATUS,
        validContext,
      );

      expect(decision.authorized).toBe(true);
      expect(decision.authorizationRequired).toBe(false);
      expect(mockRepo.hasActivePermission).not.toHaveBeenCalled();
    });

    it("authorizes privileged action when persistent provider returns true", async () => {
      const authorizer = new ComputerAgentActionAuthorizer({
        permissionProvider: provider,
      });

      const decision = await authorizer.authorize(
        ComputerActionName.LAUNCH_APPLICATION,
        validContext,
      );

      expect(decision.authorized).toBe(true);
      expect(decision.authorizationRequired).toBe(true);
      expect(mockRepo.hasActivePermission).toHaveBeenCalledWith({
        agentId: "agent-123",
        userId: "user-456",
        action: "computer_launch_application",
      });
    });

    it("denies privileged action and logs audit when persistent provider returns false", async () => {
      (mockRepo.hasActivePermission as any).mockResolvedValueOnce(false);

      const authorizer = new ComputerAgentActionAuthorizer({
        permissionProvider: provider,
      });

      const decision = await authorizer.authorize(
        ComputerActionName.WRITE_FILE,
        validContext,
      );

      expect(decision.authorized).toBe(false);
      expect(decision.status).toBe("UNAUTHORIZED");
      expect(decision.reason).toContain("requires authorization");
    });
  });
});
