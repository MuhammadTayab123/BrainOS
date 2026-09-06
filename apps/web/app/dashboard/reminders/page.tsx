"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Show, UserButton, useAuth } from "@clerk/nextjs";

import {
  cancelReminder,
  createReminder,
  deleteReminder,
  listReminders,
  type Reminder,
  type ReminderStatus,
} from "../../../lib/brainos-client-api";

type FilterTab = "ALL" | ReminderStatus;

export default function RemindersPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>("ALL");

  // Form states
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchReminders = useCallback(async () => {
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token is unavailable.");
      }

      const data = await listReminders(token);
      setReminders(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load reminders.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchReminders();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchReminders]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionError(null);

    if (!message.trim()) {
      setFormError("Reminder message is required.");
      return;
    }

    if (!scheduledFor) {
      setFormError("Scheduled date and time are required.");
      return;
    }

    const scheduledDate = new Date(scheduledFor);

    if (Number.isNaN(scheduledDate.getTime())) {
      setFormError("Please enter a valid date and time.");
      return;
    }

    if (scheduledDate.getTime() <= Date.now()) {
      setFormError("Scheduled time must be in the future.");
      return;
    }

    setCreating(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await createReminder(token, {
        message: message.trim(),
        scheduledFor: scheduledDate.toISOString(),
      });

      setMessage("");
      setScheduledFor("");
      await fetchReminders();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to create reminder.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCancelReminder = async (reminderId: string) => {
    setOperatingId(reminderId);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await cancelReminder(token, reminderId);
      await fetchReminders();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to cancel reminder.",
      );
    } finally {
      setOperatingId(null);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    setOperatingId(reminderId);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await deleteReminder(token, reminderId);
      await fetchReminders();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete reminder.",
      );
    } finally {
      setOperatingId(null);
    }
  };

  function formatDateTime(isoString: string) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }
    return date.toLocaleString();
  }

  function formatRelativeTime(isoString: string) {
    const target = new Date(isoString).getTime();
    const now = Date.now();
    const diffMs = target - now;
    const isPast = diffMs < 0;
    const absDiffMinutes = Math.round(Math.abs(diffMs) / (60 * 1000));

    if (absDiffMinutes < 1) {
      return isPast ? "just now" : "in less than a minute";
    }

    if (absDiffMinutes < 60) {
      return isPast
        ? `${absDiffMinutes}m ago`
        : `in ${absDiffMinutes}m`;
    }

    const absDiffHours = Math.round(absDiffMinutes / 60);
    if (absDiffHours < 24) {
      return isPast
        ? `${absDiffHours}h ago`
        : `in ${absDiffHours}h`;
    }

    const absDiffDays = Math.round(absDiffHours / 24);
    return isPast
      ? `${absDiffDays}d ago`
      : `in ${absDiffDays}d`;
  }

  function getStatusBadgeClass(status: ReminderStatus) {
    switch (status) {
      case "PENDING":
        return "border-amber-900/60 bg-amber-950/40 text-amber-300";
      case "PROCESSING":
        return "border-blue-900/60 bg-blue-950/40 text-blue-300";
      case "DELIVERED":
        return "border-emerald-900/60 bg-emerald-950/40 text-emerald-300";
      case "FAILED":
        return "border-red-900/60 bg-red-950/40 text-red-300";
      case "CANCELLED":
        return "border-zinc-800 bg-zinc-900 text-zinc-400";
      default:
        return "border-zinc-800 bg-zinc-900 text-zinc-400";
    }
  }

  const filteredReminders = reminders.filter((item) => {
    if (selectedFilter === "ALL") return true;
    return item.status === selectedFilter;
  });

  const pendingCount = reminders.filter((r) => r.status === "PENDING").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">BrainOS Reminders</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Scheduled prompts, alerts, and time-based actions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                Chat
              </Link>

              <Link
                href="/dashboard/tasks"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                Tasks
              </Link>

              <Link
                href="/dashboard/reminders"
                className="rounded-lg border border-zinc-500 bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition"
              >
                Reminders
              </Link>

              <Link
                href="/dashboard/automations"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                Automations
              </Link>

              <UserButton />
            </Show>
          </div>
        </header>

        <Show when="signed-out">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-semibold">Sign in required</h2>
            <p className="mt-3 max-w-md text-zinc-400">
              Sign in to manage your BrainOS reminders.
            </p>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex-1 space-y-8 pt-8">
            {actionError && (
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {actionError}
              </div>
            )}

            {/* Create Reminder Card */}
            <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-medium text-white">
                Create New Reminder
              </h2>

              <form onSubmit={handleCreateReminder} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">
                    Reminder Message *
                  </label>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Review quarter earnings report"
                    disabled={creating}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400">
                      Scheduled Date & Time (Local) *
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      disabled={creating}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={creating || !message.trim() || !scheduledFor}
                      className="w-full rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {creating ? "Scheduling..." : "+ Create Reminder"}
                    </button>
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-red-400">{formError}</p>
                )}
              </form>
            </section>

            {/* Reminders List & Filters */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-medium">Your Reminders</h2>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-300 border border-amber-800">
                      {pendingCount} pending
                    </span>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-medium">
                  {(["ALL", "PENDING", "DELIVERED", "CANCELLED"] as FilterTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedFilter(tab)}
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
              </div>

              {loading ? (
                <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
                  Loading reminders...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                  {error}
                </div>
              ) : filteredReminders.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
                  {selectedFilter === "ALL"
                    ? "No reminders yet. Create one above or ask BrainOS in chat!"
                    : `No ${selectedFilter.toLowerCase()} reminders.`}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredReminders.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {formatRelativeTime(item.scheduledFor)}
                          </span>
                        </div>

                        <p className="font-medium text-white break-words">
                          {item.message}
                        </p>

                        <p className="text-xs text-zinc-500">
                          Scheduled for: {formatDateTime(item.scheduledFor)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {item.status === "PENDING" && (
                          <button
                            onClick={() => void handleCancelReminder(item.id)}
                            disabled={operatingId === item.id}
                            className="rounded-lg border border-amber-800/80 bg-amber-950/40 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-900/50 disabled:opacity-40"
                          >
                            {operatingId === item.id ? "Cancelling..." : "Cancel"}
                          </button>
                        )}

                        <button
                          onClick={() => void handleDeleteReminder(item.id)}
                          disabled={operatingId === item.id}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-red-900 hover:text-red-400 disabled:opacity-40"
                        >
                          {operatingId === item.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Show>
      </div>
    </main>
  );
}
