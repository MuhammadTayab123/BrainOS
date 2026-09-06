"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
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
import { TaskList } from "./components/TaskList";

export default function TasksPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token is unavailable.");
      }

      const data = await listTasks(token);
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
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchTasks();
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
        <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">BrainOS Tasks</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Track, execute, and manage AI and manual tasks
            </p>
          </div>

          <DashboardNav current="tasks" />
        </header>

        <div className="text-zinc-900">
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
            onRefresh={fetchTasks}
            onComplete={handleCompleteTask}
            onDelete={handleDeleteTask}
          />
        </div>
      </div>
    </main>
  );
}
