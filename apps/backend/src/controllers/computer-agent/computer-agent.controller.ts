import { Request, Response } from "express";
import { ComputerAgentStatus } from "@prisma/client";

import { ComputerAgentService } from "../../services/computer/computer-agent.service";
import { ComputerAgentRepository } from "../../services/computer/repositories/computer-agent.repository";

const computerAgentService = new ComputerAgentService(
  new ComputerAgentRepository(),
);

function unauthorized(res: Response) {
  return res.status(401).json({
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
  });
}

function getId(req: Request): string | null {
  const rawId = req.params.id;

  if (typeof rawId !== "string") {
    return null;
  }

  const id = rawId.trim();

  return id.length > 0 ? id : null;
}

export async function createComputerAgent(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { name, id } = req.body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_NAME",
        message: "Computer agent name is required.",
      },
    });
  }

  if (
    id !== undefined &&
    id !== null &&
    (typeof id !== "string" || id.trim().length === 0)
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AGENT_ID",
        message: "Agent ID must be a non-empty string.",
      },
    });
  }

  const result = await computerAgentService.registerAgent({
    userId: req.user.id,
    name: name.trim(),
    id: typeof id === "string" ? id.trim() : undefined,
  });

  return res.status(201).json({
    success: true,
    data: result,
  });
}

export async function listComputerAgents(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const { status, limit } = req.query;

  let parsedLimit: number | undefined;

  if (limit !== undefined) {
    if (typeof limit !== "string" || !/^\d+$/.test(limit)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: "Limit must be an integer between 1 and 50.",
        },
      });
    }

    parsedLimit = Number.parseInt(limit, 10);

    if (parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_LIMIT",
          message: "Limit must be an integer between 1 and 50.",
        },
      });
    }
  }

  let parsedStatus: ComputerAgentStatus | undefined;

  if (status !== undefined) {
    if (
      typeof status !== "string" ||
      !Object.values(ComputerAgentStatus).includes(
        status as ComputerAgentStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Invalid computer agent status.",
        },
      });
    }

    parsedStatus = status as ComputerAgentStatus;
  }

  const agents = await computerAgentService.listAgents({
    userId: req.user.id,
    status: parsedStatus,
    limit: parsedLimit,
  });

  return res.status(200).json({
    success: true,
    data: agents,
  });
}

export async function getComputerAgentById(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const agentId = getId(req);

  if (!agentId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AGENT_ID",
        message: "Agent ID is required.",
      },
    });
  }

  const agent = await computerAgentService.getAgent(agentId, req.user.id);

  return res.status(200).json({
    success: true,
    data: agent,
  });
}

export async function revokeComputerAgent(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const agentId = getId(req);

  if (!agentId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AGENT_ID",
        message: "Agent ID is required.",
      },
    });
  }

  await computerAgentService.revokeAgent(agentId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: agentId,
      status: ComputerAgentStatus.REVOKED,
    },
  });
}

export async function deleteComputerAgent(req: Request, res: Response) {
  if (!req.user) {
    return unauthorized(res);
  }

  const agentId = getId(req);

  if (!agentId) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_AGENT_ID",
        message: "Agent ID is required.",
      },
    });
  }

  await computerAgentService.deleteAgent(agentId, req.user.id);

  return res.status(200).json({
    success: true,
    data: {
      id: agentId,
      deleted: true,
    },
  });
}

export async function authenticateComputerAgent(req: Request, res: Response) {
  const { agentId, credential } = req.body ?? {};

  if (
    typeof agentId !== "string" ||
    agentId.trim().length === 0 ||
    typeof credential !== "string" ||
    credential.length === 0
  ) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid agent credentials.",
      },
    });
  }

  const result = await computerAgentService.authenticateAgent({
    agentId: agentId.trim(),
    credential,
  });

  if (!result.authenticated) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid agent credentials.",
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      authenticated: true,
      agentId: result.agentId,
    },
  });
}
