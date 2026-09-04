"use client";

import { type Task } from "../../../../lib/brainos-client-api";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  operatingId: string | null;
  onRefresh: () => void;
  onComplete: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export function TaskList({
  tasks,
  loading,
  error,
  operatingId,
  onRefresh,
  onComplete,
  onDelete,
}: TaskListProps) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", margin: 0 }}>Your Tasks</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ padding: "0.25rem 0.75rem", fontSize: "0.875rem", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff", cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ color: "#dc2626", padding: "1rem", backgroundColor: "#fee2e2", borderRadius: "4px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: "#6b7280", fontStyle: "italic" }}>No tasks found. Create one above!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isOperating={operatingId === task.id}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
