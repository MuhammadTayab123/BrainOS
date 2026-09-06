"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, useAuth } from "@clerk/nextjs";
import { DashboardNav } from "../../../components/dashboard-nav";

import {
  createMemory,
  deleteMemory,
  listMemories,
  searchMemories,
  updateMemory,
  type Memory,
  type MemorySearchResult,
} from "../../../lib/brainos-client-api";

const IMPORTANCE_PRESETS = [
  { label: "Low", value: 0.2, color: "text-zinc-400 border-zinc-700 bg-zinc-900/60" },
  { label: "Normal", value: 0.5, color: "text-blue-300 border-blue-900/60 bg-blue-950/40" },
  { label: "High", value: 0.8, color: "text-amber-300 border-amber-900/60 bg-amber-950/40" },
  { label: "Critical", value: 1.0, color: "text-emerald-300 border-emerald-900/60 bg-emerald-950/40" },
];

export default function MemoriesPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [operatingId, setOperatingId] = useState<string | null>(null);

  // Creation form state
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(0.5);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Edit modal / inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editImportance, setEditImportance] = useState(0.5);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMemories = useCallback(async () => {
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token is unavailable.");
      }

      const data = await listMemories(token);
      setMemories(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load memories.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchMemories();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchMemories]);

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setActionError(null);

    const trimmed = content.trim();
    if (!trimmed) {
      setCreateError("Memory content cannot be empty.");
      return;
    }

    setCreating(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await createMemory(token, {
        content: trimmed,
        importance,
      });

      setContent("");
      setImportance(0.5);
      await fetchMemories();
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Failed to store memory.",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      const results = await searchMemories(token, trimmedQuery, 10);
      setSearchResults(results);
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message
          : "Search failed.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setSearchError(null);
  };

  const handleDelete = async (memoryId: string) => {
    setOperatingId(memoryId);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await deleteMemory(token, memoryId);

      // Remove from search results if search is active
      if (searchResults) {
        setSearchResults((prev) =>
          prev ? prev.filter((r) => r.id !== memoryId) : null,
        );
      }

      await fetchMemories();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete memory.",
      );
    } finally {
      setOperatingId(null);
    }
  };

  const startEdit = (mem: Memory) => {
    setEditingId(mem.id);
    setEditContent(mem.content);
    setEditImportance(mem.importance);
    setActionError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditImportance(0.5);
  };

  const handleUpdate = async (memoryId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      setActionError("Memory content cannot be empty.");
      return;
    }

    setIsUpdating(true);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await updateMemory(token, memoryId, {
        content: trimmed,
        importance: editImportance,
      });

      setEditingId(null);
      await fetchMemories();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update memory.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  function formatDateTime(isoString: string) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getImportanceBadge(val: number) {
    if (val >= 0.9) {
      return "border-emerald-900/60 bg-emerald-950/40 text-emerald-300";
    }
    if (val >= 0.7) {
      return "border-amber-900/60 bg-amber-950/40 text-amber-300";
    }
    if (val >= 0.4) {
      return "border-blue-900/60 bg-blue-950/40 text-blue-300";
    }
    return "border-zinc-800 bg-zinc-900 text-zinc-400";
  }

  function getImportanceLabel(val: number) {
    if (val >= 0.9) return "Critical";
    if (val >= 0.7) return "High";
    if (val >= 0.4) return "Normal";
    return "Low";
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">BrainOS Second Brain Memory</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Personal knowledge, user preferences, and durable facts automatically remembered by your AI
            </p>
          </div>

          <DashboardNav current="memories" />
        </header>

        <Show when="signed-out">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-xl font-medium text-zinc-300">
              Sign in to manage your Second Brain memories
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Your memory bank is private, isolated to your account, and semantically embedded.
            </p>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column: Create Memory Card */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
                <h2 className="text-base font-semibold text-zinc-100 border-b border-zinc-800 pb-3">
                  Store New Memory
                </h2>

                <form onSubmit={handleCreateMemory} className="mt-4 space-y-4">
                  {createError && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
                      {createError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="mem-content"
                      className="block text-xs font-medium text-zinc-400"
                    >
                      Fact / Preference / Note
                    </label>
                    <textarea
                      id="mem-content"
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="e.g. Prefer concise answers; working on Next.js frontend; doctor is Dr. Smith"
                      className="mt-1 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Importance Level ({importance})
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {IMPORTANCE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setImportance(preset.value)}
                          className={`rounded-lg border py-1.5 text-center text-xs font-medium transition ${
                            importance === preset.value
                              ? `${preset.color} ring-1 ring-zinc-400 font-semibold`
                              : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? "Storing & Embedding..." : "Store Memory"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Semantic Search & Memory List */}
            <div className="lg:col-span-2 space-y-4">
              {/* Semantic Search Bar */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Semantic search memories (e.g. medical, coding preferences)..."
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                  {searchResults !== null && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      Clear
                    </button>
                  )}
                </form>

                {searchError && (
                  <p className="mt-2 text-xs text-red-300">{searchError}</p>
                )}
              </div>

              {actionError && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
                  {actionError}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Search Results Display */}
              {searchResults !== null ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-zinc-300">
                      Search Results for &ldquo;{searchQuery}&rdquo; ({searchResults.length})
                    </h2>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center text-xs text-zinc-400">
                      No matching memories found for this query.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {searchResults.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-zinc-100 flex-1 whitespace-pre-wrap">
                              {item.content}
                            </p>
                            <span className="rounded-md border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                              {(item.similarity * 100).toFixed(0)}% match
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${getImportanceBadge(
                                item.importance,
                              )}`}
                            >
                              {getImportanceLabel(item.importance)} ({item.importance})
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              disabled={operatingId === item.id}
                              className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              {operatingId === item.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Full Memory Bank List */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-medium text-zinc-300">
                      Memory Bank ({memories.length})
                    </h2>
                  </div>

                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-20 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40"
                        />
                      ))}
                    </div>
                  ) : memories.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center">
                      <p className="text-sm font-medium text-zinc-300">No memories stored yet</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Add a fact or preference above, or chat with BrainOS to automatically persist memories.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {memories.map((mem) => (
                        <div
                          key={mem.id}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition hover:border-zinc-700"
                        >
                          {editingId === mem.id ? (
                            /* Inline Edit Mode */
                            <div className="space-y-3">
                              <textarea
                                rows={3}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                                disabled={isUpdating}
                              />

                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">Importance:</span>
                                <div className="flex gap-1">
                                  {IMPORTANCE_PRESETS.map((preset) => (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      onClick={() => setEditImportance(preset.value)}
                                      className={`rounded border px-2 py-0.5 text-xs transition ${
                                        editImportance === preset.value
                                          ? `${preset.color} font-semibold ring-1 ring-zinc-400`
                                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={isUpdating}
                                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdate(mem.id)}
                                  disabled={isUpdating}
                                  className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
                                >
                                  {isUpdating ? "Saving..." : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* View Mode */
                            <div>
                              <p className="text-sm text-zinc-100 whitespace-pre-wrap">
                                {mem.content}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 border-t border-zinc-800/60 pt-2.5">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${getImportanceBadge(
                                      mem.importance,
                                    )}`}
                                  >
                                    {getImportanceLabel(mem.importance)} ({mem.importance})
                                  </span>

                                  <span>Saved: {formatDateTime(mem.createdAt)}</span>

                                  {mem.lastAccessedAt && (
                                    <span className="hidden sm:inline text-zinc-500">
                                      Recalled: {formatDateTime(mem.lastAccessedAt)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(mem)}
                                    className="text-xs text-zinc-400 hover:text-zinc-200"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(mem.id)}
                                    disabled={operatingId === mem.id}
                                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                                  >
                                    {operatingId === mem.id ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Show>
      </div>
    </main>
  );
}
