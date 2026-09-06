export type AssistantRuntimeState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "EXECUTING"
  | "SPEAKING"
  | "ERROR";

export type AssistantTaskEventType =
  | "TASK_STARTED"
  | "TASK_PROGRESS"
  | "TASK_COMPLETED"
  | "TASK_FAILED";

export interface AssistantTaskEvent {
  type: AssistantTaskEventType;
  taskId: string;
  message: string;
  timestamp: string;
}

export interface AssistantRuntimeSnapshot {
  state: AssistantRuntimeState;
  activeTaskId: string | null;
}

export type AssistantRuntimeEvent =
  | {
      type: "STATE_CHANGED";
      snapshot: AssistantRuntimeSnapshot;
    }
  | {
      type: "TASK_EVENT";
      event: AssistantTaskEvent;
    }
  | {
      type: "TEXT_DELTA";
      delta: string;
    };