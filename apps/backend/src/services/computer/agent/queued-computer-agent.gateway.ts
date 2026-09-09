import { AppError, NotFoundError } from "../../../errors";
import { ToolContext } from "../../tools/tool.types";
import { ComputerAgentRepository } from "../repositories/computer-agent.repository";
import { ComputerActionQueueService } from "../queue/computer-action-queue.service";
import {
  ComputerAgent,
  ComputerAgentInfo,
  ComputerApplication,
  ComputerFileContent,
  ComputerFileEntry,
  ComputerFileWriteResult,
} from "./computer-agent.types";
import { ComputerAgentGateway } from "./computer-agent.gateway";
import { LocalComputerAgent } from "./local-computer-agent";

export interface QueuedComputerAgentGatewayOptions {
  queueService?: ComputerActionQueueService;
  agentRepository?: ComputerAgentRepository;
  localFallbackAgent?: ComputerAgent;
  allowLocalFallback?: boolean;
  actionTimeoutMs?: number;
  pollIntervalMs?: number;
}

/**
 * Gateway adapter routing assistant computer actions to the user's active remote Computer Agent
 * via the persistent action queue, awaiting terminal execution results.
 *
 * Security & architectural guarantees:
 * - Strictly scopes action queueing and result retrieval to the authenticated context.userId.
 * - Resolves only ACTIVE agents owned by the user.
 * - Never allows user A to enqueue, poll, or receive user B's actions.
 * - Performs correlationId, agentId, actionId, and userId verification upon completion.
 * - Does not queue computer_get_status remotely; resolves agent status server-side from active records.
 * - Fails closed on inactive, missing, or timed-out remote agents.
 * - Preserves explicit, optional local fallback only when explicitly enabled.
 */
export class QueuedComputerAgentGateway extends ComputerAgentGateway {
  private readonly queueService: ComputerActionQueueService;
  private readonly agentRepository: ComputerAgentRepository;
  private readonly localFallbackAgent?: ComputerAgent;
  private readonly allowLocalFallback: boolean;
  private readonly actionTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: QueuedComputerAgentGatewayOptions = {}) {
    const fallback = options.localFallbackAgent ?? new LocalComputerAgent();
    super(fallback);

    this.queueService =
      options.queueService ?? new ComputerActionQueueService();
    this.agentRepository =
      options.agentRepository ?? new ComputerAgentRepository();
    this.localFallbackAgent = fallback;
    this.allowLocalFallback = options.allowLocalFallback ?? false;
    this.actionTimeoutMs = options.actionTimeoutMs ?? 30_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 100;
  }

  /**
   * Safe server-side agent status resolution.
   * Does not enqueue a remote action; inspects the user's registered active agent record.
   */
  override async getInfo(context?: ToolContext): Promise<ComputerAgentInfo> {
    const userId = context?.userId?.trim();

    if (userId) {
      const activeAgents = await this.agentRepository.listByUser({
        userId,
        status: "ACTIVE",
        limit: 1,
      });

      if (activeAgents.length > 0) {
        const agent = activeAgents[0];
        return {
          agentId: agent.id,
          status: "ONLINE",
          platform: "remote",
          architecture: "remote",
          capabilities: {
            status: true,
            applications: true,
            files: true,
            browser: false,
          },
        };
      }
    }

    if (this.allowLocalFallback && this.localFallbackAgent) {
      return this.localFallbackAgent.getInfo();
    }

    return {
      agentId: "none",
      status: "OFFLINE",
      platform: "unknown",
      architecture: "unknown",
      capabilities: {
        status: false,
        applications: false,
        files: false,
        browser: false,
      },
    };
  }

  override async listApplications(
    context?: ToolContext,
  ): Promise<ComputerApplication[]> {
    const agent = await this.resolveActiveAgent(context);
    if (!agent) {
      return this.localFallbackAgent!.listApplications();
    }

    return this.dispatchQueuedAction<ComputerApplication[]>(
      context!.userId,
      agent.id,
      "computer_list_applications",
      {},
    );
  }

  override async launchApplication(
    appId: string,
    context?: ToolContext,
  ): Promise<{ success: boolean; appId: string }> {
    if (typeof appId !== "string" || appId.trim().length === 0) {
      throw new Error("appId is required.");
    }

    const cleanAppId = appId.trim();
    const agent = await this.resolveActiveAgent(context);
    if (!agent) {
      return this.localFallbackAgent!.launchApplication(cleanAppId);
    }

    return this.dispatchQueuedAction<{ success: boolean; appId: string }>(
      context!.userId,
      agent.id,
      "computer_launch_application",
      { appId: cleanAppId },
    );
  }

  override async listFiles(
    path?: string,
    context?: ToolContext,
  ): Promise<ComputerFileEntry[]> {
    const agent = await this.resolveActiveAgent(context);
    if (!agent) {
      return this.localFallbackAgent!.listFiles(path);
    }

    return this.dispatchQueuedAction<ComputerFileEntry[]>(
      context!.userId,
      agent.id,
      "computer_list_files",
      path !== undefined ? { path } : {},
    );
  }

  override async readFile(
    path: string,
    context?: ToolContext,
  ): Promise<ComputerFileContent> {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new Error("path is required.");
    }

    const cleanPath = path.trim();
    const agent = await this.resolveActiveAgent(context);
    if (!agent) {
      return this.localFallbackAgent!.readFile(cleanPath);
    }

    return this.dispatchQueuedAction<ComputerFileContent>(
      context!.userId,
      agent.id,
      "computer_read_file",
      { path: cleanPath },
    );
  }

  override async writeFile(
    path: string,
    content: string,
    context?: ToolContext,
  ): Promise<ComputerFileWriteResult> {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new Error("path is required.");
    }

    if (typeof content !== "string") {
      throw new Error("content is required.");
    }

    const cleanPath = path.trim();
    const agent = await this.resolveActiveAgent(context);
    if (!agent) {
      return this.localFallbackAgent!.writeFile(cleanPath, content);
    }

    return this.dispatchQueuedAction<ComputerFileWriteResult>(
      context!.userId,
      agent.id,
      "computer_write_file",
      { path: cleanPath, content },
    );
  }

  private async resolveActiveAgent(
    context?: ToolContext,
  ): Promise<{ id: string; userId: string; name: string } | null> {
    const userId = context?.userId?.trim();

    if (!userId) {
      if (this.allowLocalFallback && this.localFallbackAgent) {
        return null;
      }
      throw new AppError({
        message: "Authenticated user ID is required for computer actions.",
        statusCode: 401,
        code: "UNAUTHORIZED",
      });
    }

    const activeAgents = await this.agentRepository.listByUser({
      userId,
      status: "ACTIVE",
      limit: 1,
    });

    if (activeAgents.length === 0) {
      if (this.allowLocalFallback && this.localFallbackAgent) {
        return null;
      }
      throw new NotFoundError(
        "No active computer agent found for user. Please start your BrainOS Computer Agent runner.",
      );
    }

    return activeAgents[0];
  }

  private async dispatchQueuedAction<TResult>(
    userId: string,
    agentId: string,
    actionName: string,
    params?: unknown,
  ): Promise<TResult> {
    const enqueued = await this.queueService.enqueueAction({
      userId,
      agentId,
      actionName,
      params,
      expiresInMs: this.actionTimeoutMs,
    });

    const completedRecord = await this.queueService.awaitActionCompletion({
      actionId: enqueued.id,
      userId,
      timeoutMs: this.actionTimeoutMs,
      pollIntervalMs: this.pollIntervalMs,
    });

    // Integrity check
    if (
      completedRecord.userId !== userId ||
      completedRecord.agentId !== agentId ||
      completedRecord.id !== enqueued.id ||
      completedRecord.correlationId !== enqueued.correlationId
    ) {
      throw new AppError({
        message: "Action result correlation integrity check failed.",
        statusCode: 500,
        code: "CORRELATION_INTEGRITY_FAILED",
      });
    }

    return completedRecord.result as TResult;
  }
}
