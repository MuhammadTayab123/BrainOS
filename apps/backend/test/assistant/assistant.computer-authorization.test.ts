import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantService } from "../../src/services/assistant/assistant.service";
import { LLMService } from "../../src/services/ai";
import { MemoryService } from "../../src/services/memory/memory.service";
import { ToolExecutor } from "../../src/services/tools/tool.executor";
import { ToolRegistry } from "../../src/services/tools/tool.registry";
import { ToolAuditService } from "../../src/services/security/tool-audit.service";
import {
  createComputerTools,
  createGetComputerStatusTool,
  createLaunchComputerApplicationTool,
  createReadComputerFileTool,
  createWriteComputerFileTool,
} from "../../src/services/tools/computer.tools";
import { ComputerAgentGateway } from "../../src/services/computer/agent/computer-agent.gateway";
import { ComputerAuthorizationService } from "../../src/services/computer/security/computer-authorization.service";
import { VoiceService } from "../../src/services/voice/voice.service";
import { VoiceTurnInput } from "../../src/services/voice/voice.types";

describe("Assistant & Voice Computer Authorization Integration (Mission 70)", () => {
  let mockLLMService: {
    generate: ReturnType<typeof vi.fn>;
  };
  let mockMemoryService: {
    searchMemories: ReturnType<typeof vi.fn>;
  };
  let mockGateway: ComputerAgentGateway;
  let mockAuthService: ComputerAuthorizationService;
  let auditService: ToolAuditService;
  let toolExecutor: ToolExecutor;
  let assistantService: AssistantService;

  beforeEach(() => {
    mockLLMService = {
      generate: vi.fn(),
    };

    mockMemoryService = {
      searchMemories: vi.fn().mockResolvedValue([]),
    };

    mockGateway = {
      getInfo: vi.fn().mockResolvedValue({
        agentId: "local-test",
        status: "ONLINE",
        platform: "win32",
        architecture: "x64",
        capabilities: {
          status: true,
          applications: true,
          files: true,
          browser: false,
        },
      }),
      listApplications: vi.fn().mockResolvedValue([]),
      launchApplication: vi.fn().mockResolvedValue({ success: true, appId: "notepad" }),
      listFiles: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue({ content: "read only content" }),
      writeFile: vi.fn().mockResolvedValue({ success: true, bytesWritten: 12 }),
      isOnline: vi.fn().mockResolvedValue(true),
    } as unknown as ComputerAgentGateway;

    mockAuthService = {
      resolveActiveAgent: vi.fn().mockResolvedValue(null),
      resolveServerGrantedActions: vi.fn().mockResolvedValue([]),
      resolveEffectiveActions: vi.fn().mockResolvedValue([]),
    };

    auditService = new ToolAuditService();
    const registry = new ToolRegistry();
    const tools = createComputerTools(mockGateway);
    for (const tool of tools) {
      registry.register(tool);
    }

    toolExecutor = new ToolExecutor(registry, auditService);

    assistantService = new AssistantService(
      mockLLMService as unknown as LLMService,
      mockMemoryService as unknown as MemoryService,
      toolExecutor,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockAuthService,
    );
  });

  it("denies client attempts to authorize computer_launch_application without DB permission", async () => {
    // LLM calls computer_launch_application
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-1",
          name: "computer_launch_application",
          arguments: { appId: "calc" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Done",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Server grants nothing (DB has no permission)
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([]);

    const response = await assistantService.ask({
      userId: "user-1",
      message: "Launch calculator",
      authorizedComputerActions: ["computer_launch_application"], // Client tries to self-authorize
    });

    // Gateway must NOT have been called
    expect(mockGateway.launchApplication).not.toHaveBeenCalled();

    // Verify authService was invoked with user-1 and client-requested subset
    expect(mockAuthService.resolveEffectiveActions).toHaveBeenCalledWith("user-1", [
      "computer_launch_application",
    ]);

    // Assistant handled the unauthorized error
    expect(response.text).toBe("Done");
  });

  it("denies client attempts to authorize computer_write_file without DB permission", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-2",
          name: "computer_write_file",
          arguments: { path: "test.txt", content: "hello" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Done",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Server grants nothing
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([]);

    await assistantService.ask({
      userId: "user-1",
      message: "Write to test.txt",
      authorizedComputerActions: ["computer_write_file"],
    });

    expect(mockGateway.writeFile).not.toHaveBeenCalled();
  });

  it("allows permitted action when requested by client", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-3",
          name: "computer_write_file",
          arguments: { path: "notes.txt", content: "brainos update" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "File saved.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Server-granted matches client request
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([
      "computer_write_file",
    ]);

    const response = await assistantService.ask({
      userId: "user-1",
      message: "Write to notes.txt",
      authorizedComputerActions: ["computer_write_file"],
    });

    expect(mockGateway.writeFile).toHaveBeenCalledWith("notes.txt", "brainos update");
    expect(response.text).toBe("File saved.");
  });

  it("denies action when DB permission was revoked", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-4",
          name: "computer_write_file",
          arguments: { path: "notes.txt", content: "test" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Cannot write file.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Revoked in DB -> effective is empty
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([]);

    await assistantService.ask({
      userId: "user-1",
      message: "Write file",
      authorizedComputerActions: ["computer_write_file"],
    });

    expect(mockGateway.writeFile).not.toHaveBeenCalled();
  });

  it("denies action on wrong user/agent ownership", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-5",
          name: "computer_launch_application",
          arguments: { appId: "calc" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Done",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // user-2 has no agent
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([]);

    await assistantService.ask({
      userId: "user-2",
      message: "Launch calc",
      authorizedComputerActions: ["computer_launch_application"],
    });

    expect(mockAuthService.resolveEffectiveActions).toHaveBeenCalledWith("user-2", [
      "computer_launch_application",
    ]);
    expect(mockGateway.launchApplication).not.toHaveBeenCalled();
  });

  it("denies unknown computer action", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-6",
          name: "unknown_computer_action",
          arguments: {},
        },
      ],
    }).mockResolvedValueOnce({
      text: "Done",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([]);

    await assistantService.ask({
      userId: "user-1",
      message: "Run unknown tool",
      authorizedComputerActions: ["unknown_computer_action"],
    });

    expect(mockGateway.launchApplication).not.toHaveBeenCalled();
    expect(mockGateway.writeFile).not.toHaveBeenCalled();
  });

  it("allows read-only computer tools to remain usable without DB permission or client authorization", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-read-status",
          name: "computer_get_status",
          arguments: {},
        },
        {
          id: "call-read-file",
          name: "computer_read_file",
          arguments: { path: "README.md" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Status and content retrieved.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // No authorized actions requested or granted
    const response = await assistantService.ask({
      userId: "user-1",
      message: "Check computer status and read README",
      authorizedComputerActions: undefined,
    });

    expect(mockGateway.getInfo).toHaveBeenCalled();
    expect(mockGateway.readFile).toHaveBeenCalledWith("README.md");
    expect(response.text).toBe("Status and content retrieved.");
  });

  it("verifies Voice uses the exact same authorization path", async () => {
    // Construct real VoiceService with the secured AssistantService
    const voiceService = new VoiceService(assistantService);

    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "voice-call-1",
          name: "computer_write_file",
          arguments: { path: "voice-notes.txt", content: "spoken note" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Voice note written.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Server-granted matches client request
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([
      "computer_write_file",
    ]);

    const voiceInput: VoiceTurnInput = {
      userId: "user-1",
      transcript: "Write a voice note",
      authorizedComputerActions: ["computer_write_file"],
    };

    const voiceResult = await voiceService.processTurn(voiceInput);

    expect(mockAuthService.resolveEffectiveActions).toHaveBeenCalledWith("user-1", [
      "computer_write_file",
    ]);
    expect(mockGateway.writeFile).toHaveBeenCalledWith("voice-notes.txt", "spoken note");
    expect(voiceResult.assistantResponse.text).toBe("Voice note written.");
  });

  it("auto-resolves server permissions and allows execution when authorizedComputerActions is omitted (undefined)", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-auto-1",
          name: "computer_launch_application",
          arguments: { appId: "notepad" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Notepad launched successfully.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Mock auth service auto-resolves to server-granted permissions
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([
      "computer_launch_application",
    ]);

    const response = await assistantService.ask({
      userId: "user-1",
      message: "Launch notepad",
      // authorizedComputerActions is intentionally omitted
    });

    expect(mockAuthService.resolveEffectiveActions).toHaveBeenCalledWith("user-1", undefined);
    expect(mockGateway.launchApplication).toHaveBeenCalledWith("notepad");
    expect(response.text).toBe("Notepad launched successfully.");
  });

  it("auto-resolves and fails closed when authorizedComputerActions is omitted and user has no server permissions", async () => {
    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "call-auto-2",
          name: "computer_write_file",
          arguments: { path: "secret.txt", content: "data" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Could not write file.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    // Auth service auto-resolves to empty array (no active agent or 0 permissions)
    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([]);

    const response = await assistantService.ask({
      userId: "user-1",
      message: "Write to secret.txt",
      // authorizedComputerActions omitted
    });

    expect(mockAuthService.resolveEffectiveActions).toHaveBeenCalledWith("user-1", undefined);
    expect(mockGateway.writeFile).not.toHaveBeenCalled();
    expect(response.text).toBe("Could not write file.");
  });

  it("auto-resolves server permissions and allows execution when authorizedComputerActions is omitted in VoiceService.processTurn", async () => {
    const voiceService = new VoiceService(assistantService);

    mockLLMService.generate.mockResolvedValueOnce({
      text: null,
      model: "test-llm",
      provider: "test",
      toolCalls: [
        {
          id: "voice-auto-1",
          name: "computer_launch_application",
          arguments: { appId: "calc" },
        },
      ],
    }).mockResolvedValueOnce({
      text: "Calculator opened.",
      model: "test-llm",
      provider: "test",
      toolCalls: [],
    });

    vi.mocked(mockAuthService.resolveEffectiveActions).mockResolvedValueOnce([
      "computer_launch_application",
    ]);

    const voiceInput: VoiceTurnInput = {
      userId: "user-1",
      transcript: "Open calculator",
      // authorizedComputerActions omitted
    };

    const voiceResult = await voiceService.processTurn(voiceInput);

    expect(mockAuthService.resolveEffectiveActions).toHaveBeenCalledWith("user-1", undefined);
    expect(mockGateway.launchApplication).toHaveBeenCalledWith("calc");
    expect(voiceResult.assistantResponse.text).toBe("Calculator opened.");
  });
});
