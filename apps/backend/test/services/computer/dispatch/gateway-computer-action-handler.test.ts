import { describe, expect, it, vi, beforeEach } from "vitest";
import { ComputerAgentGateway } from "../../../../src/services/computer/agent/computer-agent.gateway";
import {
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileEntry,
  ComputerFileContent,
  ComputerFileWriteResult,
} from "../../../../src/services/computer/agent/computer-agent.types";
import { ProtocolErrorCode } from "../../../../src/services/computer/protocol/computer-agent-protocol.types";
import {
  ComputerActionName,
  ComputerAgentActionContext,
  DefaultComputerAgentActionDispatcher,
  ComputerAgentActionAuthorizer,
  InMemoryComputerActionPermissionProvider,
  GatewayComputerActionHandler,
  ComputerAgentActionException,
} from "../../../../src/services/computer/dispatch";

describe("GatewayComputerActionHandler", () => {
  let mockGateway: ComputerAgentGateway;
  let handler: GatewayComputerActionHandler;

  const validContext: ComputerAgentActionContext = {
    agentId: "agent-123",
    userId: "user-456",
  };

  const sampleInfo: ComputerAgentInfo = {
    agentId: "agent-123",
    status: "ONLINE",
    platform: "win32",
    architecture: "x64",
    capabilities: {
      status: true,
      applications: true,
      files: true,
      browser: false,
    },
  };

  const sampleApps: ComputerApplication[] = [
    { name: "Notepad", appId: "notepad" },
    { name: "Calculator", appId: "calc" },
  ];

  const sampleFiles: ComputerFileEntry[] = [
    { name: "readme.txt", path: "readme.txt", type: "file" },
  ];

  const sampleFileContent: ComputerFileContent = {
    path: "readme.txt",
    content: "hello world",
  };

  const sampleWriteResult: ComputerFileWriteResult = {
    path: "output.txt",
    success: true,
  };

  beforeEach(() => {
    mockGateway = {
      getInfo: vi.fn().mockResolvedValue(sampleInfo),
      isOnline: vi.fn().mockResolvedValue(true),
      listApplications: vi.fn().mockResolvedValue(sampleApps),
      launchApplication: vi.fn().mockResolvedValue({ success: true, appId: "notepad" }),
      listFiles: vi.fn().mockResolvedValue(sampleFiles),
      readFile: vi.fn().mockResolvedValue(sampleFileContent),
      writeFile: vi.fn().mockResolvedValue(sampleWriteResult),
    } as unknown as ComputerAgentGateway;

    handler = new GatewayComputerActionHandler({ gateway: mockGateway });
  });

  describe("Constructor & Initialization", () => {
    it("throws when options or gateway is missing", () => {
      expect(() => new GatewayComputerActionHandler(null as any)).toThrow(
        "GatewayComputerActionHandler requires a valid ComputerAgentGateway.",
      );
      expect(() => new GatewayComputerActionHandler({} as any)).toThrow(
        "GatewayComputerActionHandler requires a valid ComputerAgentGateway.",
      );
    });
  });

  describe("Explicit Action Dispatching", () => {
    it("dispatches GET_STATUS to gateway.getInfo()", async () => {
      const result = await handler.execute(
        ComputerActionName.GET_STATUS,
        {},
        validContext,
      );

      expect(mockGateway.getInfo).toHaveBeenCalledTimes(1);
      expect(result).toEqual(sampleInfo);
    });

    it("dispatches LIST_APPLICATIONS to gateway.listApplications()", async () => {
      const result = await handler.execute(
        ComputerActionName.LIST_APPLICATIONS,
        undefined,
        validContext,
      );

      expect(mockGateway.listApplications).toHaveBeenCalledTimes(1);
      expect(result).toEqual(sampleApps);
    });

    it("dispatches LIST_FILES with undefined path to gateway.listFiles()", async () => {
      const result = await handler.execute(
        ComputerActionName.LIST_FILES,
        {},
        validContext,
      );

      expect(mockGateway.listFiles).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(sampleFiles);
    });

    it("dispatches LIST_FILES with specific path to gateway.listFiles(path)", async () => {
      const result = await handler.execute(
        ComputerActionName.LIST_FILES,
        { path: "subfolder" },
        validContext,
      );

      expect(mockGateway.listFiles).toHaveBeenCalledWith("subfolder");
      expect(result).toEqual(sampleFiles);
    });

    it("dispatches READ_FILE with path to gateway.readFile(path)", async () => {
      const result = await handler.execute(
        ComputerActionName.READ_FILE,
        { path: "readme.txt" },
        validContext,
      );

      expect(mockGateway.readFile).toHaveBeenCalledWith("readme.txt");
      expect(result).toEqual(sampleFileContent);
    });

    it("dispatches LAUNCH_APPLICATION with appId to gateway.launchApplication(appId)", async () => {
      const result = await handler.execute(
        ComputerActionName.LAUNCH_APPLICATION,
        { appId: "notepad" },
        validContext,
      );

      expect(mockGateway.launchApplication).toHaveBeenCalledWith("notepad");
      expect(result).toEqual({ success: true, appId: "notepad" });
    });

    it("dispatches WRITE_FILE with path and content to gateway.writeFile(path, content)", async () => {
      const result = await handler.execute(
        ComputerActionName.WRITE_FILE,
        { path: "output.txt", content: "new content" },
        validContext,
      );

      expect(mockGateway.writeFile).toHaveBeenCalledWith("output.txt", "new content");
      expect(result).toEqual(sampleWriteResult);
    });
  });

  describe("Strict Parameter Validation & Fail-Closed Guards", () => {
    it("fails closed on invalid context", async () => {
      await expect(
        handler.execute(ComputerActionName.GET_STATUS, {}, null as any),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: "Invalid action execution context.",
      });
    });

    it("fails closed when action name is empty", async () => {
      await expect(
        handler.execute("", {}, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: "Action name must be a non-empty string.",
      });
    });

    it("fails closed on unknown or unregistered action names", async () => {
      await expect(
        handler.execute("computer_shutdown", {}, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Unknown or unregistered computer action "computer_shutdown".',
      });

      expect(mockGateway.getInfo).not.toHaveBeenCalled();
      expect(mockGateway.listApplications).not.toHaveBeenCalled();
    });

    it("fails GET_STATUS when non-object params are provided", async () => {
      await expect(
        handler.execute(ComputerActionName.GET_STATUS, "invalid", validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameters for "computer_get_status" must be an object if provided.',
      });
    });

    it("fails LIST_FILES when path is not a string", async () => {
      await expect(
        handler.execute(ComputerActionName.LIST_FILES, { path: 12345 }, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameter "path" for "computer_list_files" must be a string.',
      });
    });

    it("fails READ_FILE when params is missing or path is invalid", async () => {
      await expect(
        handler.execute(ComputerActionName.READ_FILE, undefined, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameters object is required for "computer_read_file".',
      });

      await expect(
        handler.execute(ComputerActionName.READ_FILE, { path: "" }, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameter "path" is required and must be a non-empty string for "computer_read_file".',
      });

      await expect(
        handler.execute(ComputerActionName.READ_FILE, { path: 999 }, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
      });
    });

    it("fails LAUNCH_APPLICATION when params is missing or appId is invalid", async () => {
      await expect(
        handler.execute(ComputerActionName.LAUNCH_APPLICATION, null, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameters object is required for "computer_launch_application".',
      });

      await expect(
        handler.execute(ComputerActionName.LAUNCH_APPLICATION, { appId: "   " }, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameter "appId" is required and must be a non-empty string for "computer_launch_application".',
      });
    });

    it("fails WRITE_FILE when path or content is missing or invalid", async () => {
      await expect(
        handler.execute(ComputerActionName.WRITE_FILE, { path: "a.txt" }, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameter "content" is required and must be a string for "computer_write_file".',
      });

      await expect(
        handler.execute(ComputerActionName.WRITE_FILE, { path: "", content: "abc" }, validContext),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: 'Parameter "path" is required and must be a non-empty string for "computer_write_file".',
      });
    });
  });

  describe("Gateway Error Translation", () => {
    it("wraps unexpected Gateway exceptions into structured ACTION_FAILED errors", async () => {
      (mockGateway.readFile as any).mockRejectedValueOnce(
        new Error("File not found on filesystem"),
      );

      await expect(
        handler.execute(
          ComputerActionName.READ_FILE,
          { path: "missing.txt" },
          validContext,
        ),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: "File not found on filesystem",
      });
    });

    it("preserves already structured ComputerAgentActionException", async () => {
      (mockGateway.launchApplication as any).mockRejectedValueOnce(
        new ComputerAgentActionException({
          message: "Application blocked by OS policy",
          code: ProtocolErrorCode.ACTION_FAILED,
        }),
      );

      await expect(
        handler.execute(
          ComputerActionName.LAUNCH_APPLICATION,
          { appId: "blocked-app" },
          validContext,
        ),
      ).rejects.toMatchObject({
        code: ProtocolErrorCode.ACTION_FAILED,
        message: "Application blocked by OS policy",
      });
    });
  });

  describe("Dispatcher + Authorizer + Gateway Execution Integration", () => {
    it("dispatches authorized read-only actions end-to-end to Gateway", async () => {
      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer: new ComputerAgentActionAuthorizer(),
        handler,
      });

      const response = await dispatcher.dispatch(
        {
          correlationId: "corr-101",
          action: ComputerActionName.GET_STATUS,
        },
        validContext,
      );

      expect(response.success).toBe(true);
      expect(response.correlationId).toBe("corr-101");
      expect(response.data).toEqual(sampleInfo);
      expect(mockGateway.getInfo).toHaveBeenCalledTimes(1);
    });

    it("dispatches authorized privileged actions end-to-end to Gateway when permission is granted", async () => {
      const permissionProvider = new InMemoryComputerActionPermissionProvider({
        "agent-123": [ComputerActionName.WRITE_FILE],
      });

      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer: new ComputerAgentActionAuthorizer({ permissionProvider }),
        handler,
      });

      const response = await dispatcher.dispatch(
        {
          correlationId: "corr-102",
          action: ComputerActionName.WRITE_FILE,
          params: { path: "output.txt", content: "data" },
        },
        validContext,
      );

      expect(response.success).toBe(true);
      expect(response.correlationId).toBe("corr-102");
      expect(response.data).toEqual(sampleWriteResult);
      expect(mockGateway.writeFile).toHaveBeenCalledWith("output.txt", "data");
    });

    it("fails at authorization and NEVER executes Gateway handler when privileged action is ungranted", async () => {
      const permissionProvider = new InMemoryComputerActionPermissionProvider(); // No grants

      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer: new ComputerAgentActionAuthorizer({ permissionProvider }),
        handler,
      });

      const response = await dispatcher.dispatch(
        {
          correlationId: "corr-103",
          action: ComputerActionName.WRITE_FILE,
          params: { path: "output.txt", content: "data" },
        },
        validContext,
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe(ProtocolErrorCode.UNAUTHORIZED);
      expect(mockGateway.writeFile).not.toHaveBeenCalled();
    });

    it("returns structured error response when Gateway execution fails", async () => {
      (mockGateway.readFile as any).mockRejectedValueOnce(
        new Error("Permission denied by OS"),
      );

      const dispatcher = new DefaultComputerAgentActionDispatcher({
        authorizer: new ComputerAgentActionAuthorizer(),
        handler,
      });

      const response = await dispatcher.dispatch(
        {
          correlationId: "corr-104",
          action: ComputerActionName.READ_FILE,
          params: { path: "secret.txt" },
        },
        validContext,
      );

      expect(response.success).toBe(false);
      expect(response.correlationId).toBe("corr-104");
      expect(response.error?.code).toBe(ProtocolErrorCode.ACTION_FAILED);
      expect(response.error?.message).toBe("Permission denied by OS");
    });
  });
});
