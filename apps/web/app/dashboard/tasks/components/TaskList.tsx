"use client";

import {
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "../../../../lib/brainos-client-api";
import { TaskItem } from "./TaskItem";

export type StatusFilter = "ALL" | TaskStatus;
export type PriorityFilter = "ALL" | TaskPriority;

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  operatingId: string | null;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (priority: PriorityFilter) => void;
  onRefresh: () => void;
  onComplete: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export function TaskList({
  tasks,
  loading,
  error,
  operatingId,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  onRefresh,
  onComplete,
  onDelete,
}: TaskListProps) {
  const todoCount = tasks.filter((t) => t.status === "TODO").length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-white">Your Tasks</h2>
          {todoCount > 0 && (
            <span className="rounded-full border border-amber-800 bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              {todoCount} todo
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter Tabs */}
          <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 text-xs font-medium">
            {(["ALL", "TODO", "COMPLETED"] as StatusFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onStatusFilterChange(tab)}
                className={`rounded-md px-3 py-1.5 transition ${
                  statusFilter === tab
                    ? "bg-zinc-800 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab === "ALL" ? "All" : tab === "TODO" ? "Todo" : "Completed"}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) =>
                onPriorityFilterChange(e.target.value as PriorityFilter)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
          Loading tasks...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
          {statusFilter === "ALL" && priorityFilter === "ALL"
            ? "No tasks found. Create one above or ask BrainOS in chat!"
            : "No tasks matching the selected filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isOperating={operatingId === task.id}
              onComplete={onComplete}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
