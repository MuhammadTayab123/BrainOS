import { prisma } from "../../../lib/prisma";
import { DatabaseClient } from "../../../lib/prisma.types";
import { NotFoundError } from "../../../errors";
import {
  GrantComputerAgentPermissionInput,
  RevokeComputerAgentPermissionInput,
  ListComputerAgentPermissionsInput,
  HasActivePermissionInput,
  ComputerAgentPermissionRecord,
} from "../computer-agent.types";

const computerAgentPermissionSelect = {
  id: true,
  agentId: true,
  action: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export class ComputerAgentPermissionRepository {
  constructor(private readonly db: DatabaseClient = prisma) {}

  /**
   * Grants an action permission to an owned, active Computer Agent.
   * Safe 3-way lifecycle:
   * 1. Active existing grant -> returns existing without creating duplicates.
   * 2. Soft-deleted grant -> reactivates by clearing deletedAt.
   * 3. Missing grant -> creates new permission record.
   */
  async grantPermission(
    data: GrantComputerAgentPermissionInput,
  ): Promise<ComputerAgentPermissionRecord> {
    const execute = async (client: DatabaseClient) => {
      const agent = await client.computerAgent.findFirst({
        where: {
          id: data.agentId,
          userId: data.userId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!agent) {
        throw new NotFoundError(
          "Computer agent not found for the authenticated user.",
        );
      }

      if (agent.status !== "ACTIVE") {
        throw new Error(
          "Cannot grant permissions for an inactive or revoked agent.",
        );
      }

      const existing = await client.computerAgentPermission.findFirst({
        where: {
          agentId: data.agentId,
          action: data.action,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: computerAgentPermissionSelect,
      });

      // Case 1: Active existing grant -> no-op
      if (existing && existing.deletedAt === null) {
        return existing;
      }

      // Case 2: Soft-deleted grant -> reactivate
      if (existing && existing.deletedAt !== null) {
        return client.computerAgentPermission.update({
          where: {
            id: existing.id,
          },
          data: {
            deletedAt: null,
            updatedAt: new Date(),
          },
          select: computerAgentPermissionSelect,
        });
      }

      // Case 3: Missing grant -> create new
      try {
        return await client.computerAgentPermission.create({
          data: {
            agentId: data.agentId,
            action: data.action,
          },
          select: computerAgentPermissionSelect,
        });
      } catch (err: unknown) {
        // Concurrency resilience: If a concurrent request already created/activated the permission (P2002),
        // recover by fetching and returning the active permission record.
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: unknown }).code === "P2002"
        ) {
          const active = await client.computerAgentPermission.findFirst({
            where: {
              agentId: data.agentId,
              action: data.action,
              deletedAt: null,
            },
            select: computerAgentPermissionSelect,
          });

          if (active) {
            return active;
          }
        }

        throw err;
      }
    };

    if ("$transaction" in this.db && typeof this.db.$transaction === "function") {
      return this.db.$transaction(async (tx) => execute(tx));
    }

    return execute(this.db);
  }

  /**
   * Revokes an action permission from an owned Computer Agent by soft-deleting it.
   */
  async revokePermission(
    data: RevokeComputerAgentPermissionInput,
    revokedAt: Date = new Date(),
  ): Promise<void> {
    const execute = async (client: DatabaseClient) => {
      const agent = await client.computerAgent.findFirst({
        where: {
          id: data.agentId,
          userId: data.userId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!agent) {
        throw new NotFoundError(
          "Computer agent not found for the authenticated user.",
        );
      }

      const result = await client.computerAgentPermission.updateMany({
        where: {
          agentId: data.agentId,
          action: data.action,
          deletedAt: null,
        },
        data: {
          deletedAt: revokedAt,
        },
      });

      if (result.count === 0) {
        throw new NotFoundError(
          "Computer agent permission not found or already revoked.",
        );
      }
    };

    if ("$transaction" in this.db && typeof this.db.$transaction === "function") {
      return this.db.$transaction(async (tx) => execute(tx));
    }

    return execute(this.db);
  }

  /**
   * Lists all active permissions granted to an owned Computer Agent.
   */
  async listPermissions(
    data: ListComputerAgentPermissionsInput,
  ): Promise<ComputerAgentPermissionRecord[]> {
    const agent = await this.db.computerAgent.findFirst({
      where: {
        id: data.agentId,
        userId: data.userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!agent) {
      throw new NotFoundError(
        "Computer agent not found for the authenticated user.",
      );
    }

    return this.db.computerAgentPermission.findMany({
      where: {
        agentId: data.agentId,
        deletedAt: null,
      },
      orderBy: {
        action: "asc",
      },
      select: computerAgentPermissionSelect,
    });
  }

  /**
   * Evaluates if an action is currently permitted for an active, owned Computer Agent.
   */
  async hasActivePermission(data: HasActivePermissionInput): Promise<boolean> {
    const count = await this.db.computerAgentPermission.count({
      where: {
        agentId: data.agentId,
        action: data.action,
        deletedAt: null,
        agent: {
          id: data.agentId,
          userId: data.userId,
          status: "ACTIVE",
          deletedAt: null,
        },
      },
    });

    return count > 0;
  }

  /**
   * Revokes all active permissions for an agent (used during agent revocation / deletion).
   */
  async revokeAllByAgentId(
    agentId: string,
    revokedAt: Date = new Date(),
  ): Promise<void> {
    await this.db.computerAgentPermission.updateMany({
      where: {
        agentId,
        deletedAt: null,
      },
      data: {
        deletedAt: revokedAt,
      },
    });
  }
}
