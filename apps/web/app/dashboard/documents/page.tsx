"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, useAuth } from "@clerk/nextjs";
import { DashboardNav } from "../../../components/dashboard-nav";

import {
  createTextDocument,
  deleteDocument,
  listDocuments,
  uploadDocument,
  type Document,
  type DocumentStatus,
} from "../../../lib/brainos-client-api";

type FilterTab = "ALL" | DocumentStatus;
type CreationTab = "UPLOAD" | "TEXT";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain"];

export default function DocumentsPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>("ALL");

  // Creation form state
  const [creationTab, setCreationTab] = useState<CreationTab>("UPLOAD");
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication token is unavailable.");
      }

      const data = await listDocuments(token, {
        status: selectedFilter !== "ALL" ? selectedFilter : undefined,
      });
      setDocuments(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedFilter]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void fetchDocuments();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchDocuments]);

  const handleFileChange = (file: File | null) => {
    setFormError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormError("File size exceeds 5MB limit.");
      setSelectedFile(null);
      return;
    }

    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);
    const isAllowedExt =
      file.name.endsWith(".pdf") || file.name.endsWith(".txt");

    if (!isAllowedMime && !isAllowedExt) {
      setFormError("Only PDF and TXT files are supported.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      // Default title from file name without extension
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(baseName);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Document title is required.");
      return;
    }

    if (creationTab === "UPLOAD") {
      if (!selectedFile) {
        setFormError("Please select a file to upload.");
        return;
      }
    } else {
      if (!textContent.trim()) {
        setFormError("Document text content cannot be empty.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      if (creationTab === "UPLOAD" && selectedFile) {
        await uploadDocument(token, {
          title: trimmedTitle,
          file: selectedFile,
        });
      } else {
        await createTextDocument(token, {
          title: trimmedTitle,
          content: textContent,
        });
      }

      // Reset form on success
      setTitle("");
      setSelectedFile(null);
      setTextContent("");
      await fetchDocuments();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create document.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setOperatingId(documentId);
    setActionError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication required.");
      }

      await deleteDocument(token, documentId);
      setConfirmDeleteId(null);
      await fetchDocuments();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete document.",
      );
    } finally {
      setOperatingId(null);
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

  function getStatusBadgeClass(status: DocumentStatus) {
    switch (status) {
      case "READY":
        return "border-emerald-900/60 bg-emerald-950/40 text-emerald-300";
      case "PENDING":
        return "border-amber-900/60 bg-amber-950/40 text-amber-300";
      case "FAILED":
        return "border-red-900/60 bg-red-950/40 text-red-300";
      case "DELETED":
        return "border-zinc-800 bg-zinc-900 text-zinc-400";
      default:
        return "border-zinc-800 bg-zinc-900 text-zinc-400";
    }
  }

  const readyCount = documents.filter((d) => d.status === "READY").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-2xl font-semibold">BrainOS Documents & Knowledge Base</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Upload documents and notes to expand your AI memory and RAG context
            </p>
          </div>

          <DashboardNav current="documents" />
        </header>

        <Show when="signed-out">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="text-xl font-medium text-zinc-300">
              Sign in to manage your documents and knowledge base
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Your documents are private, securely embedded, and isolated to your account.
            </p>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left: Ingestion Card */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                  <h2 className="text-base font-semibold text-zinc-100">
                    Add to Knowledge Base
                  </h2>
                </div>

                {/* Tabs: Upload vs Text */}
                <div className="mt-4 flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setCreationTab("UPLOAD");
                      setFormError(null);
                    }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                      creationTab === "UPLOAD"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreationTab("TEXT");
                      setFormError(null);
                    }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                      creationTab === "TEXT"
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Write Note
                  </button>
                </div>

                <form onSubmit={handleCreateDocument} className="mt-4 space-y-4">
                  {formError && (
                    <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="doc-title"
                      className="block text-xs font-medium text-zinc-400"
                    >
                      Title
                    </label>
                    <input
                      id="doc-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Project Architecture Specs"
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                      disabled={submitting}
                    />
                  </div>

                  {creationTab === "UPLOAD" ? (
                    <div>
                      <label className="block text-xs font-medium text-zinc-400">
                        File (PDF or TXT, max 5MB)
                      </label>
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
                          isDragging
                            ? "border-emerald-500 bg-emerald-950/20"
                            : selectedFile
                            ? "border-zinc-600 bg-zinc-950"
                            : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-500"
                        }`}
                      >
                        <input
                          id="file-upload"
                          type="file"
                          accept=".pdf,.txt,application/pdf,text/plain"
                          onChange={(e) =>
                            handleFileChange(
                              e.target.files && e.target.files.length > 0
                                ? e.target.files[0]
                                : null,
                            )
                          }
                          className="hidden"
                          disabled={submitting}
                        />
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer text-xs text-zinc-400 hover:text-white"
                        >
                          {selectedFile ? (
                            <span className="font-medium text-emerald-400 break-all">
                              {selectedFile.name} (
                              {(selectedFile.size / 1024).toFixed(1)} KB)
                            </span>
                          ) : (
                            <span>
                              Drag & drop or{" "}
                              <span className="text-zinc-200 underline">
                                browse
                              </span>
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="doc-content"
                        className="block text-xs font-medium text-zinc-400"
                      >
                        Note Content (Markdown or plain text)
                      </label>
                      <textarea
                        id="doc-content"
                        rows={6}
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder="Paste or write notes, guidelines, documentation..."
                        className="mt-1 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                        disabled={submitting}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? "Ingesting..."
                      : creationTab === "UPLOAD"
                      ? "Upload & Process"
                      : "Save Note"}
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Document List */}
            <div className="lg:col-span-2">
              <div className="flex flex-col gap-4">
                {/* Header & Filter Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Knowledge Items</h2>
                    <p className="text-xs text-zinc-400">
                      {documents.length} item{documents.length === 1 ? "" : "s"} total
                      {" • "}
                      <span className="text-emerald-400">{readyCount} indexed & ready</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1 text-xs">
                    {(["ALL", "READY", "PENDING", "FAILED"] as FilterTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setSelectedFilter(tab);
                        }}
                        className={`rounded-md px-2.5 py-1 font-medium transition ${
                          selectedFilter === tab
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
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

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-20 animate-pulse rounded-xl border border-zinc-800/80 bg-zinc-900/40"
                      />
                    ))}
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-12 text-center">
                    <p className="text-sm font-medium text-zinc-300">No documents found</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {selectedFilter === "ALL"
                        ? "Upload a PDF or TXT file, or write a note to provide context to BrainOS."
                        : `No documents with status "${selectedFilter}".`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700"
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-medium text-zinc-100">
                              {doc.title}
                            </h3>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getStatusBadgeClass(
                                doc.status,
                              )}`}
                            >
                              {doc.status}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[11px] font-mono text-zinc-300">
                              {doc.sourceType}
                            </span>
                            {doc.source && (
                              <span className="truncate max-w-[200px]" title={doc.source}>
                                Source: {doc.source}
                              </span>
                            )}
                            <span>Added: {formatDateTime(doc.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {confirmDeleteId === doc.id ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-zinc-300">Delete document?</span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteDocument(doc.id)}
                                disabled={operatingId === doc.id}
                                className="font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                              >
                                {operatingId === doc.id ? "Deleting..." : "Delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={operatingId === doc.id}
                                className="text-zinc-400 hover:text-white disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(doc.id)}
                              disabled={operatingId === doc.id}
                              className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-950/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Show>
      </div>
    </main>
  );
}
