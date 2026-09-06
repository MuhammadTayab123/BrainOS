"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SignInButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { DashboardNav } from "../../components/dashboard-nav";
import {
  streamAssistant,
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  listMessages,
  type Conversation,
  type Message,
} from "../../lib/brainos-client-api";

export default function Home() {
  const { getToken, isSignedIn } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState("BrainOS is thinking...");
  const [activeTaskMessage, setActiveTaskMessage] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);

  const filteredConversations = conversations.filter((c) =>
    (c.title || "New conversation").toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (textareaRef.current) {
      if (!message) {
        textareaRef.current.style.height = "auto";
      } else {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [message]);

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }

  function handleScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 100;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= threshold;
  }

  useEffect(() => {
    if (isNearBottomRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, streamingMessage, currentStatus, activeTaskMessage]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    let cancelled = false;

    async function initializeConversation() {
      setInitializing(true);
      setError("");

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Authentication token unavailable.");
        }

        const existingConversations =
          await listConversations(token);

        let activeConversation = existingConversations[0];

        if (!activeConversation) {
          activeConversation = await createConversation(token);
          existingConversations.unshift(activeConversation);
        }

        if (cancelled) {
          return;
        }

        setConversations(existingConversations);
        setConversation(activeConversation);

        const conversationMessages = await listMessages(
          token,
          activeConversation.id,
        );

        if (!cancelled) {
          setMessages(conversationMessages);
          isNearBottomRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load conversations.",
          );
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    }

    void initializeConversation();

    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  async function handleNewConversation() {
    if (loading || switching || deletingId) {
      return;
    }

    setSwitching(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      const newConversation = await createConversation(token);

      setConversations((current) => [
        newConversation,
        ...current,
      ]);
      setConversation(newConversation);
      setMessages([]);
      setMessage("");
      isNearBottomRef.current = true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create conversation.",
      );
    } finally {
      setSwitching(false);
    }
  }

  async function handleSelectConversation(
    selectedConversation: Conversation,
  ) {
    if (
      selectedConversation.id === conversation?.id ||
      loading ||
      switching ||
      deletingId
    ) {
      return;
    }

    setSwitching(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      const conversationMessages = await listMessages(
        token,
        selectedConversation.id,
      );

      setConversation(selectedConversation);
      setMessages(conversationMessages);
      setMessage("");
      isNearBottomRef.current = true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load messages.",
      );
    } finally {
      setSwitching(false);
    }
  }

  async function handleDeleteConversation(id: string) {
    if (deletingId || loading || switching) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      await deleteConversation(token, id);

      const updatedConversations = conversations.filter(
        (item) => item.id !== id,
      );
      setConversations(updatedConversations);

      if (conversation?.id === id) {
        if (updatedConversations.length > 0) {
          const nextConversation = updatedConversations[0];
          setConversation(nextConversation);
          const conversationMessages = await listMessages(
            token,
            nextConversation.id,
          );
          setMessages(conversationMessages);
        } else {
          const newConversation = await createConversation(token);
          setConversations([newConversation]);
          setConversation(newConversation);
          setMessages([]);
        }
      }

      setConfirmDeleteId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete conversation.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function handleCancelStream() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function handleAskAssistant() {
    if (!message.trim() || !conversation || loading || switching) {
      return;
    }

    const userMessage = message.trim();
    setMessage("");
    setError("");
    setLoading(true);
    setStreamingMessage("");
    setCurrentStatus("BrainOS is thinking...");
    setActiveTaskMessage(null);
    isNearBottomRef.current = true;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const optimisticUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      role: "USER",
      content: userMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      const result = await streamAssistant(
        token,
        userMessage,
        {
          conversationId: conversation.id,
          signal: abortController.signal,
          onEvent: (event) => {
            if (event.type === "state_changed") {
              const state = event.data.state;
              if (state === "THINKING") {
                setCurrentStatus("BrainOS is thinking...");
              } else if (state === "EXECUTING") {
                setCurrentStatus("BrainOS is executing an action...");
              } else if (state === "SPEAKING") {
                setCurrentStatus("BrainOS is finalizing the response...");
                setActiveTaskMessage(null);
              }
            } else if (event.type === "task_event") {
              const taskEvent = event.data;
              if (taskEvent.message) {
                setActiveTaskMessage(taskEvent.message);
              }
            } else if (event.type === "text_delta") {
              if (event.data.delta) {
                setStreamingMessage((prev) => (prev ? prev + event.data.delta : event.data.delta));
              }
            }
          },
        },
      );

      const updatedMessages = await listMessages(
        token,
        conversation.id,
      );

      setMessages(updatedMessages);
      setStreamingMessage(null);

      try {
        const updatedConversation = await getConversation(
          token,
          conversation.id,
        );
        if (updatedConversation) {
          setConversation((current) =>
            current?.id === conversation.id ? updatedConversation : current,
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversation.id ? updatedConversation : c,
            ),
          );
        }
      } catch {
        // Non-blocking conversation metadata refresh
      }

      if (!result.text && updatedMessages.length === 0) {
        setError("BrainOS returned an empty response.");
      }
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError")
      ) {
        setError("Request was cancelled.");
      } else {
        setMessage(userMessage);
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong.",
        );
      }
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setStreamingMessage(null);
      setCurrentStatus("BrainOS is thinking...");
      setActiveTaskMessage(null);
    }
  }

  return (
    <>
      <Show when="signed-out">
        <main className="min-h-screen bg-zinc-950 text-white">
          <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
            <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
              <div>
                <h1 className="text-2xl font-semibold">BrainOS</h1>
                <p className="mt-1 text-sm text-zinc-400">Personal AI Operating System</p>
              </div>
              <DashboardNav current="chat" orientation="horizontal" />
            </header>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 className="text-3xl font-semibold">Welcome to BrainOS</h2>
              <p className="mt-3 max-w-md text-zinc-400">
                Sign in to talk to your BrainOS assistant.
              </p>
              <SignInButton mode="modal">
                <button className="mt-6 rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </div>
        </main>
      </Show>

      <Show when="signed-in">
        <main className="relative flex h-screen h-[100dvh] w-full overflow-hidden bg-zinc-950 text-white">
          {/* Mobile Backdrop Overlay */}
          {isSidebarOpen && (
            <div
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              aria-hidden="true"
            />
          )}

          {/* Single Unified Left Sidebar (280-290px) */}
          <aside
            className={`${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
            } fixed inset-y-0 left-0 z-50 flex w-[290px] h-full overflow-hidden flex-col border-r border-zinc-800/80 bg-zinc-900/95 md:static md:translate-x-0 md:flex md:w-[290px] shrink-0 transition-transform duration-200 ease-in-out`}
          >
            {/* Top Branding Header with Collapse Button */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 p-3.5 shrink-0">
              <div className="px-1">
                <h1 className="text-lg font-bold tracking-tight text-white">BrainOS</h1>
                <p className="text-[11px] text-zinc-400">Personal AI OS</p>
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Sidebar's Single Vertical Scroll Area */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
              {/* Navigation Stack */}
              <DashboardNav current="chat" orientation="vertical" showUserButton={false} />

              <div className="border-t border-zinc-800/80 my-2" />

              {/* New Chat Button */}
              <button
                onClick={() => {
                  void handleNewConversation();
                  if (typeof window !== "undefined" && window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                disabled={loading || switching || deletingId !== null}
                className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
              >
                {switching ? "Loading..." : "+ New Chat"}
              </button>

              {/* Search Conversations Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 pl-8 text-xs text-white placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
                />
                <svg
                  className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Recent Conversations Section */}
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-1 pt-1">
                Recent Conversations
              </div>
              <div className="space-y-1">
                {filteredConversations.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-zinc-500">
                    {searchQuery ? "No matching conversations" : "No recent conversations"}
                  </p>
                ) : (
                  filteredConversations.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative flex items-center justify-between rounded-lg transition ${
                        item.id === conversation?.id
                          ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/60"
                          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                      }`}
                    >
                      {confirmDeleteId === item.id ? (
                        <div className="flex w-full items-center justify-between px-3 py-2 text-xs">
                          <span className="font-medium text-zinc-300">Delete chat?</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDeleteConversation(item.id)}
                              disabled={deletingId === item.id}
                              className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                              {deletingId === item.id ? "Deleting..." : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === item.id}
                              className="text-zinc-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void handleSelectConversation(item);
                              if (typeof window !== "undefined" && window.innerWidth < 768) {
                                setIsSidebarOpen(false);
                              }
                            }}
                            disabled={loading || switching || deletingId !== null}
                            className="min-w-0 flex-1 px-3 py-2 text-left text-xs"
                          >
                            <p className="truncate font-medium">
                              {item.title ?? "New conversation"}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-500">
                              {new Date(item.updatedAt).toLocaleDateString()}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(item.id);
                            }}
                            disabled={loading || switching || deletingId !== null}
                            title="Delete conversation"
                            aria-label={`Delete conversation ${item.title ?? "New conversation"}`}
                            className="mr-1.5 rounded p-1 text-zinc-500 opacity-0 transition hover:bg-zinc-700 hover:text-red-400 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-zinc-800/80 my-2" />

              {/* Account Section inside scrollable sidebar */}
              <div className="pt-1 flex items-center justify-between px-2 pb-2">
                <span className="text-xs font-medium text-zinc-400">Account</span>
                <UserButton />
              </div>
            </div>
          </aside>

          {/* Large Right Main Chat Area */}
          <section className="flex flex-1 flex-col min-w-0 min-h-0 h-full overflow-hidden bg-zinc-950">
            {/* Pinned Stationary Conversation Header */}
            <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 md:px-6 py-3.5 backdrop-blur shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition shrink-0"
                  title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                  aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-semibold truncate text-zinc-100">
                    {conversation?.title ?? "BrainOS"}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Your conversation is saved automatically.
                  </p>
                </div>
              </div>
            </header>

            {initializing ? (
              <div className="flex flex-1 items-center justify-center text-zinc-500">
                Loading conversations...
              </div>
            ) : (
              <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                {/* Independently Scrollable Message Feed */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="min-h-0 flex-1 overflow-y-auto px-4 md:px-8 py-6"
                >
                  <div className="mx-auto max-w-4xl w-full space-y-4">
                    {messages.length === 0 && (
                      <div className="py-20 text-center">
                        <h3 className="text-lg font-medium text-zinc-300">
                          Start a conversation with BrainOS
                        </h3>
                        <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
                          Ask questions, manage tasks, set reminders, organize documents, or run automations.
                        </p>
                      </div>
                    )}

                    {messages.map((item) => (
                      <div
                        key={item.id}
                        className={
                          item.role === "USER"
                            ? "flex flex-col items-end space-y-1"
                            : "flex flex-col items-start space-y-1"
                        }
                      >
                        {item.role === "USER" ? (
                          <>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400/80 pr-1">
                              <span>You</span>
                              <span className="text-[10px] text-zinc-500">
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="ml-auto max-w-[85%] md:max-w-[70%] rounded-2xl rounded-tr-sm bg-emerald-950/70 border border-emerald-800/50 px-4 py-2.5 text-sm md:text-base text-emerald-50 shadow-sm leading-relaxed whitespace-pre-wrap">
                              {item.content}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-blue-400 pl-1">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-400">
                                B
                              </span>
                              <span>BrainOS</span>
                              <span className="text-[10px] text-zinc-500">
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="mr-auto max-w-[90%] md:max-w-[80%] rounded-2xl rounded-tl-sm border border-zinc-800/80 bg-zinc-900/90 px-4 py-3 text-sm md:text-base text-zinc-100 shadow-sm leading-relaxed whitespace-pre-wrap">
                              {item.content}
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {loading && streamingMessage !== null && (
                      <div className="flex flex-col items-start space-y-1">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-blue-400 pl-1">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-[10px] font-bold text-blue-400">
                            B
                          </span>
                          <span>BrainOS</span>
                        </div>
                        <div className="mr-auto max-w-[90%] md:max-w-[80%] rounded-2xl rounded-tl-sm border border-zinc-800/80 bg-zinc-900/90 px-4 py-3 text-sm md:text-base text-zinc-100 shadow-sm leading-relaxed whitespace-pre-wrap">
                          {streamingMessage}
                          <span className="inline-block h-4 w-1.5 animate-pulse bg-blue-400 ml-1 align-middle" />
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="flex flex-col items-start space-y-1.5 pt-1 pl-1">
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1 text-xs text-zinc-300">
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                          <span>{currentStatus}</span>
                        </div>
                        {activeTaskMessage && (
                          <p className="text-xs text-zinc-400 pl-3">
                            {activeTaskMessage}
                          </p>
                        )}
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {error && (
                  <div className="mx-4 md:mx-8 mb-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-xs md:text-sm text-red-300 shrink-0">
                    {error}
                  </div>
                )}

                {/* Fixed Docked Message Composer */}
                <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950 px-4 md:px-8 py-2.5 md:py-3">
                  <div className="mx-auto max-w-4xl w-full">
                    <div className="relative flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-1.5 focus-within:border-zinc-700 transition shadow-inner">
                      <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleAskAssistant();
                          }
                        }}
                        placeholder="Message BrainOS..."
                        rows={1}
                        disabled={loading || switching || !conversation}
                        className="min-h-[38px] max-h-[120px] flex-1 resize-none bg-transparent py-2 text-sm md:text-base text-white outline-none placeholder:text-zinc-500 leading-normal"
                      />

                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        {loading && (
                          <button
                            type="button"
                            onClick={handleCancelStream}
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          onClick={() => void handleAskAssistant()}
                          disabled={loading || switching || !conversation || !message.trim()}
                          title="Send message (Enter)"
                          aria-label="Send message"
                          className="flex items-center justify-center rounded-lg bg-white px-3.5 py-1.5 text-xs md:text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {loading ? "Thinking..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </Show>
    </>
  );
}