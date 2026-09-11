import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarEventStatus } from "@prisma/client";

import { NotFoundError, ValidationError } from "../../src/errors";
import { CalendarEventRepository } from "../../src/services/calendar/calendar.types";
import { CalendarService } from "../../src/services/calendar/calendar.service";
import {
  createCalendarEventTool,
  createCalendarTools,
  createCreateCalendarEventTool,
  createDeleteCalendarEventTool,
  createGetCalendarEventTool,
  createListCalendarEventsTool,
  createUpdateCalendarEventTool,
  deleteCalendarEventTool,
  getCalendarEventTool,
  listCalendarEventsTool,
  updateCalendarEventTool,
} from "../../src/services/tools/calendar.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolContext } from "../../src/services/tools/tool.types";

describe("Assistant Calendar Tools (Mission 88)", () => {
  let mockCalendarRepository: {
    create: ReturnType<typeof vi.fn>;
    findByIdForUser: ReturnType<typeof vi.fn>;
    findByDateRange: ReturnType<typeof vi.fn>;
    findUpcoming: ReturnType<typeof vi.fn>;
    updateForUser: ReturnType<typeof vi.fn>;
    deleteForUser: ReturnType<typeof vi.fn>;
  };
  let calendarService: CalendarService;
  let toolExecutor: ToolExecutor;

  const USER_A = "user_alpha_123";
  const USER_B = "user_bravo_456";

  const sampleEvent = {
    id: "evt-sample-1",
    userId: USER_A,
    title: "Sprint Review",
    description: "Bi-weekly sprint review",
    location: "Meeting Room B",
    startTime: new Date("2026-10-01T14:00:00.000Z"),
    endTime: new Date("2026-10-01T15:00:00.000Z"),
    isAllDay: false,
    timezone: "UTC",
    status: CalendarEventStatus.CONFIRMED,
    recurrenceRule: null,
    metadata: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };

  beforeEach(() => {
    mockCalendarRepository = {
      create: vi.fn(),
      findByIdForUser: vi.fn(),
      findByDateRange: vi.fn(),
      findUpcoming: vi.fn(),
      updateForUser: vi.fn(),
      deleteForUser: vi.fn(),
    };

    calendarService = new CalendarService(
      mockCalendarRepository as unknown as CalendarEventRepository,
    );

    const registry = createToolRegistry({
      calendarService,
    });

    toolExecutor = new ToolExecutor(registry);
  });

  describe("1. Registration & Schema Validation", () => {
    it("registers all five calendar tools in ToolRegistry", () => {
      const registry = createToolRegistry({ calendarService });

      expect(registry.has("create_calendar_event")).toBe(true);
      expect(registry.has("list_calendar_events")).toBe(true);
      expect(registry.has("get_calendar_event")).toBe(true);
      expect(registry.has("update_calendar_event")).toBe(true);
      expect(registry.has("delete_calendar_event")).toBe(true);
    });

    it("registers default calendar tools when no options passed", () => {
      const defaultRegistry = createToolRegistry();

      expect(defaultRegistry.has("create_calendar_event")).toBe(true);
      expect(defaultRegistry.has("list_calendar_events")).toBe(true);
      expect(defaultRegistry.has("get_calendar_event")).toBe(true);
      expect(defaultRegistry.has("update_calendar_event")).toBe(true);
      expect(defaultRegistry.has("delete_calendar_event")).toBe(true);
    });

    it("exports valid LLM JSON schemas with descriptions and parameter specs", () => {
      const definitions = toolExecutor.getToolDefinitions();
      const toolNames = definitions.map((d) => d.name);

      expect(toolNames).toContain("create_calendar_event");
      expect(toolNames).toContain("list_calendar_events");
      expect(toolNames).toContain("get_calendar_event");
      expect(toolNames).toContain("update_calendar_event");
      expect(toolNames).toContain("delete_calendar_event");

      const createDef = definitions.find((d) => d.name === "create_calendar_event")!;
      expect(createDef.description).toContain("Create a scheduled calendar event");
      expect(createDef.parameters.required).toEqual(["title", "startTime", "endTime"]);
      expect(createDef.parameters.properties).toHaveProperty("title");
      expect(createDef.parameters.properties).toHaveProperty("startTime");
      expect(createDef.parameters.properties).toHaveProperty("endTime");
      expect(createDef.parameters.properties).toHaveProperty("timezone");
      expect(createDef.parameters.properties).toHaveProperty("status");

      const listDef = definitions.find((d) => d.name === "list_calendar_events")!;
      expect(listDef.description).toContain("List calendar events");
      expect(listDef.parameters.properties).toHaveProperty("rangeStart");
      expect(listDef.parameters.properties).toHaveProperty("rangeEnd");
      expect(listDef.parameters.properties).toHaveProperty("from");
      expect(listDef.parameters.properties).toHaveProperty("status");
      expect(listDef.parameters.properties).toHaveProperty("limit");

      const getDef = definitions.find((d) => d.name === "get_calendar_event")!;
      expect(getDef.parameters.required).toEqual(["eventId"]);
      expect(getDef.parameters.properties).toHaveProperty("eventId");

      const updateDef = definitions.find((d) => d.name === "update_calendar_event")!;
      expect(updateDef.parameters.required).toEqual(["eventId"]);
      expect(updateDef.parameters.properties).toHaveProperty("eventId");
      expect(updateDef.parameters.properties).toHaveProperty("title");
      expect(updateDef.parameters.properties).toHaveProperty("startTime");
      expect(updateDef.parameters.properties).toHaveProperty("endTime");

      const deleteDef = definitions.find((d) => d.name === "delete_calendar_event")!;
      expect(deleteDef.parameters.required).toEqual(["eventId"]);
      expect(deleteDef.parameters.properties).toHaveProperty("eventId");
    });
  });

  describe("2. create_calendar_event Tool Execution", () => {
    it("creates an event scoped strictly to context.userId", async () => {
      mockCalendarRepository.create.mockResolvedValue(sampleEvent);

      const tool = createCreateCalendarEventTool(calendarService);
      const result = await tool.execute(
        {
          title: "Sprint Review",
          startTime: "2026-10-01T14:00:00.000Z",
          endTime: "2026-10-01T15:00:00.000Z",
          location: "Meeting Room B",
          timezone: "UTC",
          status: "CONFIRMED",
        },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
          title: "Sprint Review",
          location: "Meeting Room B",
          timezone: "UTC",
          status: "CONFIRMED",
        }),
      );
      expect(result).toEqual(sampleEvent);
    });

    it("ignores untrusted userId passed in arguments and enforces context.userId", async () => {
      mockCalendarRepository.create.mockResolvedValue(sampleEvent);

      const tool = createCreateCalendarEventTool(calendarService);
      await tool.execute(
        {
          userId: "ATTACKER_USER_ID",
          title: "Sprint Review",
          startTime: "2026-10-01T14:00:00.000Z",
          endTime: "2026-10-01T15:00:00.000Z",
        },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_A,
        }),
      );
    });

    it("fails closed when context.userId is missing or empty", async () => {
      const tool = createCreateCalendarEventTool(calendarService);

      await expect(
        tool.execute(
          {
            title: "Sprint Review",
            startTime: "2026-10-01T14:00:00.000Z",
            endTime: "2026-10-01T15:00:00.000Z",
          },
          { userId: "" },
        ),
      ).rejects.toThrow("User ID is required.");

      await expect(
        tool.execute(
          {
            title: "Sprint Review",
            startTime: "2026-10-01T14:00:00.000Z",
            endTime: "2026-10-01T15:00:00.000Z",
          },
          {} as ToolContext,
        ),
      ).rejects.toThrow("User ID is required.");
    });

    it("rejects invalid date order via domain validation", async () => {
      const tool = createCreateCalendarEventTool(calendarService);

      await expect(
        tool.execute(
          {
            title: "Reversed Event",
            startTime: "2026-10-01T16:00:00.000Z",
            endTime: "2026-10-01T15:00:00.000Z",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("3. list_calendar_events Tool Execution", () => {
    it("lists events with date range filter", async () => {
      mockCalendarRepository.findByDateRange.mockResolvedValue([sampleEvent]);

      const tool = createListCalendarEventsTool(calendarService);
      const result = await tool.execute(
        {
          rangeStart: "2026-10-01T00:00:00.000Z",
          rangeEnd: "2026-10-02T00:00:00.000Z",
          status: "CONFIRMED",
        },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.findByDateRange).toHaveBeenCalledWith({
        userId: USER_A,
        rangeStart: new Date("2026-10-01T00:00:00.000Z"),
        rangeEnd: new Date("2026-10-02T00:00:00.000Z"),
        status: "CONFIRMED",
        limit: undefined,
      });
      expect(result).toEqual([sampleEvent]);
    });

    it("lists upcoming events when no date range provided", async () => {
      mockCalendarRepository.findUpcoming.mockResolvedValue([sampleEvent]);

      const tool = createListCalendarEventsTool(calendarService);
      const result = await tool.execute(
        {
          from: "2026-09-01T00:00:00.000Z",
          limit: 10,
        },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.findUpcoming).toHaveBeenCalledWith({
        userId: USER_A,
        from: new Date("2026-09-01T00:00:00.000Z"),
        status: undefined,
        limit: 10,
      });
      expect(result).toEqual([sampleEvent]);
    });
  });

  describe("4. get_calendar_event Tool Execution", () => {
    it("gets event by eventId", async () => {
      mockCalendarRepository.findByIdForUser.mockResolvedValue(sampleEvent);

      const tool = createGetCalendarEventTool(calendarService);
      const result = await tool.execute(
        { eventId: "evt-sample-1" },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.findByIdForUser).toHaveBeenCalledWith(
        "evt-sample-1",
        USER_A,
      );
      expect(result).toEqual(sampleEvent);
    });

    it("accepts id alias as fallback", async () => {
      mockCalendarRepository.findByIdForUser.mockResolvedValue(sampleEvent);

      const tool = createGetCalendarEventTool(calendarService);
      const result = await tool.execute(
        { id: "evt-sample-1" },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.findByIdForUser).toHaveBeenCalledWith(
        "evt-sample-1",
        USER_A,
      );
      expect(result).toEqual(sampleEvent);
    });

    it("propagates NotFoundError when event is missing", async () => {
      mockCalendarRepository.findByIdForUser.mockResolvedValue(null);

      const tool = createGetCalendarEventTool(calendarService);
      await expect(
        tool.execute(
          { eventId: "evt-nonexistent" },
          { userId: USER_A },
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("5. update_calendar_event Tool Execution", () => {
    it("updates event fields and evaluates effective date interval", async () => {
      mockCalendarRepository.findByIdForUser.mockResolvedValue(sampleEvent);
      mockCalendarRepository.updateForUser.mockResolvedValue({
        ...sampleEvent,
        title: "Updated Sprint Review",
      });

      const tool = createUpdateCalendarEventTool(calendarService);
      const result = await tool.execute(
        {
          eventId: "evt-sample-1",
          title: "Updated Sprint Review",
        },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.updateForUser).toHaveBeenCalledWith(
        "evt-sample-1",
        USER_A,
        expect.objectContaining({
          title: "Updated Sprint Review",
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          title: "Updated Sprint Review",
        }),
      );
    });

    it("rejects invalid partial date update that inverts existing interval", async () => {
      mockCalendarRepository.findByIdForUser.mockResolvedValue(sampleEvent); // 14:00 to 15:00

      const tool = createUpdateCalendarEventTool(calendarService);

      // Attempt to move startTime to 15:30 without changing endTime
      await expect(
        tool.execute(
          {
            eventId: "evt-sample-1",
            startTime: "2026-10-01T15:30:00.000Z",
          },
          { userId: USER_A },
        ),
      ).rejects.toThrow("Start time must be before end time.");
    });
  });

  describe("6. delete_calendar_event Tool Execution", () => {
    it("deletes owned calendar event", async () => {
      mockCalendarRepository.deleteForUser.mockResolvedValue(undefined);

      const tool = createDeleteCalendarEventTool(calendarService);
      const result = await tool.execute(
        { eventId: "evt-sample-1" },
        { userId: USER_A },
      );

      expect(mockCalendarRepository.deleteForUser).toHaveBeenCalledWith(
        "evt-sample-1",
        USER_A,
      );
      expect(result).toEqual({
        success: true,
        eventId: "evt-sample-1",
      });
    });

    it("throws NotFoundError if event does not belong to user", async () => {
      mockCalendarRepository.deleteForUser.mockRejectedValue(
        new NotFoundError("Calendar event not found for the authenticated user."),
      );

      const tool = createDeleteCalendarEventTool(calendarService);
      await expect(
        tool.execute(
          { eventId: "evt-sample-1" },
          { userId: USER_B },
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("7. Standalone Tool Singletons & Factory Functions", () => {
    it("provides exported singleton tools", () => {
      expect(createCalendarEventTool.name).toBe("create_calendar_event");
      expect(listCalendarEventsTool.name).toBe("list_calendar_events");
      expect(getCalendarEventTool.name).toBe("get_calendar_event");
      expect(updateCalendarEventTool.name).toBe("update_calendar_event");
      expect(deleteCalendarEventTool.name).toBe("delete_calendar_event");
    });

    it("provides factory function createCalendarTools", () => {
      const tools = createCalendarTools(calendarService);
      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.name)).toEqual([
        "create_calendar_event",
        "list_calendar_events",
        "get_calendar_event",
        "update_calendar_event",
        "delete_calendar_event",
      ]);
    });
  });
});
