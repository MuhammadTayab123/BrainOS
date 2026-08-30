import { describe, expect, it, vi } from "vitest";

import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolRegistry } from "../../src/services/tools/tool.registry";
import { ToolAuditEvent } from "../../src/services/security/tool-audit.types";
import { ToolDefinition } from "../../src/services/tools/tool.types";

function createAuditService() {
  return {
    record: vi.fn<(event: ToolAuditEvent) => void>(),
  };
}

function createRegistry(tool: ToolDefinition) {
  const registry = new ToolRegistry();
  registry.register(tool);
  return registry;
}

describe("ToolExecutor audit", () => {
  it("records a successful tool execution", async () => {
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "Test tool",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: vi.fn().mockResolvedValue({
        success: true,
      }),
    };

    const auditService = createAuditService();
    const executor = new ToolExecutor(
      createRegistry(tool),
      auditService,
    );

    await executor.execute(
      "test_tool",
      {},
      {
        userId: "test-user",
      },
    );

    expect(auditService.record).toHaveBeenCalledTimes(1);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "test_tool",
        userId: "test-user",
        outcome: "SUCCEEDED",
        computerTool: false,
        authorizationRequired: false,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("records a failed tool execution", async () => {
    const toolError = new Error(
      "Tool execution failed.",
    );

    const tool: ToolDefinition = {
      name: "test_tool",
      description: "Test tool",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: vi.fn().mockRejectedValue(toolError),
    };

    const auditService = createAuditService();
    const executor = new ToolExecutor(
      createRegistry(tool),
      auditService,
    );

    await expect(
      executor.execute(
        "test_tool",
        {},
        {
          userId: "test-user",
        },
      ),
    ).rejects.toThrow("Tool execution failed.");

    expect(auditService.record).toHaveBeenCalledTimes(1);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "test_tool",
        userId: "test-user",
        outcome: "FAILED",
        computerTool: false,
        authorizationRequired: false,
        error: "Tool execution failed.",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("records an unauthorized computer action", async () => {
    const tool: ToolDefinition = {
      name: "computer_write_file",
      description: "Write a file",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: vi.fn(),
    };

    const auditService = createAuditService();
    const executor = new ToolExecutor(
      createRegistry(tool),
      auditService,
    );

    await expect(
      executor.execute(
        "computer_write_file",
        {},
        {
          userId: "test-user",
        },
      ),
    ).rejects.toThrow(
      'Computer action "computer_write_file" requires authorization.',
    );

    expect(tool.execute).not.toHaveBeenCalled();

    expect(auditService.record).toHaveBeenCalledTimes(1);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "computer_write_file",
        userId: "test-user",
        outcome: "UNAUTHORIZED",
        computerTool: true,
        authorizationRequired: true,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("records an authorized computer action as successful", async () => {
    const tool: ToolDefinition = {
      name: "computer_write_file",
      description: "Write a file",
      parameters: {
        type: "object",
        properties: {},
      },
      execute: vi.fn().mockResolvedValue({
        success: true,
      }),
    };

    const auditService = createAuditService();
    const executor = new ToolExecutor(
      createRegistry(tool),
      auditService,
    );

    await executor.execute(
      "computer_write_file",
      {},
      {
        userId: "test-user",
        authorizedComputerActions: [
          "computer_write_file",
        ],
      },
    );

    expect(tool.execute).toHaveBeenCalledTimes(1);

    expect(auditService.record).toHaveBeenCalledTimes(1);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "computer_write_file",
        userId: "test-user",
        outcome: "SUCCEEDED",
        computerTool: true,
        authorizationRequired: true,
        durationMs: expect.any(Number),
      }),
    );
  });
});
