import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComputerAgentGateway } from "../../src/services/computer/agent/computer-agent.gateway";
import {
  createComputerTools,
  createGetComputerStatusTool,
  createLaunchComputerApplicationTool,
  createListComputerApplicationsTool,
  createListComputerFilesTool,
  createReadComputerFileTool,
  createWriteComputerFileTool,
} from "../../src/services/tools/computer.tools";
import { createToolRegistry } from "../../src/services/tools/tool.container";
import { ToolContext } from "../../src/services/tools/tool.types";

describe("Computer tools DI and execution", () => {
  const mockGateway = {
    getInfo: vi.fn(),
    isOnline: vi.fn(),
    listApplications: vi.fn(),
    launchApplication: vi.fn(),
    listFiles: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  } as unknown as ComputerAgentGateway;

  const validContext: ToolContext = {
    userId: "user-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool container registration", () => {
    it("registers all 6 computer tools in createToolRegistry with default dependencies", () => {
      const registry = createToolRegistry();

      expect(registry.has("computer_get_status")).toBe(true);
      expect(registry.has("computer_list_applications")).toBe(true);
      expect(registry.has("computer_launch_application")).toBe(true);
      expect(registry.has("computer_list_files")).toBe(true);
      expect(registry.has("computer_read_file")).toBe(true);
      expect(registry.has("computer_write_file")).toBe(true);
    });

    it("registers tools using the injected ComputerAgentGateway", async () => {
      (mockGateway.getInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
        agentId: "injected-test",
        status: "ONLINE",
        platform: "linux",
        architecture: "x64",
        capabilities: {
          status: true,
          applications: true,
          files: true,
          browser: false,
        },
      });

      const registry = createToolRegistry({
        computerAgentGateway: mockGateway,
      });

      const tool = registry.get("computer_get_status");
      expect(tool).toBeDefined();

      const result = await tool?.execute({}, validContext);
      expect(mockGateway.getInfo).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        agentId: "injected-test",
      });
    });
  });

  describe("createComputerTools composite factory", () => {
    it("creates an array of all 6 tool definitions", () => {
      const tools = createComputerTools(mockGateway);

      expect(tools).toHaveLength(6);
      expect(tools.map((t) => t.name)).toEqual([
        "computer_get_status",
        "computer_list_applications",
        "computer_launch_application",
        "computer_list_files",
        "computer_read_file",
        "computer_write_file",
      ]);
    });
  });

  describe("createGetComputerStatusTool", () => {
    it("delegates to gateway.getInfo", async () => {
      const info = {
        agentId: "test-agent",
        status: "ONLINE" as const,
        platform: "win32",
        architecture: "x64",
        capabilities: {
          status: true,
          applications: true,
          files: true,
          browser: false,
        },
      };
      (mockGateway.getInfo as ReturnType<typeof vi.fn>).mockResolvedValue(info);

      const tool = createGetComputerStatusTool(mockGateway);
      const result = await tool.execute({}, validContext);

      expect(mockGateway.getInfo).toHaveBeenCalledTimes(1);
      expect(result).toEqual(info);
    });
  });

  describe("createListComputerApplicationsTool", () => {
    it("delegates to gateway.listApplications", async () => {
      const apps = [{ name: "VS Code", appId: "vscode" }];
      (
        mockGateway.listApplications as ReturnType<typeof vi.fn>
      ).mockResolvedValue(apps);

      const tool = createListComputerApplicationsTool(mockGateway);
      const result = await tool.execute({}, validContext);

      expect(mockGateway.listApplications).toHaveBeenCalledTimes(1);
      expect(result).toEqual(apps);
    });
  });

  describe("createLaunchComputerApplicationTool", () => {
    it("delegates to gateway.launchApplication with valid appId", async () => {
      (
        mockGateway.launchApplication as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        success: true,
        appId: "vscode",
      });

      const tool = createLaunchComputerApplicationTool(mockGateway);
      const result = await tool.execute({ appId: "vscode" }, validContext);

      expect(mockGateway.launchApplication).toHaveBeenCalledWith("vscode");
      expect(result).toEqual({ success: true, appId: "vscode" });
    });

    it("rejects invalid appId inputs", async () => {
      const tool = createLaunchComputerApplicationTool(mockGateway);

      await expect(tool.execute(null, validContext)).rejects.toThrow(
        "appId is required.",
      );
      await expect(tool.execute({}, validContext)).rejects.toThrow(
        "appId is required.",
      );
      await expect(
        tool.execute({ appId: 123 }, validContext),
      ).rejects.toThrow("appId is required.");
    });
  });

  describe("createListComputerFilesTool", () => {
    it("delegates to gateway.listFiles with optional path", async () => {
      const entries = [
        { name: "file.txt", path: "file.txt", type: "file" as const },
      ];
      (mockGateway.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue(
        entries,
      );

      const tool = createListComputerFilesTool(mockGateway);
      const result = await tool.execute({ path: "docs" }, validContext);

      expect(mockGateway.listFiles).toHaveBeenCalledWith("docs");
      expect(result).toEqual(entries);
    });

    it("delegates without path when omitted", async () => {
      (mockGateway.listFiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const tool = createListComputerFilesTool(mockGateway);
      await tool.execute({}, validContext);

      expect(mockGateway.listFiles).toHaveBeenCalledWith(undefined);
    });

    it("rejects non-string path", async () => {
      const tool = createListComputerFilesTool(mockGateway);

      await expect(
        tool.execute({ path: 123 }, validContext),
      ).rejects.toThrow("path must be a string.");
    });

    it("rejects non-object input", async () => {
      const tool = createListComputerFilesTool(mockGateway);

      await expect(
        tool.execute("invalid", validContext),
      ).rejects.toThrow("Input must be an object.");
    });
  });

  describe("createReadComputerFileTool", () => {
    it("delegates to gateway.readFile with valid path", async () => {
      const fileData = { path: "notes.txt", content: "Hello world" };
      (mockGateway.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        fileData,
      );

      const tool = createReadComputerFileTool(mockGateway);
      const result = await tool.execute({ path: "notes.txt" }, validContext);

      expect(mockGateway.readFile).toHaveBeenCalledWith("notes.txt");
      expect(result).toEqual(fileData);
    });

    it("rejects missing or invalid path", async () => {
      const tool = createReadComputerFileTool(mockGateway);

      await expect(tool.execute({}, validContext)).rejects.toThrow(
        "path is required.",
      );
      await expect(
        tool.execute({ path: 123 }, validContext),
      ).rejects.toThrow("path is required.");
    });
  });

  describe("createWriteComputerFileTool", () => {
    it("delegates to gateway.writeFile with valid path and content", async () => {
      const writeResult = { path: "notes.txt", success: true };
      (mockGateway.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(
        writeResult,
      );

      const tool = createWriteComputerFileTool(mockGateway);
      const result = await tool.execute(
        { path: "notes.txt", content: "New content" },
        validContext,
      );

      expect(mockGateway.writeFile).toHaveBeenCalledWith(
        "notes.txt",
        "New content",
      );
      expect(result).toEqual(writeResult);
    });

    it("rejects missing path or content", async () => {
      const tool = createWriteComputerFileTool(mockGateway);

      await expect(
        tool.execute({ content: "test" }, validContext),
      ).rejects.toThrow("path is required.");
      await expect(
        tool.execute({ path: "notes.txt" }, validContext),
      ).rejects.toThrow("content is required.");
      await expect(
        tool.execute({ path: "notes.txt", content: 123 }, validContext),
      ).rejects.toThrow("content is required.");
    });
  });
});
