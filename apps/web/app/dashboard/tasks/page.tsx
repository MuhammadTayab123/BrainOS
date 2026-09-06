"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, SignInButton, useAuth } from "@clerk/nextjs";
import { DashboardNav } from "../../../components/dashboard-nav";

import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  type Task,
  type TaskPriority,
} from "../../../lib/brainos-client-api";
import { TaskForm } from "./components/TaskForm";
import {
  TaskList,
  type PriorityFilter,
  type StatusFilter,
} from "./components/TaskList";

export default function TasksPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");

  const fetchTasks = useCallback(async () => {
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token is unavailable.");
      }

      const data = await listTasks(token, {
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        priority: priorityFilter !== "ALL" ? priorityFilter : undefined,
      });
      setTasks(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load tasks.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, statusFilter, priorityFilter]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchTasks();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchTasks]);

  const handleCreateTask = async (input: {
    title: string;
    description?: string;
    priority: TaskPriority;
    dueAt?: string;
  }) => {
    setCreating(true);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await createTask(token, {
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt).toISOString() : undefined,
      });

      await fetchTasks();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to create task.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setOperatingId(taskId);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await completeTask(token, taskId);
      await fetchTasks();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to complete task.",
      );
    } finally {
      setOperatingId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setOperatingId(taskId);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await deleteTask(token, taskId);
      await fetchTasks();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete task.",
      );
    } finally {
      setOperatingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">BrainOS Tasks</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Track, execute, and manage AI and manual tasks
            </p>
          </div>

          <DashboardNav current="tasks" />
        </header>

        <Show when="signed-out">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-semibold">Sign In Required</h2>
            <p className="mt-3 max-w-md text-zinc-400">
              Sign in to manage and track your BrainOS tasks.
            </p>
            <SignInButton mode="modal">
              <button className="mt-6 rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200">
                Sign in
              </button>
            </SignInButton>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex-1 space-y-8 pt-8">
            {actionError && (
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {actionError}
              </div>
            )}

            <TaskForm
              creating={creating}
              actionError={actionError}
              onSubmit={handleCreateTask}
            />

            <TaskList
              tasks={tasks}
              loading={loading}
              error={error}
              operatingId={operatingId}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriorityFilterChange={setPriorityFilter}
              onRefresh={() => void fetchTasks()}
              onComplete={handleCompleteTask}
              onDelete={handleDeleteTask}
            />
          </div>
        </Show>
      </div>
    </main>
  );
}
