"use client";

import { useState } from "react";
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isCompleted = task.status === "COMPLETED";

  const getPriorityBadgeClass = (priority: Task["priority"]) => {
    switch (priority) {
      case "HIGH":
        return "border-rose-900/60 bg-rose-950/40 text-rose-300";
      case "MEDIUM":
        return "border-blue-900/60 bg-blue-950/40 text-blue-300";
      case "LOW":
      default:
        return "border-zinc-700 bg-zinc-800 text-zinc-300";
    }
  };

  const getStatusBadgeClass = (status: Task["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "border-emerald-900/60 bg-emerald-950/40 text-emerald-300";
      case "TODO":
      default:
        return "border-amber-900/60 bg-amber-950/40 text-amber-300";
    }
  };

  return (
    <div
      className={`flex flex-col justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700 sm:flex-row sm:items-start ${
        isCompleted ? "opacity-75" : ""
      }`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getStatusBadgeClass(
              task.status,
            )}`}
          >
            {task.status}
          </span>

          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${getPriorityBadgeClass(
              task.priority,
            )}`}
          >
            {task.priority}
          </span>

          {task.dueAt && (
            <span className="text-xs text-zinc-400">
              Due: {new Date(task.dueAt).toLocaleString()}
            </span>
          )}
        </div>

        <p
          className={`text-base font-medium break-words ${
            isCompleted
              ? "text-zinc-400 line-through"
              : "text-white"
          }`}
        >
          {task.title}
        </p>

        {task.description && (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-1">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-zinc-300">Delete task?</span>
            <button
              type="button"
              onClick={() => void onDelete(task.id)}
              disabled={isOperating}
              className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              {isOperating ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={isOperating}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            {!isCompleted && (
              <button
                type="button"
                onClick={() => void onComplete(task.id)}
                disabled={isOperating}
                className="rounded-lg border border-emerald-800/80 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-900/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOperating ? "..." : "Complete"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isOperating}
              className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-900/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
