import {
  AssistantRuntimeEvent,
  AssistantRuntimeSnapshot,
  AssistantRuntimeState,
  AssistantTaskEvent,
} from "./assistant.runtime.types";

type RuntimeListener = (
  event: AssistantRuntimeEvent,
) => void;

export class AssistantRuntime {
  private state: AssistantRuntimeState = "IDLE";
  private activeTaskId: string | null = null;

  private readonly listeners =
    new Set<RuntimeListener>();

  getSnapshot(): AssistantRuntimeSnapshot {
    return {
      state: this.state,
      activeTaskId: this.activeTaskId,
    };
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);

    listener({
      type: "STATE_CHANGED",
      snapshot: this.getSnapshot(),
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(state: AssistantRuntimeState): void {
    this.state = state;

    this.emit({
      type: "STATE_CHANGED",
      snapshot: this.getSnapshot(),
    });
  }

  startTask(taskId: string): AssistantTaskEvent {
    this.activeTaskId = taskId;
    this.state = "EXECUTING";

    this.emit({
      type: "STATE_CHANGED",
      snapshot: this.getSnapshot(),
    });

    const event = this.createEvent(
      "TASK_STARTED",
      taskId,
      "Task started.",
    );

    this.emit({
      type: "TASK_EVENT",
      event,
    });

    return event;
  }

  progressTask(
    taskId: string,
    message: string,
  ): AssistantTaskEvent {
    const event = this.createEvent(
      "TASK_PROGRESS",
      taskId,
      message,
    );

    this.emit({
      type: "TASK_EVENT",
      event,
    });

    return event;
  }

  completeTask(
    taskId: string,
    message = "Task completed.",
  ): AssistantTaskEvent {
    const event = this.createEvent(
      "TASK_COMPLETED",
      taskId,
      message,
    );

    this.emit({
      type: "TASK_EVENT",
      event,
    });

    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
      this.state = "IDLE";

      this.emit({
        type: "STATE_CHANGED",
        snapshot: this.getSnapshot(),
      });
    }

    return event;
  }

  failTask(
    taskId: string,
    message = "Task failed.",
  ): AssistantTaskEvent {
    const event = this.createEvent(
      "TASK_FAILED",
      taskId,
      message,
    );

    this.emit({
      type: "TASK_EVENT",
      event,
    });

    if (this.activeTaskId === taskId) {
      this.activeTaskId = null;
      this.state = "ERROR";

      this.emit({
        type: "STATE_CHANGED",
        snapshot: this.getSnapshot(),
      });
    }

    return event;
  }

  private createEvent(
    type: AssistantTaskEvent["type"],
    taskId: string,
    message: string,
  ): AssistantTaskEvent {
    return {
      type,
      taskId,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  private emit(event: AssistantRuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}