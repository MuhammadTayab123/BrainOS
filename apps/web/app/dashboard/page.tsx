"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SignInButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import {
  streamAssistant,
  createConversation,
  listConversations,
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
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState("BrainOS is thinking...");
  const [activeTaskMessage, setActiveTaskMessage] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

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
    if (loading || switching) {
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
      switching
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
          : "Failed to load conversation.",
      );
    } finally {
      setSwitching(false);
    }
  }

  function handleCancelStream() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  async function handleAskAssistant() {
    if (!message.trim() || !conversation || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setCurrentStatus("BrainOS is thinking...");
    setActiveTaskMessage(null);
    setStreamingMessage(null);

    const userMessage = message.trim();
    setMessage("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      conversationId: conversation.id,
      role: "USER",
      content: userMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    isNearBottomRef.current = true;
    scrollToBottom("smooth");

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
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">
              BrainOS
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              Personal AI Operating System
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Show when="signed-in">
              <Link
                href="/dashboard/tasks"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                Tasks
              </Link>

              <Link
                href="/dashboard/automations"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-white"
              >
                Automations
              </Link>

              <UserButton />
            </Show>
          </div>
        </header>

        <Show when="signed-out">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-semibold">
              Welcome to BrainOS
            </h2>

            <p className="mt-3 max-w-md text-zinc-400">
              Sign in to talk to your BrainOS assistant.
            </p>

            <SignInButton mode="modal">
              <button className="mt-6 rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200">
                Sign in
              </button>
            </SignInButton>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="flex flex-1 gap-6 pt-6">
            {/* Conversation sidebar */}
            <aside className="hidden w-64 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-3 md:flex">
              <button
                onClick={() => void handleNewConversation()}
                disabled={loading || switching}
                className="mb-3 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {switching
                  ? "Loading..."
                  : "+ New Chat"}
              </button>

              <div className="flex-1 space-y-1 overflow-y-auto">
                {conversations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      void handleSelectConversation(item)
                    }
                    disabled={loading || switching}
                    className={`w-full rounded-lg px-3 py-3 text-left text-sm transition ${
                      item.id === conversation?.id
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-400 hover:bg-zinc-800/70 hover:text-white"
                    }`}
                  >
                    <p className="truncate font-medium">
                      {item.title ?? "New conversation"}
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      {new Date(
                        item.updatedAt,
                      ).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            {/* Main conversation */}
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="pb-6">
                <h2 className="text-3xl font-semibold">
                  {conversation?.title ?? "BrainOS"}
                </h2>

                <p className="mt-2 text-zinc-400">
                  Your conversation is saved automatically.
                </p>
              </div>

              {initializing ? (
                <div className="flex flex-1 items-center justify-center text-zinc-500">
                  Loading conversations...
                </div>
              ) : (
                <>
                  <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 space-y-4 overflow-y-auto pb-6"
                  >
                    {messages.length === 0 && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-500">
                        Start a conversation with BrainOS.
                      </div>
                    )}

                    {messages.map((item) => (
                      <div
                        key={item.id}
                        className={
                          item.role === "USER"
                            ? "ml-auto max-w-2xl rounded-xl bg-white p-4 text-black"
                            : "mr-auto max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                        }
                      >
                        <p
                          className={
                            item.role === "USER"
                              ? "mb-2 text-sm font-medium text-zinc-600"
                              : "mb-2 text-sm font-medium text-zinc-400"
                          }
                        >
                          {item.role === "USER"
                            ? "You"
                            : item.role === "ASSISTANT"
                              ? "BrainOS"
                              : "System"}
                        </p>

                        <p className="whitespace-pre-wrap leading-7">
                          {item.content}
                        </p>
                      </div>
                    ))}

                    {loading && streamingMessage !== null && (
                      <div className="mr-auto max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                        <p className="mb-2 text-sm font-medium text-zinc-400">
                          BrainOS
                        </p>
                        <p className="whitespace-pre-wrap leading-7">
                          {streamingMessage}
                          <span className="inline-block h-4 w-1.5 animate-pulse bg-blue-400 ml-1 align-middle" />
                        </p>
                      </div>
                    )}

                    {loading && (
                      <div className="mr-auto max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                          <p className="text-sm font-medium text-zinc-300">
                            {currentStatus}
                          </p>
                        </div>
                        {activeTaskMessage && (
                          <p className="mt-2 text-xs text-zinc-400">
                            {activeTaskMessage}
                          </p>
                        )}
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">
                      {error}
                    </div>
                  )}

                  <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-950 py-5">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                      <textarea
                        value={message}
                        onChange={(event) =>
                          setMessage(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();
                            void handleAskAssistant();
                          }
                        }}
                        placeholder="Message BrainOS..."
                        rows={3}
                        disabled={
                          loading ||
                          switching ||
                          !conversation
                        }
                        className="w-full resize-none bg-transparent p-2 text-white outline-none placeholder:text-zinc-500"
                      />

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-zinc-500">
                          Enter to send · Shift+Enter for new line
                        </p>

                        <div className="flex items-center gap-2">
                          {loading && (
                            <button
                              type="button"
                              onClick={handleCancelStream}
                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                            >
                              Cancel
                            </button>
                          )}

                          <button
                            onClick={() =>
                              void handleAskAssistant()
                            }
                            disabled={
                              loading ||
                              switching ||
                              !conversation ||
                              !message.trim()
                            }
                            className="rounded-lg bg-white px-5 py-2.5 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {loading
                              ? "Thinking..."
                              : "Send"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </Show>
      </div>
    </main>
  );
}