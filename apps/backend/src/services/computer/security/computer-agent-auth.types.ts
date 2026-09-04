export interface ComputerAgentCredentials {
  agentId: string;
  credential: string;
}

export interface StoredAgentCredential {
  agentId: string;
  credentialHash: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type ComputerAgentAuthResult =
  | {
      authenticated: true;
      agentId: string;
    }
  | {
      authenticated: false;
      agentId?: string;
      reason: string;
    };

export interface ComputerAgentCredentialStore {
  get(
    agentId: string,
  ):
    | Promise<StoredAgentCredential | null>
    | StoredAgentCredential
    | null;
  save(
    record: StoredAgentCredential,
  ): Promise<void> | void;
  delete?(
    agentId: string,
  ): Promise<boolean> | boolean;
}
