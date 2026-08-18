"use client";

import { useState } from "react";
import { SignInButton, Show, UserButton, useAuth } from "@clerk/nextjs";

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

  async function askAssistant() {
    if (!message.trim()) return;

    setLoading(true);
    setResponse("");

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
            enableMemoryRetrieval: true,
          }),
        }
      );

      const result =
        (await res.json()) as AssistantResponse;

      if (!res.ok || !result.success) {
        throw new Error(
          result.error?.message ?? "Assistant request failed."
        );
      }

      setResponse(result.data?.text ?? "No response received.");
    } catch (error) {
      setResponse(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">
              BrainOS
            </h1>

            <p className="mt-2 text-zinc-400">
              Your Personal AI Operating System
            </p>
          </div>

          <Show when="signed-in">
            <UserButton />
          </Show>
        </header>

        <Show when="signed-out">
          <section className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-semibold">
              Welcome to BrainOS
            </h2>

            <p className="mt-3 max-w-md text-zinc-400">
              Sign in to talk to your BrainOS assistant.
            </p>

            <SignInButton mode="modal">
              <button className="mt-6 rounded-xl bg-white px-6 py-3 font-medium text-black hover:bg-zinc-200">
                Sign in
              </button>
            </SignInButton>
          </section>
        </Show>

        <Show when="signed-in">
          <section className="flex-1">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="mb-4 text-sm text-zinc-400">
                Assistant
              </p>

              <div className="min-h-40 whitespace-pre-wrap rounded-xl bg-zinc-950 p-5 text-zinc-200">
                {loading
                  ? "BrainOS is thinking..."
                  : response || "Ask BrainOS something."}
              </div>
            </div>
          </section>

          <div className="mt-6 flex gap-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  askAssistant();
                }
              }}
              disabled={loading}
              placeholder="Ask BrainOS..."
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-400 disabled:opacity-50"
            />

            <button
              onClick={askAssistant}
              disabled={loading || !message.trim()}
              className="rounded-xl bg-white px-6 py-3 font-medium text-black disabled:opacity-50"
            >
              {loading ? "Thinking..." : "Ask"}
            </button>
          </div>
        </Show>
      </div>
    </main>
  );
}