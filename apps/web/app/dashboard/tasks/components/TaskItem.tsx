"use client";

import { type Task } from "../../../../lib/brainos-client-api";

interface TaskItemProps {
  task: Task;
  isOperating: boolean;
  onComplete: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export function TaskItem({
  task,
  isOperating,
  onComplete,
  onDelete,
}: TaskItemProps) {
  const isCompleted = task.status === "COMPLETED";

  return (
    <li
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "6px",
        padding: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        backgroundColor: isCompleted ? "#f3f4f6" : "#ffffff",
        opacity: isCompleted ? 0.75 : 1,
      }}
    >
      <div style={{ flex: 1, marginRight: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span
            style={{
              fontWeight: "600",
              fontSize: "1rem",
              textDecoration: isCompleted ? "line-through" : "none",
              color: isCompleted ? "#6b7280" : "#111827",
            }}
          >
            {task.title}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.125rem 0.5rem",
              borderRadius: "9999px",
              backgroundColor: isCompleted ? "#d1fae5" : "#fef3c7",
              color: isCompleted ? "#065f46" : "#92400e",
              fontWeight: "500",
            }}
          >
            {task.status}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.125rem 0.5rem",
              borderRadius: "9999px",
              backgroundColor:
                task.priority === "HIGH"
                  ? "#fee2e2"
                  : task.priority === "MEDIUM"
                    ? "#e0e7ff"
                    : "#f3f4f6",
              color:
                task.priority === "HIGH"
                  ? "#991b1b"
                  : task.priority === "MEDIUM"
                    ? "#3730a3"
                    : "#374151",
              fontWeight: "500",
            }}
          >
            {task.priority}
          </span>
        </div>

        {task.description && (
          <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "#4b5563" }}>
            {task.description}
          </p>
        )}

        <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
          Due: {task.dueAt ? new Date(task.dueAt).toLocaleString() : "None"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {!isCompleted && (
          <button
            onClick={() => onComplete(task.id)}
            disabled={isOperating}
            style={{
              padding: "0.375rem 0.75rem",
              fontSize: "0.75rem",
              backgroundColor: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              cursor: isOperating ? "not-allowed" : "pointer",
            }}
          >
            {isOperating ? "..." : "Complete"}
          </button>
        )}

        <button
          onClick={() => onDelete(task.id)}
          disabled={isOperating}
          style={{
            padding: "0.375rem 0.75rem",
            fontSize: "0.75rem",
            backgroundColor: "#ef4444",
            color: "#ffffff",
            border: "none",
            borderRadius: "4px",
            cursor: isOperating ? "not-allowed" : "pointer",
          }}
        >
          {isOperating ? "..." : "Delete"}
        </button>
      </div>
    </li>
  );
}
