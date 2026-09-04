"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SignInButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import {
  askAssistant,
  createConversation,
  listConversations,
  listMessages,
  type Conversation,
  type Message,
} from "../../lib/brainos-client-api";

export default function Home() {
  const { getToken, isSignedIn } = useAuth();

  const [conversation, setConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState("");

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

        const conversations = await listConversations(token);

        let activeConversation = conversations[0];

        if (!activeConversation) {
          activeConversation = await createConversation(token);
        }

        if (cancelled) {
          return;
        }

        setConversation(activeConversation);

        const conversationMessages = await listMessages(
          token,
          activeConversation.id,
        );

        if (!cancelled) {
          setMessages(conversationMessages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load conversation.",
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

  async function handleAskAssistant() {
    if (!message.trim() || !conversation || loading) {
      return;
    }

    setLoading(true);
    setError("");

    const userMessage = message.trim();
    setMessage("");

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      const result = await askAssistant(
        token,
        userMessage,
        {
          conversationId: conversation.id,
          enableMemoryRetrieval: false,
        },
      );

      const updatedMessages = await listMessages(
        token,
        conversation.id,
      );

      setMessages(updatedMessages);

      if (!result.text && updatedMessages.length === 0) {
        setError("BrainOS returned an empty response.");
      }
    } catch (err) {
      setMessage(userMessage);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
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
          <section className="flex flex-1 flex-col">
            <div className="py-8">
              <h2 className="text-3xl font-semibold">
                {conversation?.title ?? "BrainOS"}
              </h2>

              <p className="mt-2 text-zinc-400">
                Your conversation is saved automatically.
              </p>
            </div>

            {initializing ? (
              <div className="flex flex-1 items-center justify-center text-zinc-500">
                Loading conversation...
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 pb-6">
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

                  {loading && (
                    <div className="mr-auto max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                      <p className="text-sm text-zinc-500">
                        BrainOS is thinking...
                      </p>
                    </div>
                  )}
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
                      disabled={loading || !conversation}
                      className="w-full resize-none bg-transparent p-2 text-white outline-none placeholder:text-zinc-500"
                    />

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-zinc-500">
                        Enter to send · Shift+Enter for new line
                      </p>

                      <button
                        onClick={() => void handleAskAssistant()}
                        disabled={
                          loading ||
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
              </>
            )}
          </section>
        </Show>
      </div>
    </main>
  );
}