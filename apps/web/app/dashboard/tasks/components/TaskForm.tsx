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
    <section style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem", backgroundColor: "#f9fafb" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>Create New Task</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem" }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
            style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem" }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details (optional)"
            rows={2}
            style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
          />
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem" }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "500", marginBottom: "0.25rem" }}>
              Due Date
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "4px" }}
            />
          </div>
        </div>

        {displayedError && (
          <div style={{ color: "#dc2626", fontSize: "0.875rem", padding: "0.5rem", backgroundColor: "#fee2e2", borderRadius: "4px" }}>
            {displayedError}
          </div>
        )}

        <button
          type="submit"
          disabled={creating}
          style={{
            alignSelf: "flex-start",
            padding: "0.5rem 1.25rem",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            cursor: creating ? "not-allowed" : "pointer",
            fontWeight: "500",
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? "Creating..." : "Create Task"}
        </button>
      </form>
    </section>
  );
}
