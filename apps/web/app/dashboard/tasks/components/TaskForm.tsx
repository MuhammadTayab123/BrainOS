"use client";

import { useState } from "react";
import { type TaskPriority } from "../../../../lib/brainos-client-api";

interface TaskFormProps {
  creating: boolean;
  actionError: string | null;
  onSubmit: (input: {
    title: string;
    description?: string;
    priority: TaskPriority;
    dueAt?: string;
  }) => Promise<void>;
}

export function TaskForm({ creating, actionError, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setLocalError("Task title is required.");
      return;
    }

    setLocalError(null);

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueAt: dueAt || undefined,
    });

    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueAt("");
  };

  const displayedError = localError || actionError;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-medium text-white">Create New Task</h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400">
            Task Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Implement user authentication audit"
            disabled={creating}
            required
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details or instructions (optional)"
            disabled={creating}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-400">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={creating}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">
              Due Date & Time (Local)
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker?.();
                } catch {
                  // Fallback to default browser behavior
                }
              }}
              disabled={creating}
              className="mt-1 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white [color-scheme:dark] focus:border-zinc-500 focus:outline-none disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {displayedError && (
          <p className="text-xs text-red-400">{displayedError}</p>
        )}

        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {creating ? "Creating..." : "+ Create Task"}
        </button>
      </form>
    </section>
  );
}
