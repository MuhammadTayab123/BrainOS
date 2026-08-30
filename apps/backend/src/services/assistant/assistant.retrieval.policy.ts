export interface AssistantRetrievalPolicyInput {
  enableMemoryRetrieval?: boolean;
  enableDocumentRetrieval?: boolean;
}

export interface AssistantRetrievalPolicy {
  memory: boolean;
  documents: boolean;
}

export function decideAssistantRetrieval(
  input: AssistantRetrievalPolicyInput,
): AssistantRetrievalPolicy {
  return {
    memory: input.enableMemoryRetrieval ?? true,
    documents: input.enableDocumentRetrieval ?? false,
  };
}