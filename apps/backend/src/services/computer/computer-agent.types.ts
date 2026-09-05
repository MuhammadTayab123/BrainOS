import { ComputerAgentStatus } from "@prisma/client";

export {
  ComputerAgentStatus,
};

export interface CreateComputerAgentInput {
  userId: string;
  name: string;
  id?: string;
}

export type RegisterComputerAgentInput = CreateComputerAgentInput;

export interface RegisteredComputerAgentResult {
  agent: ComputerAgentRecord;
  credential: string;
}

export interface ListComputerAgentsOptions {
  userId: string;
  status?: ComputerAgentStatus;
  limit?: number;
}

export interface RotateComputerAgentCredentialOptions {
  revokePrevious?: boolean;
}

export interface CreateComputerAgentCredentialInput {
  agentId: string;
  credentialHash: string;
}

export interface ComputerAgentRecord {
  id: string;
  userId: string;
  name: string;
  status: ComputerAgentStatus;
  lastAuthenticatedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ComputerAgentCredentialRecord {
  id: string;
  agentId: string;
  credentialHash: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
