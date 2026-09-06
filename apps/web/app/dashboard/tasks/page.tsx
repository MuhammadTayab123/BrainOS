"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";

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
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", margin: 0 }}>BrainOS Tasks</h1>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
            <Link href="/dashboard" style={{ color: "#2563eb", fontSize: "0.875rem", textDecoration: "none" }}>
              &larr; Chat
            </Link>
            <Link href="/dashboard/reminders" style={{ color: "#2563eb", fontSize: "0.875rem", textDecoration: "none" }}>
              Reminders
            </Link>
            <Link href="/dashboard/automations" style={{ color: "#2563eb", fontSize: "0.875rem", textDecoration: "none" }}>
              Automations
            </Link>
          </div>
        </div>
        <UserButton />
      </header>

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
  );
}
