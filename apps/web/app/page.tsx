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
    retrievedDocuments?: DocumentSearchResult[];
  };
  error?: {
    code: string;
    message: string;
  };
}

interface Document {
  id: string;
  userId: string;
  title: string;
  sourceType: string;
  source: string | null;
  content: string | null;
  mimeType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentSearchResult {
  id: string;
  documentId: string;
  documentTitle: string;
  sourceType: string;
  source: string | null;
  chunkIndex: number;
  content: string;
  similarity: number;
}

export default function Home() {
  const { getToken } = useAuth();

  const API_URL = process.env.NEXT_PUBLIC_BRAINOS_API_URL;

  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantSources, setAssistantSources] = useState<
    DocumentSearchResult[]
  >([]);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DocumentSearchResult[]>(
    [],
  );
  const [searchLoading, setSearchLoading] = useState(false);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  async function getAuthToken() {
    if (!API_URL) {
      throw new Error("NEXT_PUBLIC_BRAINOS_API_URL is not configured.");
    }

    const token = await getToken();

    if (!token) {
      throw new Error("Authentication token unavailable.");
    }

    return token;
  }

  async function askAssistant() {
    if (!message.trim()) return;

    setLoading(true);
    setResponse("");
    setAssistantSources([]);

    try {
      const token = await getAuthToken();

      console.log("BRAINOS TOKEN CHECK:", {
        available: Boolean(token),
        length: token.length,
      });

      const res = await fetch(`${API_URL}/api/v1/assistant/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          enableMemoryRetrieval: true,
          enableDocumentRetrieval: true,
          timezone:
            typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : undefined,
        }),
      });

      const result = (await res.json()) as AssistantResponse;

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message ?? "Assistant request failed.");
      }

      setResponse(result.data?.text ?? "No response received.");

      setAssistantSources(result.data?.retrievedDocuments ?? []);
    } catch (error) {
      setResponse(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createDocument() {
    if (!documentTitle.trim() || !documentContent.trim()) {
      setDocumentMessage("Document title and content are required.");
      return;
    }

    setDocumentLoading(true);
    setDocumentMessage("");

    try {
      const token = await getAuthToken();

      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: documentTitle.trim(),
          sourceType: "TEXT",
          content: documentContent.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message ?? "Document creation failed.");
      }

      setDocumentMessage("Document created successfully.");

      setDocumentTitle("");
      setDocumentContent("");

      await loadDocuments();
    } catch (error) {
      setDocumentMessage(
        error instanceof Error ? error.message : "Document creation failed.",
      );
    } finally {
      setDocumentLoading(false);
    }
  }

  async function searchDocuments() {
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchResults([]);

    try {
      const token = await getAuthToken();

      const res = await fetch(`${API_URL}/api/v1/documents/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          limit: 5,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message ?? "Document search failed.");
      }

      setSearchResults(result.data as DocumentSearchResult[]);
    } catch (error) {
      setDocumentMessage(
        error instanceof Error ? error.message : "Document search failed.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadDocuments() {
    setDocumentsLoading(true);

    try {
      const token = await getAuthToken();

      const res = await fetch(`${API_URL}/api/v1/documents`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message ?? "Failed to load documents.");
      }

      setDocuments(result.data as Document[]);
    } catch (error) {
      setDocumentMessage(
        error instanceof Error ? error.message : "Failed to load documents.",
      );
    } finally {
      setDocumentsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">BrainOS</h1>

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
            <h2 className="text-3xl font-semibold">Welcome to BrainOS</h2>

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
          <div className="space-y-6">
            {/* Assistant */}
            <section>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="mb-4 text-sm text-zinc-400">Assistant</p>

                <div className="min-h-40 whitespace-pre-wrap rounded-xl bg-zinc-950 p-5 text-zinc-200">
                  {loading
                    ? "BrainOS is thinking..."
                    : response || "Ask BrainOS something."}
                </div>
              </div>

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
            </section>
            {assistantSources.length > 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold">Sources</h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Documents retrieved to help answer your question.
                </p>

                <div className="mt-5 space-y-3">
                  {assistantSources.map((source, index) => (
                    <div key={source.id} className="rounded-xl bg-zinc-950 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-medium">
                          {index + 1}. {source.documentTitle}
                        </h3>

                        <span className="text-xs text-zinc-500">
                          similarity: {source.similarity.toFixed(3)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-zinc-500">
                        {source.sourceType} · Chunk {source.chunkIndex}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
                        {source.content}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {/* Document ingestion */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Add Document</h2>

              <p className="mt-1 text-sm text-zinc-400">
                Add text that BrainOS can retrieve during conversations.
              </p>

              <div className="mt-5 space-y-3">
                <input
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400"
                />

                <textarea
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  placeholder="Document content..."
                  rows={6}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400"
                />

                <button
                  onClick={createDocument}
                  disabled={
                    documentLoading ||
                    !documentTitle.trim() ||
                    !documentContent.trim()
                  }
                  className="rounded-xl bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
                >
                  {documentLoading ? "Creating..." : "Create Document"}
                </button>

                {documentMessage && (
                  <p className="text-sm text-zinc-400">{documentMessage}</p>
                )}
              </div>
            </section>

            {/* Document search */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Search Documents</h2>

              <div className="mt-5 flex gap-3">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      searchDocuments();
                    }
                  }}
                  placeholder="Search your documents..."
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-zinc-400"
                />

                <button
                  onClick={searchDocuments}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="rounded-xl bg-white px-5 py-3 font-medium text-black disabled:opacity-50"
                >
                  {searchLoading ? "Searching..." : "Search"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-5 space-y-3">
                  {searchResults.map((result) => (
                    <div key={result.id} className="rounded-xl bg-zinc-950 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-medium">{result.documentTitle}</h3>

                        <span className="text-xs text-zinc-500">
                          similarity: {result.similarity.toFixed(3)}
                        </span>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
                        {result.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Document list */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Documents</h2>

                  <p className="mt-1 text-sm text-zinc-400">
                    Documents currently available to BrainOS.
                  </p>
                </div>

                <button
                  onClick={loadDocuments}
                  disabled={documentsLoading}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
                >
                  {documentsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {documents.length > 0 && (
                <div className="mt-5 space-y-3">
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      className="rounded-xl bg-zinc-950 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{document.title}</h3>

                        <span className="text-xs text-zinc-500">
                          {document.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-zinc-500">
                        {document.sourceType}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {documents.length === 0 && !documentsLoading && (
                <p className="mt-5 text-sm text-zinc-500">
                  No documents loaded yet.
                </p>
              )}
            </section>
          </div>
        </Show>
      </div>
    </main>
  );
}
