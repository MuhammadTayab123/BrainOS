import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
} from "@prisma/client";

import { NotFoundError } from "../../src/errors";
import { AutomationService } from "../../src/services/automation/automation.service";
import {
  createAutomationTools,
  createCreateAutomationTool,
  createDeleteAutomationTool,
  createGetAutomationTool,
  createListAutomationsTool,
  createUpdateAutomationTool,
} from "../../src/services/tools/automation.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolAuditService } from "../../src/services/security/tool-audit.service";
import {
  isComputerTool,
  requiresComputerAuthorization,
} from "../../src/services/security/computer-action.policy";

describe("Assistant Automation Tools (Mission 46)", () => {
  let mockAutomationService: {
    createAutomation: ReturnType<typeof vi.fn>;
    listAutomations: ReturnType<typeof vi.fn>;
    getAutomation: ReturnType<typeof vi.fn>;
    updateAutomation: ReturnType<typeof vi.fn>;
    deleteAutomation: ReturnType<typeof vi.fn>;
  };
  let automationService: AutomationService;
  let mockAuditService: ToolAuditService;
  let toolExecutor: ToolExecutor;

  const USER_A = "user_automation_alpha_123";
  const USER_B = "user_automation_bravo_456";

  beforeEach(() => {
    mockAutomationService = {
      createAutomation: vi.fn(),
      listAutomations: vi.fn(),
      getAutomation: vi.fn(),
      updateAutomation: vi.fn(),
      deleteAutomation: vi.fn(),
    };

    automationService = mockAutomationService as unknown as AutomationService;

    mockAuditService = {
      record: vi.fn(),
    } as unknown as ToolAuditService;

    const registry = createToolRegistry({
      automationService,
    });

    toolExecutor = new ToolExecutor(registry, mockAuditService);
  });

  describe("1. Registration & Schema Validation", () => {
    it("registers all five automation tools in ToolRegistry", () => {
      const registry = createToolRegistry({ automationService });

      expect(registry.has("create_automation")).toBe(true);
      expect(registry.has("list_automations")).toBe(true);
      expect(registry.has("get_automation")).toBe(true);
      expect(registry.has("update_automation")).toBe(true);
      expect(registry.has("delete_automation")).toBe(true);
    });

    it("exports valid LLM JSON schemas with descriptions and parameter specs", () => {
      const definitions = toolExecutor.getToolDefinitions();
      const toolNames = definitions.map((d) => d.name);

      expect(toolNames).toContain("create_automation");
      expect(toolNames).toContain("list_automations");
      expect(toolNames).toContain("get_automation");
      expect(toolNames).toContain("update_automation");
      expect(toolNames).toContain("delete_automation");

      const createDef = definitions.find((d) => d.name === "create_automation")!;
      expect(createDef.description).toContain("Create a new automated workflow");
      expect(createDef.parameters.type).toBe("object");
      expect(createDef.parameters.required).toEqual([
        "name",
        "triggerType",
        "actionType",
        "config",
      ]);
      expect(createDef.parameters.properties).toHaveProperty("name");
      expect(createDef.parameters.properties).toHaveProperty("triggerType");
      expect(createDef.parameters.properties).toHaveProperty("actionType");
      expect(createDef.parameters.properties).toHaveProperty("config");
      expect(createDef.parameters.properties).toHaveProperty("nextRunAt");

      const listDef = definitions.find((d) => d.name === "list_automations")!;
      expect(listDef.description).toContain("List all automations");
      expect(listDef.parameters.type).toBe("object");
      expect(listDef.parameters.properties).toHaveProperty("status");
      expect(listDef.parameters.properties).toHaveProperty("limit");

      const getDef = definitions.find((d) => d.name === "get_automation")!;
      expect(getDef.description).toContain("Retrieve details of a specific automation");
      expect(getDef.parameters.required).toEqual(["automationId"]);
      expect(getDef.parameters.properties).toHaveProperty("automationId");

      const updateDef = definitions.find((d) => d.name === "update_automation")!;
      expect(updateDef.description).toContain("Update an existing automation");
      expect(updateDef.parameters.required).toEqual(["automationId"]);
      expect(updateDef.parameters.properties).toHaveProperty("automationId");
      expect(updateDef.parameters.properties).toHaveProperty("name");
      expect(updateDef.parameters.properties).toHaveProperty("status");
      expect(updateDef.parameters.properties).toHaveProperty("config");
      expect(updateDef.parameters.properties).toHaveProperty("nextRunAt");

      const deleteDef = definitions.find((d) => d.name === "delete_automation")!;
      expect(deleteDef.description).toContain("Delete an automation rule");
      expect(deleteDef.parameters.required).toEqual(["automationId"]);
      expect(deleteDef.parameters.properties).toHaveProperty("automationId");
    });

    it("classifies all automation tools as non-computer tools with no computer authorization required", () => {
      const automationToolNames = [
        "create_automation",
        "list_automations",
        "get_automation",
        "update_automation",
        "delete_automation",
      ];

      for (const name of automationToolNames) {
        expect(isComputerTool(name)).toBe(false);
        expect(requiresComputerAuthorization(name)).toBe(false);
      }
    });
  });

  describe("2. create_automation Tool", () => {
    it("creates a scheduled automation with required parameters", async () => {
      const now = new Date("2026-09-06T09:00:00.000Z");
      mockAutomationService.createAutomation.mockResolvedValueOnce({
        id: "auto_1",
        userId: USER_A,
        name: "Morning Task Generator",
        status: AutomationStatus.ACTIVE,
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {
          title: "Review daily schedule",
          recurrence: { type: "DAILY", hour: 9, minute: 0 },
        },
        nextRunAt: now,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const result = await toolExecutor.execute(
        "create_automation",
        {
          name: "Morning Task Generator",
          triggerType: "SCHEDULE",
          actionType: "CREATE_TASK",
          config: {
            title: "Review daily schedule",
            recurrence: { type: "DAILY", hour: 9, minute: 0 },
          },
          nextRunAt: "2026-09-06T09:00:00.000Z",
        },
        { userId: USER_A },
      );

      expect(mockAutomationService.createAutomation).toHaveBeenCalledWith({
        userId: USER_A,
        name: "Morning Task Generator",
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {
          title: "Review daily schedule",
          recurrence: { type: "DAILY", hour: 9, minute: 0 },
        },
        nextRunAt: now,
      });

      expect(result).toEqual({
        id: "auto_1",
        name: "Morning Task Generator",
        status: AutomationStatus.ACTIVE,
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {
          title: "Review daily schedule",
          recurrence: { type: "DAILY", hour: 9, minute: 0 },
        },
        nextRunAt: now,
        createdAt: now,
      });
    });

    it("creates a task-due trigger automation", async () => {
      const now = new Date();
      mockAutomationService.createAutomation.mockResolvedValueOnce({
        id: "auto_2",
        userId: USER_A,
        name: "Task Due Alert",
        status: AutomationStatus.ACTIVE,
        triggerType: AutomationTriggerType.TASK_DUE,
        actionType: AutomationActionType.CREATE_REMINDER,
        config: {
          taskId: "task_123",
          message: "Task is due now!",
        },
        nextRunAt: null,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const result = await toolExecutor.execute(
        "create_automation",
        {
          name: "Task Due Alert",
          triggerType: "TASK_DUE",
          actionType: "CREATE_REMINDER",
          config: {
            taskId: "task_123",
            message: "Task is due now!",
          },
        },
        { userId: USER_A },
      );

      expect(mockAutomationService.createAutomation).toHaveBeenCalledWith({
        userId: USER_A,
        name: "Task Due Alert",
        triggerType: AutomationTriggerType.TASK_DUE,
        actionType: AutomationActionType.CREATE_REMINDER,
        config: {
          taskId: "task_123",
          message: "Task is due now!",
        },
        nextRunAt: undefined,
      });

      expect(result).toMatchObject({
        id: "auto_2",
        triggerType: "TASK_DUE",
        actionType: "CREATE_REMINDER",
      });
    });

    it("rejects missing or empty name", async () => {
      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            triggerType: "SCHEDULE",
            actionType: "CREATE_TASK",
            config: {},
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("name is required.");

      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            name: "   ",
            triggerType: "SCHEDULE",
            actionType: "CREATE_TASK",
            config: {},
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("name is required.");
    });

    it("rejects invalid triggerType and actionType enums", async () => {
      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            name: "Bad Trigger",
            triggerType: "INVALID_TRIGGER",
            actionType: "CREATE_TASK",
            config: {},
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("triggerType must be one of: SCHEDULE, TASK_DUE, REMINDER_DUE.");

      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            name: "Bad Action",
            triggerType: "SCHEDULE",
            actionType: "INVALID_ACTION",
            config: {},
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("actionType must be one of: CREATE_TASK, CREATE_REMINDER.");
    });

    it("rejects non-object config", async () => {
      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            name: "Bad Config",
            triggerType: "SCHEDULE",
            actionType: "CREATE_TASK",
            config: "invalid",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("config must be an object.");
    });

    it("rejects invalid nextRunAt date string", async () => {
      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            name: "Bad Date",
            triggerType: "SCHEDULE",
            actionType: "CREATE_TASK",
            config: {},
            nextRunAt: "not-a-valid-date",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("nextRunAt must be a valid ISO date string.");
    });
  });

  describe("3. list_automations Tool", () => {
    it("lists automations with default limit", async () => {
      const now = new Date();
      const automations = [
        {
          id: "auto_1",
          userId: USER_A,
          name: "Automation 1",
          status: AutomationStatus.ACTIVE,
          triggerType: AutomationTriggerType.SCHEDULE,
          actionType: AutomationActionType.CREATE_TASK,
          config: {},
          nextRunAt: now,
          lastRunAt: null,
          createdAt: now,
          updatedAt: now,
        },
      ];
      mockAutomationService.listAutomations.mockResolvedValueOnce(automations);

      const result = await toolExecutor.execute(
        "list_automations",
        {},
        { userId: USER_A },
      );

      expect(mockAutomationService.listAutomations).toHaveBeenCalledWith({
        userId: USER_A,
        status: undefined,
        limit: undefined,
      });
      expect(result).toEqual(automations);
    });

    it("lists automations with status filter and custom limit (1 to 50)", async () => {
      mockAutomationService.listAutomations.mockResolvedValueOnce([]);

      await toolExecutor.execute(
        "list_automations",
        { status: "PAUSED", limit: 20 },
        { userId: USER_A },
      );

      expect(mockAutomationService.listAutomations).toHaveBeenCalledWith({
        userId: USER_A,
        status: AutomationStatus.PAUSED,
        limit: 20,
      });
    });

    it("rejects invalid status filter", async () => {
      await expect(
        toolExecutor.execute(
          "list_automations",
          { status: "UNKNOWN_STATUS" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("status must be one of: ACTIVE, PAUSED, COMPLETED, FAILED.");
    });

    it("rejects invalid limit values", async () => {
      await expect(
        toolExecutor.execute(
          "list_automations",
          { limit: 0 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");

      await expect(
        toolExecutor.execute(
          "list_automations",
          { limit: 51 },
          { userId: USER_A },
        ),
      ).rejects.toThrow("limit must be an integer between 1 and 50.");
    });
  });

  describe("4. get_automation Tool", () => {
    it("retrieves a specific automation by automationId", async () => {
      const now = new Date();
      const automation = {
        id: "auto_100",
        userId: USER_A,
        name: "Specific Auto",
        status: AutomationStatus.ACTIVE,
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {},
        nextRunAt: now,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now,
      };
      mockAutomationService.getAutomation.mockResolvedValueOnce(automation);

      const result = await toolExecutor.execute(
        "get_automation",
        { automationId: "auto_100" },
        { userId: USER_A },
      );

      expect(mockAutomationService.getAutomation).toHaveBeenCalledWith(
        "auto_100",
        USER_A,
      );
      expect(result).toEqual(automation);
    });

    it("rejects missing or empty automationId", async () => {
      await expect(
        toolExecutor.execute("get_automation", {}, { userId: USER_A }),
      ).rejects.toThrow("automationId is required.");

      await expect(
        toolExecutor.execute(
          "get_automation",
          { automationId: "   " },
          { userId: USER_A },
        ),
      ).rejects.toThrow("automationId is required.");
    });

    it("propagates NotFoundError when automation is missing or unowned", async () => {
      mockAutomationService.getAutomation.mockRejectedValueOnce(
        new NotFoundError("Automation not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "get_automation",
          { automationId: "auto_missing" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Automation not found for the authenticated user.");
    });
  });

  describe("5. update_automation Tool", () => {
    it("updates automation name, status, config, and nextRunAt", async () => {
      const nextRunAt = new Date("2026-09-07T10:00:00Z");
      mockAutomationService.updateAutomation.mockResolvedValueOnce(undefined);

      const result = await toolExecutor.execute(
        "update_automation",
        {
          automationId: "auto_update_1",
          name: "Renamed Automation",
          status: "PAUSED",
          config: { title: "Updated Title" },
          nextRunAt: "2026-09-07T10:00:00Z",
        },
        { userId: USER_A },
      );

      expect(mockAutomationService.updateAutomation).toHaveBeenCalledWith(
        "auto_update_1",
        USER_A,
        {
          name: "Renamed Automation",
          status: AutomationStatus.PAUSED,
          config: { title: "Updated Title" },
          nextRunAt,
        },
      );

      expect(result).toEqual({
        success: true,
        automationId: "auto_update_1",
        status: AutomationStatus.PAUSED,
        name: "Renamed Automation",
      });
    });

    it("rejects missing automationId", async () => {
      await expect(
        toolExecutor.execute(
          "update_automation",
          { name: "New Name" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("automationId is required.");
    });

    it("rejects invalid status enum", async () => {
      await expect(
        toolExecutor.execute(
          "update_automation",
          {
            automationId: "auto_1",
            status: "INVALID_STATUS",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("status must be one of: ACTIVE, PAUSED, COMPLETED, FAILED.");
    });

    it("propagates NotFoundError on update of non-existent automation", async () => {
      mockAutomationService.updateAutomation.mockRejectedValueOnce(
        new NotFoundError("Automation not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "update_automation",
          {
            automationId: "auto_missing",
            status: "PAUSED",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Automation not found for the authenticated user.");
    });
  });

  describe("6. delete_automation Tool", () => {
    it("deletes automation and returns confirmation", async () => {
      mockAutomationService.deleteAutomation.mockResolvedValueOnce(undefined);

      const result = await toolExecutor.execute(
        "delete_automation",
        { automationId: "auto_to_delete" },
        { userId: USER_A },
      );

      expect(mockAutomationService.deleteAutomation).toHaveBeenCalledWith(
        "auto_to_delete",
        USER_A,
      );
      expect(result).toEqual({
        success: true,
        automationId: "auto_to_delete",
      });
    });

    it("rejects missing automationId", async () => {
      await expect(
        toolExecutor.execute("delete_automation", {}, { userId: USER_A }),
      ).rejects.toThrow("automationId is required.");
    });

    it("propagates NotFoundError when deleting foreign or missing automation", async () => {
      mockAutomationService.deleteAutomation.mockRejectedValueOnce(
        new NotFoundError("Automation not found for the authenticated user."),
      );

      await expect(
        toolExecutor.execute(
          "delete_automation",
          { automationId: "auto_foreign" },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Automation not found for the authenticated user.");
    });
  });

  describe("7. Security, User Isolation, Context Enforcement & Audit Logging", () => {
    it("fails closed when context.userId is missing on every tool", async () => {
      const toolCases = [
        {
          name: "create_automation",
          input: {
            name: "Test",
            triggerType: "SCHEDULE",
            actionType: "CREATE_TASK",
            config: {},
          },
        },
        { name: "list_automations", input: {} },
        { name: "get_automation", input: { automationId: "auto_1" } },
        { name: "update_automation", input: { automationId: "auto_1" } },
        { name: "delete_automation", input: { automationId: "auto_1" } },
      ];

      for (const tc of toolCases) {
        await expect(
          toolExecutor.execute(
            tc.name,
            tc.input,
            {} as unknown as { userId: string },
          ),
        ).rejects.toThrow("User ID is required.");

        await expect(
          toolExecutor.execute(
            tc.name,
            tc.input,
            { userId: "   " },
          ),
        ).rejects.toThrow("User ID is required.");
      }
    });

    it("never accepts userId from input arguments; derives strictly from context", async () => {
      mockAutomationService.createAutomation.mockResolvedValueOnce({
        id: "auto_secure",
        userId: USER_A,
        name: "Secure Auto",
        status: AutomationStatus.ACTIVE,
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {},
        nextRunAt: null,
        lastRunAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await toolExecutor.execute(
        "create_automation",
        {
          name: "Secure Auto",
          triggerType: "SCHEDULE",
          actionType: "CREATE_TASK",
          config: {},
          userId: USER_B, // Malicious spoofing attempt
        },
        { userId: USER_A },
      );

      expect(mockAutomationService.createAutomation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A, // strictly context.userId
        }),
      );
    });

    it("records SUCCEEDED and FAILED audit events to ToolAuditService", async () => {
      mockAutomationService.createAutomation.mockResolvedValueOnce({
        id: "auto_audit",
        userId: USER_A,
        name: "Audit Auto",
        status: AutomationStatus.ACTIVE,
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.CREATE_TASK,
        config: {},
        nextRunAt: null,
        lastRunAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await toolExecutor.execute(
        "create_automation",
        {
          name: "Audit Auto",
          triggerType: "SCHEDULE",
          actionType: "CREATE_TASK",
          config: {},
        },
        { userId: USER_A },
      );

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          toolName: "create_automation",
          outcome: "SUCCEEDED",
          computerTool: false,
          authorizationRequired: false,
        }),
      );

      await expect(
        toolExecutor.execute(
          "create_automation",
          {
            name: "",
            triggerType: "SCHEDULE",
            actionType: "CREATE_TASK",
            config: {},
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("name is required.");

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          toolName: "create_automation",
          outcome: "FAILED",
          computerTool: false,
          authorizationRequired: false,
          error: "name is required.",
        }),
      );
    });

    it("createAutomationTools helper instantiates all five tools with custom service", () => {
      const tools = createAutomationTools(automationService);
      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.name)).toEqual([
        "create_automation",
        "list_automations",
        "get_automation",
        "update_automation",
        "delete_automation",
      ]);
    });
  });
});
