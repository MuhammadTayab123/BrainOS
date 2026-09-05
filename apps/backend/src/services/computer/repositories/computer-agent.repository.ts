import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";

import {
  CreateComputerAgentCredentialInput,
  CreateComputerAgentInput,
  ListComputerAgentsOptions,
} from "../computer-agent.types";

const computerAgentSelect = {
  id: true,
  userId: true,
  name: true,
  status: true,
  lastAuthenticatedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ComputerAgentRepository {
  constructor(
    private readonly db: DatabaseClient = prisma,
  ) {}

  async create(data: CreateComputerAgentInput) {
    return this.db.computerAgent.create({
      data: {
        id: data.id,
        userId: data.userId,
        name: data.name,
      },
      select: computerAgentSelect,
    });
  }

  async createWithCredential(data: {
    userId: string;
    name: string;
    id?: string;
    credentialHash: string;
  }) {
    return this.db.computerAgent.create({
      data: {
        id: data.id,
        userId: data.userId,
        name: data.name,
        credentials: {
          create: {
            credentialHash: data.credentialHash,
          },
        },
      },
      select: computerAgentSelect,
    });
  }

  async listByUser(options: ListComputerAgentsOptions) {
    const {
      userId,
      status,
      limit = 50,
    } = options;

    return this.db.computerAgent.findMany({
      where: {
        userId,
        deletedAt: null,
        status,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: computerAgentSelect,
    });
  }

  async findByIdForUser(
    agentId: string,
    userId: string,
  ) {
    return this.db.computerAgent.findFirst({
      where: {
        id: agentId,
        userId,
        deletedAt: null,
      },
      select: computerAgentSelect,
    });
  }

  async findById(agentId: string) {
    return this.db.computerAgent.findFirst({
      where: {
        id: agentId,
        deletedAt: null,
      },
      select: computerAgentSelect,
    });
  }

  async revokeByIdForUser(
    agentId: string,
    userId: string,
    revokedAt: Date = new Date(),
  ): Promise<void> {
    const execute = async (client: DatabaseClient) => {
      const result = await client.computerAgent.updateMany({
        where: {
          id: agentId,
          userId,
          deletedAt: null,
        },
        data: {
          status: "REVOKED",
          revokedAt,
        },
      });

      if (result.count === 0) {
        throw new NotFoundError(
          "Computer agent not found for the authenticated user.",
        );
      }

      await client.computerAgentCredential.updateMany({
        where: {
          agentId,
          deletedAt: null,
        },
        data: {
          deletedAt: revokedAt,
        },
      });
    };

    if ("$transaction" in this.db && typeof this.db.$transaction === "function") {
      return this.db.$transaction(async (tx) => execute(tx));
    }

    return execute(this.db);
  }

  async createCredential(data: CreateComputerAgentCredentialInput) {
    return this.db.computerAgentCredential.create({
      data: {
        agentId: data.agentId,
        credentialHash: data.credentialHash,
      },
    });
  }

  async rotateCredentialForUser(data: {
    agentId: string;
    userId: string;
    credentialHash: string;
    revokePrevious?: boolean;
    revokedAt?: Date;
  }) {
    const revokedAt = data.revokedAt ?? new Date();

    const execute = async (client: DatabaseClient) => {
      const agent = await client.computerAgent.findFirst({
        where: {
          id: data.agentId,
          userId: data.userId,
          deletedAt: null,
        },
        select: computerAgentSelect,
      });

      if (!agent) {
        throw new NotFoundError(
          "Computer agent not found for the authenticated user.",
        );
      }

      if (agent.status !== "ACTIVE") {
        throw new Error(
          "Cannot rotate credentials for an inactive or revoked agent.",
        );
      }

      if (data.revokePrevious) {
        await client.computerAgentCredential.updateMany({
          where: {
            agentId: data.agentId,
            deletedAt: null,
          },
          data: {
            deletedAt: revokedAt,
          },
        });
      }

      await client.computerAgentCredential.create({
        data: {
          agentId: data.agentId,
          credentialHash: data.credentialHash,
        },
      });

      return agent;
    };

    if ("$transaction" in this.db && typeof this.db.$transaction === "function") {
      return this.db.$transaction(async (tx) => execute(tx));
    }

    return execute(this.db);
  }

  async revokeCredentialsByAgentId(
    agentId: string,
    revokedAt: Date = new Date(),
  ): Promise<void> {
    await this.db.computerAgentCredential.updateMany({
      where: {
        agentId,
        deletedAt: null,
      },
      data: {
        deletedAt: revokedAt,
      },
    });
  }

  async findActiveCredentialsByAgentId(agentId: string) {
    return this.db.computerAgentCredential.findMany({
      where: {
        agentId,
        deletedAt: null,
        agent: {
          deletedAt: null,
          status: "ACTIVE",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findActiveCredentials(agentId: string) {
    return this.findActiveCredentialsByAgentId(agentId);
  }

  async updateLastAuthenticatedAt(
    agentId: string,
    lastAuthenticatedAt: Date = new Date(),
  ): Promise<void> {
    const result = await this.db.computerAgent.updateMany({
      where: {
        id: agentId,
        deletedAt: null,
      },
      data: {
        lastAuthenticatedAt,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError("Computer agent not found.");
    }
  }

  async softDeleteByIdForUser(
    agentId: string,
    userId: string,
  ): Promise<void> {
    const deletedAt = new Date();

    const execute = async (client: DatabaseClient) => {
      const result = await client.computerAgent.updateMany({
        where: {
          id: agentId,
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt,
        },
      });

      if (result.count === 0) {
        throw new NotFoundError(
          "Computer agent not found for the authenticated user.",
        );
      }

      await client.computerAgentCredential.updateMany({
        where: {
          agentId,
          deletedAt: null,
        },
        data: {
          deletedAt,
        },
      });
    };

    if ("$transaction" in this.db && typeof this.db.$transaction === "function") {
      return this.db.$transaction(async (tx) => execute(tx));
    }

    return execute(this.db);
  }
}
