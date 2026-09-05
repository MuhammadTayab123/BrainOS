import { describe, expect, it, vi } from "vitest";

import { ComputerAgentStatus } from "@prisma/client";

import { NotFoundError } from "../../../../src/errors";
import { ComputerAgentRepository } from "../../../../src/services/computer/repositories/computer-agent.repository";

describe("ComputerAgentRepository", () => {
  it("creates a computer agent for an authenticated user", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      name: "Desktop Agent",
      status: ComputerAgentStatus.ACTIVE,
      lastAuthenticatedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const db = {
      computerAgent: {
        create,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.create({
      userId: "user-1",
      name: "Desktop Agent",
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          id: undefined,
          userId: "user-1",
          name: "Desktop Agent",
        },
        select: expect.objectContaining({
          id: true,
          userId: true,
          name: true,
          status: true,
        }),
      }),
    );
    expect(result.id).toBe("agent-1");
  });

  it("creates a computer agent and its initial credential atomically with createWithCredential", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      name: "Desktop Agent",
      status: ComputerAgentStatus.ACTIVE,
      lastAuthenticatedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const db = {
      computerAgent: {
        create,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.createWithCredential({
      userId: "user-1",
      name: "Desktop Agent",
      credentialHash: "scrypt:hash123",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        id: undefined,
        userId: "user-1",
        name: "Desktop Agent",
        credentials: {
          create: {
            credentialHash: "scrypt:hash123",
          },
        },
      },
      select: expect.objectContaining({
        id: true,
        userId: true,
        name: true,
        status: true,
      }),
    });
    expect(result.id).toBe("agent-1");
  });

  it("lists active agents for a user", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "agent-1",
        userId: "user-1",
        name: "Workstation",
        status: ComputerAgentStatus.ACTIVE,
      },
    ]);

    const db = {
      computerAgent: {
        findMany,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.listByUser({
      userId: "user-1",
      status: ComputerAgentStatus.ACTIVE,
      limit: 10,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        deletedAt: null,
        status: ComputerAgentStatus.ACTIVE,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      select: expect.objectContaining({
        id: true,
        userId: true,
        name: true,
        status: true,
      }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Workstation");
  });

  it("finds an agent owned by the user", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      name: "Workstation",
      status: ComputerAgentStatus.ACTIVE,
    });

    const db = {
      computerAgent: {
        findFirst,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.findByIdForUser("agent-1", "user-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "agent-1",
        userId: "user-1",
        deletedAt: null,
      },
      select: expect.objectContaining({
        id: true,
        userId: true,
      }),
    });
    expect(result?.id).toBe("agent-1");
  });

  it("finds an agent by id for internal lookup", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      name: "Workstation",
      status: ComputerAgentStatus.ACTIVE,
    });

    const db = {
      computerAgent: {
        findFirst,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.findById("agent-1");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "agent-1",
        deletedAt: null,
      },
      select: expect.objectContaining({
        id: true,
      }),
    });
    expect(result?.id).toBe("agent-1");
  });

  it("revokes an agent owned by the user and invalidates active credentials", async () => {
    const updateAgentMany = vi.fn().mockResolvedValue({
      count: 1,
    });
    const updateCredMany = vi.fn().mockResolvedValue({
      count: 1,
    });
    const updatePermMany = vi.fn().mockResolvedValue({
      count: 1,
    });

    const db = {
      computerAgent: {
        updateMany: updateAgentMany,
      },
      computerAgentCredential: {
        updateMany: updateCredMany,
      },
      computerAgentPermission: {
        updateMany: updatePermMany,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);
    const revokedAt = new Date("2026-09-05T00:00:00.000Z");

    await repository.revokeByIdForUser("agent-1", "user-1", revokedAt);

    expect(updateAgentMany).toHaveBeenCalledWith({
      where: {
        id: "agent-1",
        userId: "user-1",
        deletedAt: null,
      },
      data: {
        status: ComputerAgentStatus.REVOKED,
        revokedAt,
      },
    });

    expect(updateCredMany).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        deletedAt: null,
      },
      data: {
        deletedAt: revokedAt,
      },
    });

    expect(updatePermMany).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        deletedAt: null,
      },
      data: {
        deletedAt: revokedAt,
      },
    });
  });

  it("throws NotFoundError when revoking a missing or unowned agent", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 0,
    });

    const db = {
      computerAgent: {
        updateMany,
      },
      computerAgentCredential: {
        updateMany: vi.fn(),
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await expect(
      repository.revokeByIdForUser("missing-agent", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("revokes credentials for an agent with revokeCredentialsByAgentId", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 2,
    });

    const db = {
      computerAgentCredential: {
        updateMany,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);
    const revokedAt = new Date("2026-09-05T00:00:00.000Z");

    await repository.revokeCredentialsByAgentId("agent-1", revokedAt);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        deletedAt: null,
      },
      data: {
        deletedAt: revokedAt,
      },
    });
  });

  it("creates a credential record linked to an agent", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "cred-1",
      agentId: "agent-1",
      credentialHash: "scrypt:hash123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const db = {
      computerAgentCredential: {
        create,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await repository.createCredential({
      agentId: "agent-1",
      credentialHash: "scrypt:hash123",
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        credentialHash: "scrypt:hash123",
      },
    });
  });

  it("finds active credentials for an active agent", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "cred-1",
        agentId: "agent-1",
        credentialHash: "scrypt:hash123",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const db = {
      computerAgentCredential: {
        findMany,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.findActiveCredentialsByAgentId("agent-1");

    expect(findMany).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
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
    expect(result).toHaveLength(1);
    expect(result[0].credentialHash).toBe("scrypt:hash123");
  });

  it("updates lastAuthenticatedAt for an agent", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 1,
    });

    const db = {
      computerAgent: {
        updateMany,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);
    const authDate = new Date("2026-09-05T01:00:00.000Z");

    await repository.updateLastAuthenticatedAt("agent-1", authDate);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "agent-1",
        deletedAt: null,
      },
      data: {
        lastAuthenticatedAt: authDate,
      },
    });
  });

  it("throws NotFoundError when updating lastAuthenticatedAt for missing agent", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 0,
    });

    const db = {
      computerAgent: {
        updateMany,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await expect(
      repository.updateLastAuthenticatedAt("missing-agent"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rotates credential for an agent with rotateCredentialForUser", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      status: ComputerAgentStatus.ACTIVE,
    });
    const updateManyCred = vi.fn().mockResolvedValue({ count: 1 });
    const createCred = vi.fn().mockResolvedValue({ id: "cred-new" });

    const db = {
      computerAgent: {
        findFirst,
      },
      computerAgentCredential: {
        updateMany: updateManyCred,
        create: createCred,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);
    const revokedAt = new Date("2026-09-05T01:00:00.000Z");

    const result = await repository.rotateCredentialForUser({
      agentId: "agent-1",
      userId: "user-1",
      credentialHash: "scrypt:newhash",
      revokePrevious: true,
      revokedAt,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "agent-1",
        userId: "user-1",
        deletedAt: null,
      },
      select: expect.any(Object),
    });

    expect(updateManyCred).toHaveBeenCalledWith({
      where: {
        agentId: "agent-1",
        deletedAt: null,
      },
      data: {
        deletedAt: revokedAt,
      },
    });

    expect(createCred).toHaveBeenCalledWith({
      data: {
        agentId: "agent-1",
        credentialHash: "scrypt:newhash",
      },
    });

    expect(result.id).toBe("agent-1");
  });

  it("rotates credential with rotateCredentialForUser inside $transaction when available", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      status: ComputerAgentStatus.ACTIVE,
    });
    const createCred = vi.fn().mockResolvedValue({ id: "cred-new" });

    const txClient = {
      computerAgent: {
        findFirst,
      },
      computerAgentCredential: {
        create: createCred,
      },
    };

    const db = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(txClient)),
    } as any;

    const repository = new ComputerAgentRepository(db);

    const result = await repository.rotateCredentialForUser({
      agentId: "agent-1",
      userId: "user-1",
      credentialHash: "scrypt:newhash",
      revokePrevious: false,
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalled();
    expect(createCred).toHaveBeenCalled();
    expect(result.id).toBe("agent-1");
  });

  it("throws NotFoundError when rotating credentials for missing agent in rotateCredentialForUser", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const db = {
      computerAgent: {
        findFirst,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await expect(
      repository.rotateCredentialForUser({
        agentId: "missing-agent",
        userId: "user-1",
        credentialHash: "scrypt:hash",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws Error when rotating credentials for inactive agent in rotateCredentialForUser", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "agent-1",
      userId: "user-1",
      status: ComputerAgentStatus.REVOKED,
    });

    const db = {
      computerAgent: {
        findFirst,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await expect(
      repository.rotateCredentialForUser({
        agentId: "agent-1",
        userId: "user-1",
        credentialHash: "scrypt:hash",
      }),
    ).rejects.toThrow(
      "Cannot rotate credentials for an inactive or revoked agent.",
    );
  });

  it("soft deletes an agent owned by the user", async () => {
    const updateManyAgent = vi.fn().mockResolvedValue({
      count: 1,
    });
    const updateManyCred = vi.fn().mockResolvedValue({
      count: 1,
    });
    const updateManyPerm = vi.fn().mockResolvedValue({
      count: 1,
    });

    const db = {
      computerAgent: {
        updateMany: updateManyAgent,
      },
      computerAgentCredential: {
        updateMany: updateManyCred,
      },
      computerAgentPermission: {
        updateMany: updateManyPerm,
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await repository.softDeleteByIdForUser("agent-1", "user-1");

    expect(updateManyAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "agent-1",
          userId: "user-1",
          deletedAt: null,
        },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );

    expect(updateManyCred).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          agentId: "agent-1",
          deletedAt: null,
        },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );

    expect(updateManyPerm).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          agentId: "agent-1",
          deletedAt: null,
        },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("throws NotFoundError when deleting a missing agent", async () => {
    const updateMany = vi.fn().mockResolvedValue({
      count: 0,
    });

    const db = {
      computerAgent: {
        updateMany,
      },
      computerAgentCredential: {
        updateMany: vi.fn(),
      },
    } as any;

    const repository = new ComputerAgentRepository(db);

    await expect(
      repository.softDeleteByIdForUser("missing", "user-1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
