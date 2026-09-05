import { NotFoundError } from "../../errors";
import { logger } from "../../logger";
import {
  generateAgentCredential,
  hashCredential,
  verifyCredential,
  ComputerAgentAuthService,
} from "./security/computer-agent-auth.service";
import { ComputerAgentAuthResult } from "./security/computer-agent-auth.types";
import { ComputerAgentRepository } from "./repositories/computer-agent.repository";
import {
  ComputerAgentRecord,
  ListComputerAgentsOptions,
  RegisterComputerAgentInput,
  RegisteredComputerAgentResult,
  RotateComputerAgentCredentialOptions,
} from "./computer-agent.types";

const MAX_AGENT_LIST_LIMIT = 50;

export class ComputerAgentService {
  constructor(
    private readonly computerAgentRepository: ComputerAgentRepository,
    private readonly authService: ComputerAgentAuthService = new ComputerAgentAuthService(),
    private readonly log = logger,
  ) {}

  /**
   * Registers a new computer agent for an authenticated user.
   * Atomically generates a cryptographically secure random credential, stores ONLY the secure hash,
   * and returns the raw credential once for delivery to the agent.
   */
  async registerAgent(
    input: RegisterComputerAgentInput,
  ): Promise<RegisteredComputerAgentResult> {
    this.validateUserId(input.userId);
    this.validateName(input.name);

    if (input.id !== undefined) {
      this.validateId(input.id, "Agent ID");
    }

    const cleanUserId = input.userId.trim();
    const cleanName = input.name.trim();
    const cleanId = input.id?.trim();

    const credential = generateAgentCredential();
    const credentialHash = hashCredential(credential);

    let agent: ComputerAgentRecord;

    if (typeof this.computerAgentRepository.createWithCredential === "function") {
      agent = await this.computerAgentRepository.createWithCredential({
        userId: cleanUserId,
        name: cleanName,
        id: cleanId,
        credentialHash,
      });
    } else {
      agent = await this.computerAgentRepository.create({
        userId: cleanUserId,
        name: cleanName,
        id: cleanId,
      });

      await this.computerAgentRepository.createCredential({
        agentId: agent.id,
        credentialHash,
      });
    }

    this.log.info("Registered computer agent", {
      agentId: agent.id,
      userId: agent.userId,
    });

    return {
      agent,
      credential,
    };
  }

  /**
   * Rotates credentials for an active agent owned by the user.
   * Generates a new random credential, stores ONLY the secure hash, and returns the raw credential once.
   * If revokePrevious is true, immediately invalidates older active credentials.
   */
  async rotateCredential(
    agentId: string,
    userId: string,
    options?: RotateComputerAgentCredentialOptions,
  ): Promise<RegisteredComputerAgentResult> {
    this.validateUserId(userId);
    this.validateId(agentId, "Agent ID");

    const cleanUserId = userId.trim();
    const cleanAgentId = agentId.trim();

    const credential = generateAgentCredential();
    const credentialHash = hashCredential(credential);

    let agent: ComputerAgentRecord;

    if (
      typeof this.computerAgentRepository.rotateCredentialForUser === "function"
    ) {
      agent = await this.computerAgentRepository.rotateCredentialForUser({
        agentId: cleanAgentId,
        userId: cleanUserId,
        credentialHash,
        revokePrevious: options?.revokePrevious,
      });
    } else {
      const existing = await this.computerAgentRepository.findByIdForUser(
        cleanAgentId,
        cleanUserId,
      );

      if (!existing) {
        throw new NotFoundError(
          "Computer agent not found for the authenticated user.",
        );
      }

      if (existing.status !== "ACTIVE") {
        throw new Error(
          "Cannot rotate credentials for an inactive or revoked agent.",
        );
      }

      if (options?.revokePrevious) {
        await this.computerAgentRepository.revokeCredentialsByAgentId(
          cleanAgentId,
        );
      }

      await this.computerAgentRepository.createCredential({
        agentId: cleanAgentId,
        credentialHash,
      });

      agent = existing;
    }

    this.log.info("Rotated computer agent credential", {
      agentId: cleanAgentId,
      userId: cleanUserId,
      revokedPrevious: options?.revokePrevious ?? false,
    });

    return {
      agent,
      credential,
    };
  }

  /**
   * Lists agents owned by the authenticated user.
   */
  async listAgents(
    options: ListComputerAgentsOptions,
  ): Promise<ComputerAgentRecord[]> {
    this.validateUserId(options.userId);

    const limit = options.limit ?? MAX_AGENT_LIST_LIMIT;

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_AGENT_LIST_LIMIT
    ) {
      throw new Error(
        `Agent list limit must be an integer between 1 and ${MAX_AGENT_LIST_LIMIT}.`,
      );
    }

    return this.computerAgentRepository.listByUser({
      ...options,
      userId: options.userId.trim(),
      limit,
    });
  }

  /**
   * Retrieves a single agent owned by the authenticated user.
   */
  async getAgent(
    agentId: string,
    userId: string,
  ): Promise<ComputerAgentRecord> {
    this.validateUserId(userId);
    this.validateId(agentId, "Agent ID");

    const agent = await this.computerAgentRepository.findByIdForUser(
      agentId.trim(),
      userId.trim(),
    );

    if (!agent) {
      throw new NotFoundError(
        "Computer agent not found for the authenticated user.",
      );
    }

    return agent;
  }

  /**
   * Revokes an agent owned by the authenticated user.
   */
  async revokeAgent(
    agentId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(agentId, "Agent ID");

    await this.computerAgentRepository.revokeByIdForUser(
      agentId.trim(),
      userId.trim(),
    );

    this.log.info("Revoked computer agent", {
      agentId: agentId.trim(),
      userId: userId.trim(),
    });
  }

  /**
   * Soft deletes an agent owned by the authenticated user.
   */
  async deleteAgent(
    agentId: string,
    userId: string,
  ): Promise<void> {
    this.validateUserId(userId);
    this.validateId(agentId, "Agent ID");

    await this.computerAgentRepository.softDeleteByIdForUser(
      agentId.trim(),
      userId.trim(),
    );

    this.log.info("Deleted computer agent", {
      agentId: agentId.trim(),
      userId: userId.trim(),
    });
  }

  /**
   * Authenticates a computer agent using its agent ID and raw credential.
   * Checks agent status, verifies credential hashes timing-safely, and updates lastAuthenticatedAt on success.
   * Fails closed on invalid inputs, missing agents, revoked agents, or invalid credentials.
   * Never logs raw credentials.
   */
  async authenticateAgent(
    inputOrAgentId:
      | { agentId?: unknown; credential?: unknown }
      | unknown,
    maybeCredential?: unknown,
  ): Promise<ComputerAgentAuthResult> {
    let agentId: unknown;
    let credential: unknown;

    if (
      typeof inputOrAgentId === "object" &&
      inputOrAgentId !== null &&
      !Array.isArray(inputOrAgentId)
    ) {
      const obj = inputOrAgentId as Record<string, unknown>;
      agentId = obj.agentId;
      credential = obj.credential;
    } else {
      agentId = inputOrAgentId;
      credential = maybeCredential;
    }

    if (
      typeof agentId !== "string" ||
      agentId.trim().length === 0 ||
      typeof credential !== "string" ||
      credential.length === 0
    ) {
      this.log.warn(
        "Computer agent authentication failed: invalid credentials payload",
      );

      return {
        authenticated: false,
        reason: "Invalid or missing credentials",
      };
    }

    const cleanAgentId = agentId.trim();

    const agent = await this.computerAgentRepository.findById(cleanAgentId);

    if (!agent) {
      this.log.warn("Computer agent authentication failed: unknown agent", {
        agentId: cleanAgentId,
      });

      return {
        authenticated: false,
        reason: "Unknown agent ID",
      };
    }

    if (agent.status !== "ACTIVE") {
      this.log.warn("Computer agent authentication failed: agent not active", {
        agentId: cleanAgentId,
        status: agent.status,
      });

      return {
        authenticated: false,
        reason: "Agent is revoked or inactive",
      };
    }

    const credentials =
      await this.computerAgentRepository.findActiveCredentialsByAgentId(
        cleanAgentId,
      );

    if (!credentials || credentials.length === 0) {
      this.log.warn(
        "Computer agent authentication failed: no active credentials",
        {
          agentId: cleanAgentId,
        },
      );

      return {
        authenticated: false,
        reason: "Invalid credentials",
      };
    }

    const isValid = credentials.some((cred) =>
      verifyCredential(credential, cred.credentialHash),
    );

    if (!isValid) {
      this.log.warn(
        "Computer agent authentication failed: invalid credential",
        {
          agentId: cleanAgentId,
        },
      );

      return {
        authenticated: false,
        reason: "Invalid credentials",
      };
    }

    await this.computerAgentRepository.updateLastAuthenticatedAt(agent.id);

    this.log.info("Computer agent authenticated successfully", {
      agentId: agent.id,
    });

    return {
      authenticated: true,
      agentId: agent.id,
    };
  }

  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      throw new Error("User ID is required.");
    }
  }

  private validateId(value: string, fieldName: string): void {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${fieldName} is required.`);
    }
  }

  private validateName(name: string): void {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Computer agent name is required.");
    }
  }
}
