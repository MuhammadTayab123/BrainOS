import { describe, expect, it, vi } from "vitest";

import { AssistantRuntime } from "../../src/services/assistant/assistant.runtime";

describe("AssistantRuntime", () => {
  it("starts idle", () => {
    const runtime = new AssistantRuntime();

    expect(runtime.getSnapshot()).toEqual({
      state: "IDLE",
      activeTaskId: null,
    });
  });

  it("updates runtime state", () => {
    const runtime = new AssistantRuntime();

    runtime.setState("LISTENING");

    expect(runtime.getSnapshot().state).toBe(
      "LISTENING",
    );
  });

  it("tracks an active task", () => {
    const runtime = new AssistantRuntime();

    const event = runtime.startTask("task-1");

    expect(event.type).toBe("TASK_STARTED");
    expect(event.taskId).toBe("task-1");

    expect(runtime.getSnapshot()).toEqual({
      state: "EXECUTING",
      activeTaskId: "task-1",
    });
  });

  it("returns progress events without completing the task", () => {
    const runtime = new AssistantRuntime();

    runtime.startTask("task-1");

    const event = runtime.progressTask(
      "task-1",
      "Opening WhatsApp.",
    );

    expect(event).toMatchObject({
      type: "TASK_PROGRESS",
      taskId: "task-1",
      message: "Opening WhatsApp.",
    });

    expect(runtime.getSnapshot()).toEqual({
      state: "EXECUTING",
      activeTaskId: "task-1",
    });
  });

  it("returns to idle after completing a task", () => {
    const runtime = new AssistantRuntime();

    runtime.startTask("task-1");

    const event = runtime.completeTask(
      "task-1",
      "Message sent.",
    );

    expect(event).toMatchObject({
      type: "TASK_COMPLETED",
      taskId: "task-1",
      message: "Message sent.",
    });

    expect(runtime.getSnapshot()).toEqual({
      state: "IDLE",
      activeTaskId: null,
    });
  });

  it("moves to error after a task fails", () => {
    const runtime = new AssistantRuntime();

    runtime.startTask("task-1");

    const event = runtime.failTask(
      "task-1",
      "Unable to send message.",
    );

    expect(event).toMatchObject({
      type: "TASK_FAILED",
      taskId: "task-1",
      message: "Unable to send message.",
    });

    expect(runtime.getSnapshot()).toEqual({
      state: "ERROR",
      activeTaskId: null,
    });
  });

 it("notifies subscribers of state changes and task events", () => {
  const runtime = new AssistantRuntime();
  const listener = vi.fn();

  const unsubscribe =
    runtime.subscribe(listener);

  expect(listener).toHaveBeenCalledWith({
    type: "STATE_CHANGED",
    snapshot: {
      state: "IDLE",
      activeTaskId: null,
    },
  });

  runtime.setState("THINKING");

  expect(listener).toHaveBeenLastCalledWith({
    type: "STATE_CHANGED",
    snapshot: {
      state: "THINKING",
      activeTaskId: null,
    },
  });

  runtime.startTask("task-1");

  expect(listener).toHaveBeenCalledWith({
    type: "TASK_EVENT",
    event: expect.objectContaining({
      type: "TASK_STARTED",
      taskId: "task-1",
      message: "Task started.",
    }),
  });

  runtime.progressTask(
    "task-1",
    "Opening WhatsApp.",
  );

  expect(listener).toHaveBeenCalledWith({
    type: "TASK_EVENT",
    event: expect.objectContaining({
      type: "TASK_PROGRESS",
      taskId: "task-1",
      message: "Opening WhatsApp.",
    }),
  });

  unsubscribe();

  runtime.setState("SPEAKING");

  const callsAfterUnsubscribe =
    listener.mock.calls.length;

  runtime.progressTask(
    "task-1",
    "This should not be received.",
  );

  expect(listener.mock.calls.length).toBe(
    callsAfterUnsubscribe,
  );
});
});