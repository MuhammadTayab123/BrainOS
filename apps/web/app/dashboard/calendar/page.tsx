"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { DashboardNav } from "../../../components/dashboard-nav";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEvent,
  type CalendarEventStatus,
} from "../../../lib/brainos-client-api";

type RangePreset = "UPCOMING" | "TODAY" | "NEXT_7_DAYS" | "NEXT_30_DAYS" | "ALL" | "CUSTOM";
type StatusFilter = "ALL" | CalendarEventStatus;

interface EventFormData {
  title: string;
  description: string;
  location: string;
  startTime: string; // YYYY-MM-DDTHH:mm
  endTime: string;   // YYYY-MM-DDTHH:mm
  timezone: string;
  status: CalendarEventStatus;
  isAllDay: boolean;
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatDateForInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDisplayDateTime(isoString: string, isAllDay = false): string {
  try {
    const date = new Date(isoString);
    if (isAllDay) {
      return date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function CalendarPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters
  const [rangePreset, setRangePreset] = useState<RangePreset>("UPCOMING");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Modals & form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<CalendarEvent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const initialFormState: EventFormData = useMemo(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    return {
      title: "",
      description: "",
      location: "",
      startTime: formatDateForInput(now),
      endTime: formatDateForInput(inOneHour),
      timezone: getBrowserTimezone(),
      status: "CONFIRMED",
      isAllDay: false,
    };
  }, []);

  const [formData, setFormData] = useState<EventFormData>(initialFormState);

  // Calculate range filter timestamps
  const getFilterOptions = useCallback(() => {
    const now = new Date();

    if (rangePreset === "UPCOMING") {
      return { from: now.toISOString() };
    }

    if (rangePreset === "TODAY") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        rangeStart: startOfDay.toISOString(),
        rangeEnd: endOfDay.toISOString(),
      };
    }

    if (rangePreset === "NEXT_7_DAYS") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const in7Days = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);
      return {
        rangeStart: startOfDay.toISOString(),
        rangeEnd: in7Days.toISOString(),
      };
    }

    if (rangePreset === "NEXT_30_DAYS") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const in30Days = new Date(startOfDay.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        rangeStart: startOfDay.toISOString(),
        rangeEnd: in30Days.toISOString(),
      };
    }

    if (rangePreset === "CUSTOM" && customStart && customEnd) {
      return {
        rangeStart: new Date(customStart).toISOString(),
        rangeEnd: new Date(customEnd).toISOString(),
      };
    }

    // ALL
    return { from: new Date(0).toISOString() };
  }, [rangePreset, customStart, customEnd]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token is unavailable.");
      }

      const filterOptions = getFilterOptions();
      const data = await listCalendarEvents(token, {
        ...filterOptions,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        limit: 100,
      });

      setEvents(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load calendar events.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, getFilterOptions, statusFilter]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchEvents();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchEvents]);

  // Open Create Modal
  const openCreateModal = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    setFormData({
      title: "",
      description: "",
      location: "",
      startTime: formatDateForInput(now),
      endTime: formatDateForInput(inOneHour),
      timezone: getBrowserTimezone(),
      status: "CONFIRMED",
      isAllDay: false,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startTime: formatDateForInput(new Date(event.startTime)),
      endTime: formatDateForInput(new Date(event.endTime)),
      timezone: event.timezone || getBrowserTimezone(),
      status: event.status,
      isAllDay: event.isAllDay,
    });
    setFormError(null);
  };

  // Submit Create or Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionError(null);

    if (!formData.title.trim()) {
      setFormError("Event title is required.");
      return;
    }

    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError("Please enter valid start and end dates/times.");
      return;
    }

    if (start.getTime() >= end.getTime()) {
      setFormError("Start time must be before end time.");
      return;
    }

    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required.");
      }

      if (editingEvent) {
        await updateCalendarEvent(token, editingEvent.id, {
          title: formData.title,
          description: formData.description.trim() ? formData.description : null,
          location: formData.location.trim() ? formData.location : null,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timezone: formData.timezone.trim() || undefined,
          status: formData.status,
          isAllDay: formData.isAllDay,
        });
        setEditingEvent(null);
      } else {
        await createCalendarEvent(token, {
          title: formData.title,
          description: formData.description.trim() ? formData.description : null,
          location: formData.location.trim() ? formData.location : null,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          timezone: formData.timezone.trim() || undefined,
          status: formData.status,
          isAllDay: formData.isAllDay,
        });
        setIsCreateModalOpen(false);
      }

      await fetchEvents();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save calendar event.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm and Execute Delete
  const handleDelete = async () => {
    if (!confirmDeleteEvent) return;

    setDeletingId(confirmDeleteEvent.id);
    setActionError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required.");
      }

      await deleteCalendarEvent(token, confirmDeleteEvent.id);
      setConfirmDeleteEvent(null);
      await fetchEvents();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete calendar event.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: CalendarEventStatus) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-800/60">
            Confirmed
          </span>
        );
      case "TENTATIVE":
        return (
          <span className="inline-flex items-center rounded-full bg-amber-950/80 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 border border-amber-800/60">
            Tentative
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center rounded-full bg-red-950/80 px-2.5 py-0.5 text-[11px] font-medium text-red-400 border border-red-800/60">
            Cancelled
          </span>
        );
    }
  };

  return (
    <>
      <Show when="signed-out">
        <main className="min-h-screen bg-zinc-950 text-white">
          <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
            <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
              <div>
                <h1 className="text-2xl font-semibold">BrainOS Calendar</h1>
                <p className="mt-1 text-sm text-zinc-400">Personal schedule & event agenda</p>
              </div>
              <DashboardNav current="calendar" orientation="horizontal" />
            </header>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 className="text-3xl font-semibold">Sign in to view your calendar</h2>
              <p className="mt-3 max-w-md text-zinc-400">
                Manage your schedule, meetings, and events securely with BrainOS.
              </p>
              <SignInButton mode="modal">
                <button className="mt-6 rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </div>
        </main>
      </Show>

      <Show when="signed-in">
        <main className="min-h-screen bg-zinc-950 text-white">
          <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 py-8">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-white">Calendar</h1>
                  <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400 font-mono">
                    {events.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  Agenda view of your scheduled events and meetings
                </p>
              </div>

              <div className="flex items-center gap-3">
                <DashboardNav current="calendar" orientation="horizontal" />
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 shadow-sm"
                >
                  + New Event
                </button>
              </div>
            </header>

            {/* Notification / Action Error Banner */}
            {actionError && (
              <div className="mt-6 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-300 flex items-center justify-between">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="text-red-400 hover:text-white ml-2 text-xs uppercase"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Controls Bar: Range Presets & Status Filter */}
            <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 backdrop-blur-sm">
              {/* Range Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: "UPCOMING", label: "Upcoming" },
                    { key: "TODAY", label: "Today" },
                    { key: "NEXT_7_DAYS", label: "Next 7 Days" },
                    { key: "NEXT_30_DAYS", label: "Next 30 Days" },
                    { key: "ALL", label: "All" },
                    { key: "CUSTOM", label: "Custom" },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setRangePreset(preset.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      rangePreset === preset.key
                        ? "bg-zinc-800 text-white border border-zinc-700/80 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="TENTATIVE">Tentative</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <button
                  type="button"
                  onClick={() => void fetchEvents()}
                  title="Refresh events"
                  className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Custom Range Inputs (if CUSTOM preset selected) */}
            {rangePreset === "CUSTOM" && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">From:</span>
                  <input
                    type="datetime-local"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-white focus:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">To:</span>
                  <input
                    type="datetime-local"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-white focus:border-zinc-700 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchEvents()}
                  disabled={!customStart || !customEnd}
                  className="rounded bg-zinc-800 px-3 py-1 font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
                >
                  Apply Range
                </button>
              </div>
            )}

            {/* Main Content Area: Loading / Error / Empty / List */}
            <div className="mt-6 flex-1">
              {loading ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <p className="mt-3 text-sm text-zinc-400">Loading your schedule...</p>
                </div>
              ) : error ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-950/10 p-6 text-center">
                  <p className="text-sm font-medium text-red-300">{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchEvents()}
                    className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition"
                  >
                    Retry
                  </button>
                </div>
              ) : events.length === 0 ? (
                <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-900/20 p-8 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-base font-medium text-white">No calendar events</h3>
                  <p className="mt-1 max-w-sm text-xs text-zinc-400">
                    No scheduled events found for this filter range. Add an event or schedule one with your Assistant.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 transition"
                  >
                    + Create Event
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <article
                      key={event.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition hover:border-zinc-700/80 hover:bg-zinc-900/70"
                    >
                      {/* Left details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-white truncate">
                            {event.title}
                          </h2>
                          {getStatusBadge(event.status)}
                          {event.isAllDay && (
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                              All Day
                            </span>
                          )}
                        </div>

                        {/* Date & Time display */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {formatDisplayDateTime(event.startTime, event.isAllDay)}
                            {" – "}
                            {formatDisplayDateTime(event.endTime, event.isAllDay)}
                          </span>

                          {event.location && (
                            <span className="flex items-center gap-1 text-zinc-300">
                              <svg className="h-3.5 w-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {event.location}
                            </span>
                          )}

                          <span className="text-[11px] text-zinc-500">
                            {event.timezone}
                          </span>
                        </div>

                        {/* Description */}
                        {event.description && (
                          <p className="mt-2 text-xs text-zinc-400 whitespace-pre-wrap line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-2 shrink-0 border-t border-zinc-800/60 pt-3 sm:border-0 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(event)}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteEvent(event)}
                          disabled={deletingId === event.id}
                          className="rounded-lg border border-zinc-800/80 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-red-400 hover:border-red-900/50 hover:bg-red-950/30 transition disabled:opacity-40"
                        >
                          {deletingId === event.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Create or Edit Event Modal */}
          {(isCreateModalOpen || editingEvent) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {editingEvent ? "Edit Calendar Event" : "Create Calendar Event"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setEditingEvent(null);
                      setFormError(null);
                    }}
                    className="text-zinc-400 hover:text-white text-lg"
                  >
                    ✕
                  </button>
                </div>

                {formError && (
                  <div className="mt-4 rounded-lg bg-red-950/40 border border-red-800/50 p-3 text-xs text-red-300">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Event Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Design review meeting"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>

                  {/* Start & End Times */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Start Time <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        End Time <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Timezone & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Timezone
                      </label>
                      <input
                        type="text"
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        placeholder="e.g. America/New_York"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value as CalendarEventStatus })
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none"
                      >
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="TENTATIVE">Tentative</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Room 101 or Zoom Link"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Event details or agenda..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                  </div>

                  {/* All Day Toggle */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isAllDayCheckbox"
                      checked={formData.isAllDay}
                      onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                      className="rounded border-zinc-700 bg-zinc-950 text-white focus:ring-0"
                    />
                    <label htmlFor="isAllDayCheckbox" className="text-xs text-zinc-300 select-none">
                      All-day event
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        setEditingEvent(null);
                        setFormError(null);
                      }}
                      className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-lg bg-white px-5 py-2 text-xs font-medium text-black hover:bg-zinc-200 transition disabled:opacity-50"
                    >
                      {submitting
                        ? editingEvent
                          ? "Updating..."
                          : "Creating..."
                        : editingEvent
                        ? "Update Event"
                        : "Create Event"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {confirmDeleteEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-950/80 text-red-400 border border-red-800/60 mb-4">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>

                <h3 className="text-base font-semibold text-white">Delete Calendar Event?</h3>
                <p className="mt-2 text-xs text-zinc-400">
                  Are you sure you want to delete <span className="font-semibold text-zinc-200">"{confirmDeleteEvent.title}"</span>? This action cannot be undone.
                </p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteEvent(null)}
                    disabled={deletingId !== null}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deletingId !== null}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
                  >
                    {deletingId !== null ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </Show>
    </>
  );
}
