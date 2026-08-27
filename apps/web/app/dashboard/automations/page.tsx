"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, UserButton, useAuth } from "@clerk/nextjs";

type Automation = {
  id: string;
  userId: string;
  name: string;
  status: string;
  triggerType: string;
  actionType: string;
  config: Record<string, unknown>;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

const API_URL = "http://localhost:3001";

const triggerOptions = [
  {
    value: "SCHEDULE",
    label: "Schedule",
  },
  {
    value: "TASK_DUE",
    label: "Task due",
  },
];

const actionOptions = [
  {
    value: "CREATE_TASK",
    label: "Create task",
  },
  {
    value: "CREATE_REMINDER",
    label: "Create reminder",
  },
];

export default function AutomationsPage() {
  const { getToken } = useAuth();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Automation fields
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("SCHEDULE");
  const [actionType, setActionType] = useState("CREATE_TASK");
  const [nextRunAt, setNextRunAt] = useState("");

  // TASK_DUE
  const [taskId, setTaskId] = useState("");

  // CREATE_TASK
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");

  // CREATE_REMINDER
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderScheduledFor, setReminderScheduledFor] = useState("");
  const [reminderTaskId, setReminderTaskId] = useState("");

  const getAuthHeaders = useCallback(async () => {
    const token = await getToken();

    if (!token) {
      throw new Error("Authentication token unavailable.");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [getToken]);

  const loadAutomations = useCallback(async () => {
    try {
      /*
       * Important:
       * Wait for the async authentication operation before
       * changing React state. This avoids the React
       * set-state-in-effect lint error when this function
       * is called by useEffect.
       */
      const headers = await getAuthHeaders();

      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/v1/automations`, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      const result = (await response.json()) as ApiResponse<Automation[]>;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error?.message ?? "Failed to load automations.",
        );
      }

      setAutomations(result.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load automations.",
      );
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
  // This effect intentionally performs the initial API fetch
  // and updates component state with the result.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void loadAutomations();
}, [loadAutomations]);

  function resetCreateForm() {
    setName("");
    setTriggerType("SCHEDULE");
    setActionType("CREATE_TASK");

    setTaskId("");

    setTaskTitle("");
    setTaskDescription("");
    setTaskDueAt("");

    setReminderMessage("");
    setReminderScheduledFor("");
    setReminderTaskId("");

    setNextRunAt("");
  }

  async function createAutomation() {
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Automation name is required.");
      return;
    }

    if (triggerType === "TASK_DUE" && !taskId.trim()) {
      setError("Task ID is required for a task-due automation.");
      return;
    }

    if (actionType === "CREATE_TASK" && !taskTitle.trim()) {
      setError("Task title is required for a create-task automation.");
      return;
    }

    if (actionType === "CREATE_REMINDER" && !reminderMessage.trim()) {
      setError(
        "Reminder message is required for a create-reminder automation.",
      );
      return;
    }

    setCreating(true);

    try {
      const headers = await getAuthHeaders();

      const config: Record<string, unknown> = {};

      /*
       * TASK_DUE trigger configuration.
       */
      if (triggerType === "TASK_DUE") {
        config.taskId = taskId.trim();
      }

      /*
       * CREATE_TASK action configuration.
       */
      if (actionType === "CREATE_TASK") {
        config.title = taskTitle.trim();

        if (taskDescription.trim()) {
          config.description = taskDescription.trim();
        }

        if (taskDueAt) {
          const parsedDueAt = new Date(taskDueAt);

          if (Number.isNaN(parsedDueAt.getTime())) {
            throw new Error("Task due date must be a valid date.");
          }

          config.dueAt = parsedDueAt.toISOString();
        }
      }

      /*
       * CREATE_REMINDER action configuration.
       */
      if (actionType === "CREATE_REMINDER") {
        config.message = reminderMessage.trim();

        if (reminderScheduledFor) {
          const parsedScheduledFor = new Date(reminderScheduledFor);

          if (Number.isNaN(parsedScheduledFor.getTime())) {
            throw new Error("Reminder scheduled date must be a valid date.");
          }

          config.scheduledFor = parsedScheduledFor.toISOString();
        }

        if (reminderTaskId.trim()) {
          config.taskId = reminderTaskId.trim();
        }
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        triggerType,
        actionType,
        config,
      };

      if (nextRunAt) {
        const parsedNextRunAt = new Date(nextRunAt);

        if (Number.isNaN(parsedNextRunAt.getTime())) {
          throw new Error(
            "Automation next run time must be a valid date.",
          );
        }

        payload.nextRunAt = parsedNextRunAt.toISOString();
      }

      const response = await fetch(`${API_URL}/api/v1/automations`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiResponse<Automation>;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error?.message ?? "Failed to create automation.",
        );
      }

      resetCreateForm();

      setSuccess("Automation created successfully.");

      await loadAutomations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create automation.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function changeAutomationStatus(
    id: string,
    action: "pause" | "resume",
    successMessage: string,
  ) {
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(
        `${API_URL}/api/v1/automations/${id}/${action}`,
        {
          method: "POST",
          headers,
        },
      );

      const result = (await response.json()) as ApiResponse<{
        id: string;
        status: string;
      }>;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error?.message ?? `Failed to ${action} automation.`,
        );
      }

      setSuccess(successMessage);

      await loadAutomations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} automation.`,
      );
    } finally {
      setActionId(null);
    }
  }

  async function pauseAutomation(id: string) {
    await changeAutomationStatus(id, "pause", "Automation paused.");
  }

  async function resumeAutomation(id: string) {
    await changeAutomationStatus(id, "resume", "Automation resumed.");
  }

  async function deleteAutomation(id: string) {
    const confirmed = window.confirm("Delete this automation?");

    if (!confirmed) {
      return;
    }

    setActionId(id);
    setError("");
    setSuccess("");

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_URL}/api/v1/automations/${id}`, {
        method: "DELETE",
        headers,
      });

      const result = (await response.json()) as ApiResponse<{
        id: string;
      }>;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error?.message ?? "Failed to delete automation.",
        );
      }

      setSuccess("Automation deleted.");

      await loadAutomations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete automation.",
      );
    } finally {
      setActionId(null);
    }
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "Not scheduled";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString();
  }

  function statusClass(status: string) {
    switch (status) {
      case "ACTIVE":
        return "border-emerald-900 bg-emerald-950 text-emerald-300";

      case "PAUSED":
        return "border-yellow-900 bg-yellow-950 text-yellow-300";

      case "FAILED":
        return "border-red-900 bg-red-950 text-red-300";

      case "COMPLETED":
        return "border-blue-900 bg-blue-950 text-blue-300";

      default:
        return "border-zinc-700 bg-zinc-800 text-zinc-300";
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
        <header className="mb-10 flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-semibold">BrainOS</h1>

            <p className="mt-2 text-sm text-zinc-400">
              Personal AI Operating System
            </p>
          </div>

          <Show when="signed-in">
            <UserButton />
          </Show>
        </header>

        <Show when="signed-out">
          <section className="flex min-h-[60vh] items-center justify-center text-center">
            <div>
              <h2 className="text-3xl font-semibold">Sign in required</h2>

              <p className="mt-3 text-zinc-400">
                Sign in to manage your automations.
              </p>
            </div>
          </section>
        </Show>

        <Show when="signed-in">
          <section>
            <div className="mb-8">
              <h2 className="text-3xl font-semibold">Automations</h2>

              <p className="mt-2 text-zinc-400">
                Create and manage tasks that BrainOS can execute automatically.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">
                {success}
              </div>
            )}

            <div className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-lg font-medium">Create automation</h3>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Name
                  </label>

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Morning task automation"
                    disabled={creating}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-400 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Trigger
                  </label>

                  <select
                    value={triggerType}
                    onChange={(event) => setTriggerType(event.target.value)}
                    disabled={creating}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400 disabled:opacity-50"
                  >
                    {triggerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Action
                  </label>

                  <select
                    value={actionType}
                    onChange={(event) => setActionType(event.target.value)}
                    disabled={creating}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400 disabled:opacity-50"
                  >
                    {actionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {triggerType === "TASK_DUE" && (
                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Task ID
                    </label>

                    <input
                      value={taskId}
                      onChange={(event) => setTaskId(event.target.value)}
                      placeholder="task-id"
                      disabled={creating}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-400 disabled:opacity-50"
                    />
                  </div>
                )}

                {actionType === "CREATE_TASK" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Task title *
                      </label>

                      <input
                        value={taskTitle}
                        onChange={(event) => setTaskTitle(event.target.value)}
                        placeholder="Review today's priorities"
                        disabled={creating}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-400 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Task due
                      </label>

                      <input
                        type="datetime-local"
                        value={taskDueAt}
                        onChange={(event) => setTaskDueAt(event.target.value)}
                        disabled={creating}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400 disabled:opacity-50"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm text-zinc-400">
                        Task description
                      </label>

                      <textarea
                        value={taskDescription}
                        onChange={(event) =>
                          setTaskDescription(event.target.value)
                        }
                        placeholder="Optional task description"
                        rows={3}
                        disabled={creating}
                        className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-400 disabled:opacity-50"
                      />
                    </div>
                  </>
                )}

                {actionType === "CREATE_REMINDER" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Reminder message *
                      </label>

                      <input
                        value={reminderMessage}
                        onChange={(event) =>
                          setReminderMessage(event.target.value)
                        }
                        placeholder="Time to review your tasks"
                        disabled={creating}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-400 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Reminder scheduled for
                      </label>

                      <input
                        type="datetime-local"
                        value={reminderScheduledFor}
                        onChange={(event) =>
                          setReminderScheduledFor(event.target.value)
                        }
                        disabled={creating}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Related task ID
                      </label>

                      <input
                        value={reminderTaskId}
                        onChange={(event) =>
                          setReminderTaskId(event.target.value)
                        }
                        placeholder="Optional task-id"
                        disabled={creating}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none placeholder:text-zinc-600 focus:border-zinc-400 disabled:opacity-50"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Next run
                  </label>

                  <input
                    type="datetime-local"
                    value={nextRunAt}
                    onChange={(event) => setNextRunAt(event.target.value)}
                    disabled={creating}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400 disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                onClick={() => void createAutomation()}
                disabled={creating}
                className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create automation"}
              </button>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-medium">Your automations</h3>

                <button
                  onClick={() => void loadAutomations()}
                  disabled={loading}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
                  Loading automations...
                </div>
              ) : automations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
                  <p className="text-zinc-300">No automations yet.</p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Create your first automation above.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {automations.map((automation) => (
                    <div
                      key={automation.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                    >
                      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h4 className="text-lg font-medium">
                              {automation.name}
                            </h4>

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                                automation.status,
                              )}`}
                            >
                              {automation.status}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-2 text-sm text-zinc-400">
                            <p>
                              Trigger:{" "}
                              <span className="text-zinc-200">
                                {automation.triggerType}
                              </span>
                            </p>

                            <p>
                              Action:{" "}
                              <span className="text-zinc-200">
                                {automation.actionType}
                              </span>
                            </p>

                            <p>
                              Next run:{" "}
                              <span className="text-zinc-200">
                                {formatDate(automation.nextRunAt)}
                              </span>
                            </p>

                            {automation.lastRunAt && (
                              <p>
                                Last run:{" "}
                                <span className="text-zinc-200">
                                  {formatDate(automation.lastRunAt)}
                                </span>
                              </p>
                            )}

                            {automation.triggerType === "TASK_DUE" && (
                              <p>
                                Task ID:{" "}
                                <span className="text-zinc-200">
                                  {String(
                                    automation.config?.taskId ?? "Unknown",
                                  )}
                                </span>
                              </p>
                            )}

                            {automation.actionType === "CREATE_TASK" && (
                              <p>
                                Task title:{" "}
                                <span className="text-zinc-200">
                                  {String(
                                    automation.config?.title ?? "Unknown",
                                  )}
                                </span>
                              </p>
                            )}

                            {automation.actionType === "CREATE_REMINDER" && (
                              <p>
                                Reminder:{" "}
                                <span className="text-zinc-200">
                                  {String(
                                    automation.config?.message ?? "Unknown",
                                  )}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          {automation.status === "ACTIVE" && (
                            <button
                              onClick={() =>
                                void pauseAutomation(automation.id)
                              }
                              disabled={actionId === automation.id}
                              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                            >
                              Pause
                            </button>
                          )}

                          {automation.status === "PAUSED" && (
                            <button
                              onClick={() =>
                                void resumeAutomation(automation.id)
                              }
                              disabled={actionId === automation.id}
                              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
                            >
                              Resume
                            </button>
                          )}

                          <button
                            onClick={() => void deleteAutomation(automation.id)}
                            disabled={actionId === automation.id}
                            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </Show>
      </div>
    </main>
  );
}