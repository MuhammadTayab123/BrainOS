"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, useAuth } from "@clerk/nextjs";
import { DashboardNav } from "../../../components/dashboard-nav";
import {
  Automation,
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
  createAutomation as apiCreateAutomation,
  deleteAutomation as apiDeleteAutomation,
  listAutomations,
  pauseAutomation as apiPauseAutomation,
  resumeAutomation as apiResumeAutomation,
} from "../../../lib/brainos-client-api";

type RecurrenceType = "NONE" | "DAILY" | "WEEKLY";
type FilterTab = "ALL" | AutomationStatus;

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

const dayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export default function AutomationsPage() {
  const { getToken } = useAuth();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>("ALL");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Automation fields
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("SCHEDULE");
  const [actionType, setActionType] = useState("CREATE_TASK");
  const [nextRunAt, setNextRunAt] = useState("");

  // Recurrence
  const [recurrenceType, setRecurrenceType] =
    useState<RecurrenceType>("NONE");
  const [recurrenceTime, setRecurrenceTime] = useState("09:00");
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] =
    useState("1");

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

  const loadAutomations = useCallback(async () => {
    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      setLoading(true);
      setError("");

      const data = await listAutomations(token, {
        status: selectedFilter !== "ALL" ? selectedFilter : undefined,
      });
      setAutomations(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load automations.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedFilter]);

  useEffect(() => {
    // The initial load intentionally updates component state
    // after the asynchronous API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAutomations();
  }, [loadAutomations]);

  function resetCreateForm() {
    setName("");
    setTriggerType("SCHEDULE");
    setActionType("CREATE_TASK");
    setNextRunAt("");

    setRecurrenceType("NONE");
    setRecurrenceTime("09:00");
    setRecurrenceDayOfWeek("1");

    setTaskId("");

    setTaskTitle("");
    setTaskDescription("");
    setTaskDueAt("");

    setReminderMessage("");
    setReminderScheduledFor("");
    setReminderTaskId("");
  }

  function parseRecurrenceTime() {
    const parts = recurrenceTime.split(":");

    if (parts.length !== 2) {
      throw new Error("Recurrence time must be in HH:MM format.");
    }

    const hour = Number(parts[0]);
    const minute = Number(parts[1]);

    if (
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59
    ) {
      throw new Error("Recurrence time must be a valid time.");
    }

    return {
      hour,
      minute,
    };
  }

  function buildRecurrenceConfig(config: Record<string, unknown>) {
    if (triggerType !== "SCHEDULE") {
      return;
    }

    if (recurrenceType === "NONE") {
      return;
    }

    const { hour, minute } = parseRecurrenceTime();

    if (recurrenceType === "DAILY") {
      config.recurrence = {
        type: "DAILY",
        hour,
        minute,
      };

      return;
    }

    const dayOfWeek = Number(recurrenceDayOfWeek);

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      throw new Error("Recurrence day must be valid.");
    }

    config.recurrence = {
      type: "WEEKLY",
      dayOfWeek,
      hour,
      minute,
    };
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

    if (
      triggerType === "SCHEDULE" &&
      recurrenceType !== "NONE" &&
      !nextRunAt
    ) {
      setError(
        "Next run is required when creating a recurring schedule.",
      );
      return;
    }

    setCreating(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

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
            throw new Error(
              "Reminder scheduled date must be a valid date.",
            );
          }

          config.scheduledFor = parsedScheduledFor.toISOString();
        }

        if (reminderTaskId.trim()) {
          config.taskId = reminderTaskId.trim();
        }
      }

      /*
       * Recurring schedule configuration.
       *
       * The backend already understands:
       *
       * DAILY:
       * {
       *   type: "DAILY",
       *   hour,
       *   minute
       * }
       *
       * WEEKLY:
       * {
       *   type: "WEEKLY",
       *   dayOfWeek,
       *   hour,
       *   minute
       * }
       */
      buildRecurrenceConfig(config);

      let parsedNextRunAt: string | undefined;

      if (nextRunAt) {
        const nextRunDate = new Date(nextRunAt);

        if (Number.isNaN(nextRunDate.getTime())) {
          throw new Error(
            "Automation next run time must be a valid date.",
          );
        }

        parsedNextRunAt = nextRunDate.toISOString();
      }

      await apiCreateAutomation(token, {
        name: name.trim(),
        triggerType: triggerType as AutomationTriggerType,
        actionType: actionType as AutomationActionType,
        config,
        nextRunAt: parsedNextRunAt,
      });

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

  async function pauseAutomation(id: string) {
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      await apiPauseAutomation(token, id);

      setSuccess("Automation paused.");

      await loadAutomations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to pause automation.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function resumeAutomation(id: string) {
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      await apiResumeAutomation(token, id);

      setSuccess("Automation resumed.");

      await loadAutomations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resume automation.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function deleteAutomation(id: string) {
    setActionId(id);
    setError("");
    setSuccess("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      await apiDeleteAutomation(token, id);
      setConfirmDeleteId(null);
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

  function formatRecurrence(config: Record<string, unknown>) {
    const recurrence = config.recurrence;

    if (
      recurrence === null ||
      typeof recurrence !== "object" ||
      Array.isArray(recurrence)
    ) {
      return null;
    }

    const value = recurrence as Record<string, unknown>;

    if (value.type === "DAILY") {
      const hour =
        typeof value.hour === "number"
          ? String(value.hour).padStart(2, "0")
          : "--";

      const minute =
        typeof value.minute === "number"
          ? String(value.minute).padStart(2, "0")
          : "--";

      return `Daily at ${hour}:${minute}`;
    }

    if (value.type === "WEEKLY") {
      const day =
        typeof value.dayOfWeek === "number"
          ? dayOptions.find(
              (option) => Number(option.value) === value.dayOfWeek,
            )?.label ?? "Unknown day"
          : "Unknown day";

      const hour =
        typeof value.hour === "number"
          ? String(value.hour).padStart(2, "0")
          : "--";

      const minute =
        typeof value.minute === "number"
          ? String(value.minute).padStart(2, "0")
          : "--";

      return `Weekly on ${day} at ${hour}:${minute}`;
    }

    return null;
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
        <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">BrainOS Automations</h1>

            <p className="mt-1 text-sm text-zinc-400">
              Recurring schedules and event-driven automation rules
            </p>
          </div>

          <DashboardNav current="automations" />
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
                        onClick={(e) => {
                          try {
                            e.currentTarget.showPicker?.();
                          } catch {
                            // Fallback to default browser behavior
                          }
                        }}
                        disabled={creating}
                        className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white [color-scheme:dark] outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                        onClick={(e) => {
                          try {
                            e.currentTarget.showPicker?.();
                          } catch {
                            // Fallback to default browser behavior
                          }
                        }}
                        disabled={creating}
                        className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white [color-scheme:dark] outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
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

                {triggerType === "SCHEDULE" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Recurrence
                      </label>

                      <select
                        value={recurrenceType}
                        onChange={(event) =>
                          setRecurrenceType(
                            event.target.value as RecurrenceType,
                          )
                        }
                        disabled={creating}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400 disabled:opacity-50"
                      >
                        <option value="NONE">One time</option>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                      </select>
                    </div>

                    {recurrenceType !== "NONE" && (
                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Recurrence time
                        </label>

                        <input
                          type="time"
                          value={recurrenceTime}
                          onChange={(event) =>
                            setRecurrenceTime(event.target.value)
                          }
                          disabled={creating}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400 disabled:opacity-50"
                        />
                      </div>
                    )}

                    {recurrenceType === "WEEKLY" && (
                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Day of week
                        </label>

                        <select
                          value={recurrenceDayOfWeek}
                          onChange={(event) =>
                            setRecurrenceDayOfWeek(event.target.value)
                          }
                          disabled={creating}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400 disabled:opacity-50"
                        >
                          {dayOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    {recurrenceType === "NONE"
                      ? "Next run"
                      : "First run"}
                  </label>

                  <input
                    type="datetime-local"
                    value={nextRunAt}
                    onChange={(event) => setNextRunAt(event.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {
                        // Fallback to default browser behavior
                      }
                    }}
                    disabled={creating}
                    className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white [color-scheme:dark] outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              {triggerType === "SCHEDULE" &&
                recurrenceType !== "NONE" && (
                  <p className="mt-4 text-sm text-zinc-500">
                    The first run starts at the time above. After each
                    successful execution, BrainOS will calculate the next
                    occurrence automatically.
                  </p>
                )}

              <button
                onClick={() => void createAutomation()}
                disabled={creating}
                className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create automation"}
              </button>
            </div>

            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-medium">Your automations</h3>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Filter Tabs */}
                  <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-medium">
                    {(["ALL", "ACTIVE", "PAUSED", "COMPLETED", "FAILED"] as FilterTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setSelectedFilter(tab);
                        }}
                        className={`rounded-md px-3 py-1.5 transition ${
                          selectedFilter === tab
                            ? "bg-zinc-800 text-white shadow"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {tab.charAt(0) + tab.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadAutomations()}
                    disabled={loading}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
                  Loading automations...
                </div>
              ) : automations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
                  <p className="text-zinc-300">
                    {selectedFilter === "ALL"
                      ? "No automations yet."
                      : `No ${selectedFilter.toLowerCase()} automations.`}
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    {selectedFilter === "ALL"
                      ? "Create your first automation above."
                      : `Try selecting a different filter.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {automations.map((automation) => {
                    const recurrenceText = formatRecurrence(
                      automation.config,
                    );

                    return (
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

                              {recurrenceText && (
                                <p>
                                  Recurrence:{" "}
                                  <span className="text-zinc-200">
                                    {recurrenceText}
                                  </span>
                                </p>
                              )}

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

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {confirmDeleteId === automation.id ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-zinc-300">Delete automation?</span>
                                <button
                                  type="button"
                                  onClick={() => void deleteAutomation(automation.id)}
                                  disabled={actionId === automation.id}
                                  className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                                >
                                  {actionId === automation.id ? "Deleting..." : "Delete"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={actionId === automation.id}
                                  className="text-zinc-400 hover:text-white disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                {automation.status === "ACTIVE" && (
                                  <button
                                    type="button"
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
                                    type="button"
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
                                  type="button"
                                  onClick={() => setConfirmDeleteId(automation.id)}
                                  disabled={actionId === automation.id}
                                  className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950 disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </Show>
      </div>
    </main>
  );
}