import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderStatus } from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { ReminderRepository } from "../../src/services/reminders/repositories/reminder.repository";
import { ReminderService } from "../../src/services/reminders/reminder.service";
import {
  createCancelReminderTool,
  createCreateReminderTool,
  createGetReminderTool,
  createListRemindersTool,
  createReminderTools,
} from "../../src/services/tools/reminder.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolAuditService } from "../../src/services/security/tool-audit.service";
import {
  isComputerTool,
  requiresComputerAuthorization,
} from "../../src/services/security/computer-action.policy";

describe("Assistant Reminder Tools (Mission 44)", () => {
  let mockReminderRepository: {
    create: ReturnType<typeof vi.fn>;
    listByUser: ReturnType<typeof vi.fn>;
    findByIdForUser: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    softDeleteByIdForUser: ReturnType<typeof vi.fn>;
  };
  let reminderService: ReminderService;
  let mockAuditService: ToolAuditService;
  let toolExecutor: ToolExecutor;

  const USER_A = "user_alpha_123";
  const USER_B = "user_bravo_456";

  beforeEach(() => {
    mockReminderRepository = {
      create: vi.fn(),
      listByUser: vi.fn(),
      findByIdForUser: vi.fn(),
      cancel: vi.fn(),
      softDeleteByIdForUser: vi.fn(),
    };

    reminderService = new ReminderService(
      mockReminderRepository as unknown as ReminderRepository,
    );

    mockAuditService = {
      record: vi.fn(),
    } as unknown as ToolAuditService;

    const registry = createToolRegistry({
      reminderService,
    });

    toolExecutor = new ToolExecutor(registry, mockAuditService);
  });

  describe("1. Registration & Schema Validation", () => {
    it("registers all four reminder tools in ToolRegistry", () => {
      const registry = createToolRegistry({ reminderService });

      expect(registry.has("create_reminder")).toBe(true);
      expect(registry.has("list_reminders")).toBe(true);
      expect(registry.has("get_reminder")).toBe(true);
      expect(registry.has("cancel_reminder")).toBe(true);
    });

    it("exports valid LLM JSON schemas with descriptions and parameter specs", () => {
      const definitions = toolExecutor.getToolDefinitions();
      const toolNames = definitions.map((d) => d.name);

      expect(toolNames).toContain("create_reminder");
      expect(toolNames).toContain("list_reminders");
      expect(toolNames).toContain("get_reminder");
      expect(toolNames).toContain("cancel_reminder");

      const createDef = definitions.find((d) => d.name === "create_reminder")!;
      expect(createDef.description).toContain("Create a scheduled reminder");
      expect(createDef.parameters.type).toBe("object");
      expect(createDef.parameters.required).toEqual(["message", "scheduledFor"]);
      expect(createDef.parameters.properties).toHaveProperty("message");
      expect(createDef.parameters.properties).toHaveProperty("scheduledFor");
      expect(createDef.parameters.properties).toHaveProperty("taskId");

      const listDef = definitions.find((d) => d.name === "list_reminders")!;
      expect(listDef.description).toContain("List scheduled reminders");
      expect(listDef.parameters.type).toBe("object");
      expect(listDef.parameters.properties).toHaveProperty("status");
      expect(listDef.parameters.properties).toHaveProperty("dueBefore");
      expect(listDef.parameters.properties).toHaveProperty("limit");

      const getDef = definitions.find((d) => d.name === "get_reminder")!;
      expect(getDef.description).toContain("Get details of a specific reminder");
      expect(getDef.parameters.required).toEqual(["reminderId"]);
      expect(getDef.parameters.properties).toHaveProperty("reminderId");

      const cancelDef = definitions.find((d) => d.name === "cancel_reminder")!;
      expect(cancelDef.description).toContain("Cancel a pending scheduled reminder");
      expect(cancelDef.parameters.required).toEqual(["reminderId"]);
      expect(cancelDef.parameters.properties).toHaveProperty("reminderId");
    });

    it("verifies factory function createReminderTools returns all four tools", () => {
      const tools = createReminderTools(reminderService);
      expect(tools).toHaveLength(4);
      expect(tools.map((t) => t.name)).toEqual([
        "create_reminder",
        "list_reminders",
        "get_reminder",
        "cancel_reminder",
      ]);
    });
  });

  describe("2. create_reminder Tool Execution", () => {
    it("creates a reminder with server-derived context.userId", async () => {
      const scheduledDate = new Date("2026-09-06T10:00:00.000Z");
      const mockCreated = {
        id: "rem_001",
        userId: USER_A,
        message: "Prepare quarterly roadmap",
        scheduledFor: scheduledDate,
        taskId: "task_999",
        status: ReminderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReminderRepository.create.mockResolvedValue(mockCreated);

      const result = await toolExecutor.execute(
        "create_reminder",
        {
          message: "Prepare quarterly roadmap",
          scheduledFor: "2026-09-06T10:00:00.000Z",
          taskId: "task_999",
        },
        { userId: USER_A },
      );

      expect(mockReminderRepository.create).toHaveBeenCalledTimes(1);
      expect(mockReminderRepository.create).toHaveBeenCalledWith({
        userId: USER_A,
        message: "Prepare quarterly roadmap",
        scheduledFor: scheduledDate,
        taskId: "task_999",
      });
      expect(result).toEqual(mockCreated);
    });

    it("SECURITY: ignores client-spoofed userId in arguments and uses context.userId strictly", async () => {
      const scheduledDate = new Date("2026-09-06T10:00:00.000Z");
      mockReminderRepository.create.mockResolvedValue({
        id: "rem_spoof",
        userId: USER_A,
        message: "Legitimate reminder",
        scheduledFor: scheduledDate,
        status: ReminderStatus.PENDING,
      });

      await toolExecutor.execute(
        "create_reminder",
        {
          userId: "attacker_spoofed_user",
          message: "Legitimate reminder",
          scheduledFor: "2026-09-06T10:00:00.000Z",
        },
        { userId: USER_A },
      );

      expect(mockReminderRepository.create).toHaveBeenCalledWith({
        userId: USER_A,
        message: "Legitimate reminder",
        scheduledFor: scheduledDate,
        taskId: undefined,
      });
    });

    it("fails closed when context.userId is missing or empty", async () => {
      await expect(
        toolExecutor.execute(
          "create_reminder",
          {
            message: "Test reminder",
            scheduledFor: "2026-09-06T10:00:00.000Z",
          },
          { userId: "" },
        ),
      ).rejects.toThrow("User ID is required.");

      expect(mockReminderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects when input is not an object", async () => {
      await expect(
        toolExecutor.execute(
          "create_reminder",
          "invalid string input",
          { userId: USER_A },
        ),
      ).rejects.toThrow("Tool input must be an object.");

      expect(mockReminderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects when message is missing or empty", async () => {
      await expect(
        toolExecutor.execute(
          "create_reminder",
          {
            message: "   ",
            scheduledFor: "2026-09-06T10:00:00.000Z",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("message is required.");

      expect(mockReminderRepository.create).not.toHaveBeenCalled();
    });

    it("rejects when scheduledFor is missing or an invalid date string", async () => {
      await expect(
        toolExecutor.execute(
          "create_reminder",
          {
            message: "Call doctor",
            scheduledFor: "not-a-valid-date",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("scheduledFor must be a valid ISO date string.");

      await expect(
        toolExecutor.execute(
          "create_reminder",
          {
            message: "Call doctor",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("scheduledFor is required.");

      expect(mockReminderRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("3. list_reminders Tool Execution", () => {
    it("lists reminders scoped strictly to context.userId with optional filters", async () => {
      const dueBefore = new Date("2026-09-10T00:00:00.000Z");
      const mockReminders = [
        {
          id: "rem_1",
          userId: USER_A,
          message: "Check server metrics",
          status: ReminderStatus.PENDING,
          scheduledFor: new Date("2026-09-06T08:00:00.000Z"),
        },
      ];

      mockReminderRepository.listByUser.mockResolvedValue(mockReminders);

      const result = await toolExecutor.execute(
        "list_reminders",
        {
          status: ReminderStatus.PENDING,
          dueBefore: "2026-09-10T00:00:00.000Z",
          limit: 10,
        },
        { userId: USER_A },
      );

      expect(mockReminderRepository.listByUser).toHaveBeenCalledTimes(1);
      expect(mockReminderRepository.listByUser).toHaveBeenCalledWith({
        userId: USER_A,
        status: ReminderStatus.PENDING,
        dueBefore,
        limit: 10,
      });
      expect(result).toEqual(mockReminders);
    });

    it("SECURITY: enforces tenant isolation on list_reminders", async () => {
      mockReminderRepository.listByUser.mockResolvedValue([]);

      await toolExecutor.execute(
        "list_reminders",
        {
          userId: USER_B, // Spoofed target user
        },
        { userId: USER_A },
      );

      expect(mockReminderRepository.listByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
        }),
      );
    });

    it("rejects invalid status filter", async () => {
      await expect(
        toolExecutor.execute(
          "list_reminders",
          {
            status: "INVALID_STATUS_NAME",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("status must be one of: PENDING, PROCESSING, DELIVERED, FAILED, CANCELLED.");

      expect(mockReminderRepository.listByUser).not.toHaveBeenCalled();
    });

    it("rejects invalid limit parameter (non-positive integer)", async () => {
      await expect(
        toolExecutor.execute(
          "list_reminders",
          {
            limit: 0,
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be a positive integer.");

      await expect(
        toolExecutor.execute(
          "list_reminders",
          {
            limit: -5,
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be a positive integer.");
    });

    it("rejects invalid dueBefore date string", async () => {
      await expect(
        toolExecutor.execute(
          "list_reminders",
          {
            dueBefore: "invalid-date",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("dueBefore must be a valid ISO date string.");
    });
  });

  describe("4. get_reminder Tool Execution", () => {
    it("returns details for an owned reminder", async () => {
      const mockReminder = {
        id: "rem_xyz",
        userId: USER_A,
        message: "Team daily sync",
        scheduledFor: new Date("2026-09-06T09:00:00.000Z"),
        status: ReminderStatus.PENDING,
      };

      mockReminderRepository.findByIdForUser.mockResolvedValue(mockReminder);

      const result = await toolExecutor.execute(
        "get_reminder",
        { reminderId: "rem_xyz" },
        { userId: USER_A },
      );

      expect(mockReminderRepository.findByIdForUser).toHaveBeenCalledTimes(1);
      expect(mockReminderRepository.findByIdForUser).toHaveBeenCalledWith(
        "rem_xyz",
        USER_A,
      );
      expect(result).toEqual(mockReminder);
    });

    it("rejects when reminder is unowned or nonexistent (NotFoundError)", async () => {
      mockReminderRepository.findByIdForUser.mockResolvedValue(null);

      await expect(
        toolExecutor.execute(
          "get_reminder",
          { reminderId: "rem_not_owned" },
          { userId: USER_A },
        ),
      ).rejects.toThrow(NotFoundError);

      expect(mockReminderRepository.findByIdForUser).toHaveBeenCalledWith(
        "rem_not_owned",
        USER_A,
      );
    });

    it("rejects get_reminder without reminderId", async () => {
      await expect(
        toolExecutor.execute(
          "get_reminder",
          {},
          { userId: USER_A },
        ),
      ).rejects.toThrow("reminderId is required.");

      expect(mockReminderRepository.findByIdForUser).not.toHaveBeenCalled();
    });
  });

  describe("5. cancel_reminder Tool Execution", () => {
    it("cancels an owned reminder and returns structured confirmation", async () => {
      mockReminderRepository.cancel.mockResolvedValue(undefined);

      const result = await toolExecutor.execute(
        "cancel_reminder",
        { reminderId: "rem_to_cancel" },
        { userId: USER_A },
      );

      expect(mockReminderRepository.cancel).toHaveBeenCalledTimes(1);
      expect(mockReminderRepository.cancel).toHaveBeenCalledWith(
        "rem_to_cancel",
        USER_A,
      );
      expect(result).toEqual({
        success: true,
        reminderId: "rem_to_cancel",
        status: ReminderStatus.CANCELLED,
      });
    });

    it("rejects cancel_reminder without reminderId", async () => {
      await expect(
        toolExecutor.execute(
          "cancel_reminder",
          { reminderId: "" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("reminderId is required.");

      expect(mockReminderRepository.cancel).not.toHaveBeenCalled();
    });

    it("rejects when reminder cancellation throws domain error", async () => {
      mockReminderRepository.cancel.mockRejectedValue(
        new Error("Reminder not found or already processed."),
      );

      await expect(
        toolExecutor.execute(
          "cancel_reminder",
          { reminderId: "rem_missing" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Reminder not found or already processed.");
    });
  });

  describe("6. Audit Invariants & Security Classification", () => {
    it("records SUCCEEDED audit outcome on successful reminder tool execution", async () => {
      mockReminderRepository.create.mockResolvedValue({
        id: "rem_audit_ok",
        userId: USER_A,
        message: "Audit test",
        scheduledFor: new Date("2026-09-06T10:00:00Z"),
        status: ReminderStatus.PENDING,
      });

      await toolExecutor.execute(
        "create_reminder",
        {
          message: "Audit test",
          scheduledFor: "2026-09-06T10:00:00Z",
        },
        { userId: USER_A },
      );

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "create_reminder",
          userId: USER_A,
          outcome: "SUCCEEDED",
          computerTool: false,
          authorizationRequired: false,
        }),
      );
    });

    it("records FAILED audit outcome with error message on failed reminder tool execution", async () => {
      await expect(
        toolExecutor.execute(
          "create_reminder",
          {
            message: "",
            scheduledFor: "2026-09-06T10:00:00Z",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("message is required.");

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "create_reminder",
          userId: USER_A,
          outcome: "FAILED",
          computerTool: false,
          authorizationRequired: false,
          error: "message is required.",
        }),
      );
    });

    it("confirms all reminder tools are classified as non-computer tools requiring no computer authorization", () => {
      const reminderToolNames = [
        "create_reminder",
        "list_reminders",
        "get_reminder",
        "cancel_reminder",
      ];

      for (const name of reminderToolNames) {
        expect(isComputerTool(name)).toBe(false);
        expect(requiresComputerAuthorization(name)).toBe(false);
      }
    });
  });
});
