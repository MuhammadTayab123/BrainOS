"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SignInButton,
  Show,
  UserButton,
  useAuth,
} from "@clerk/nextjs";

interface AssistantResponse {
  success: boolean;
  data?: {
    text: string;
    model: string;
    provider: string;
    retrievedMemories: unknown[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export default function Home() {
  const { getToken } = useAuth();

  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askAssistant() {
    if (!message.trim()) {
      return;
    }

    setLoading(true);
    setResponse("");
    setError("");

    try {
      const token = await getToken();

      console.log("BRAINOS TOKEN CHECK:", {
        available: Boolean(token),
        length: token?.length ?? 0,
      });

      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      const res = await fetch(
        "http://localhost:3001/api/v1/assistant/ask",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: message.trim(),
            enableMemoryRetrieval: false,
          }),
        },
      );

      const result =
        (await res.json()) as AssistantResponse;

      if (!res.ok || !result.success) {
        throw new Error(
          result.error?.message ??
            "Assistant request failed.",
        );
      }

      setResponse(result.data?.text ?? "");
    } catch (err) {
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
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
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
          <section className="flex flex-1 flex-col justify-center">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold">
                Ask BrainOS
              </h2>

              <p className="mt-2 text-zinc-400">
                Your request will be processed by the BrainOS
                Assistant service.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                placeholder="Ask BrainOS something..."
                rows={5}
                disabled={loading}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-white outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              />

              <button
                onClick={askAssistant}
                disabled={loading || !message.trim()}
                className="mt-4 rounded-lg bg-white px-5 py-3 font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Thinking..." : "Ask BrainOS"}
              </button>
            </div>

            {error && (
              <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">
                {error}
              </div>
            )}

            {response && (
              <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="mb-2 text-sm font-medium text-zinc-400">
                  BrainOS
                </p>

                <p className="whitespace-pre-wrap leading-7">
                  {response}
                </p>
              </div>
            )}
          </section>
        </Show>
      </div>
    </main>
  );
}