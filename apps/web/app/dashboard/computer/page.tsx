"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { DashboardNav } from "../../../components/dashboard-nav";
import {
  ComputerAgent,
  ComputerAgentPermission,
  ComputerAgentStatus,
  createComputerAgent,
  deleteComputerAgent,
  grantComputerAgentPermission,
  listComputerAgentPermissions,
  listComputerAgents,
  RegisteredComputerAgent,
  revokeComputerAgent,
  revokeComputerAgentPermission,
} from "../../../lib/brainos-client-api";

const RECOGNIZED_PRIVILEGED_ACTIONS = [
  {
    action: "computer_launch_application",
    name: "Launch Applications",
    description:
      "Allows BrainOS Assistant and Voice to launch installed desktop applications using their discovered AppID.",
  },
  {
    action: "computer_write_file",
    name: "Write Files",
    description:
      "Allows BrainOS Assistant and Voice to create or overwrite files within the authorized user workspace path.",
  },
];

const SAFE_READ_ONLY_ACTIONS = [
  {
    action: "computer_get_status",
    name: "Computer Status",
    description: "Read-only system platform, hostname, and capability information.",
  },
  {
    action: "computer_list_applications",
    name: "List Applications",
    description: "Read-only discovery of registered system applications.",
  },
  {
    action: "computer_list_files",
    name: "List Files",
    description: "Read-only directory listing within safe user workspace boundaries.",
  },
  {
    action: "computer_read_file",
    name: "Read File",
    description: "Read-only file content inspection within safe user workspace boundaries.",
  },
];

export default function ComputerDashboardPage() {
  const { getToken } = useAuth();

  const [agents, setAgents] = useState<ComputerAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<ComputerAgentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissionToggling, setPermissionToggling] = useState<string | null>(null);

  // Agent Creation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentId, setNewAgentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [newlyRegistered, setNewlyRegistered] = useState<RegisteredComputerAgent | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);

  // Revocation / Deletion
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState<"ALL" | ComputerAgentStatus>("ALL");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAgents = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      setLoading(true);
      setError("");

      const data = await listComputerAgents(token, {
        status: filterStatus !== "ALL" ? filterStatus : undefined,
      });

      setAgents(data ?? []);

      if (data && data.length > 0) {
        setSelectedAgentId((prev) => {
          if (prev && data.some((a) => a.id === prev)) {
            return prev;
          }
          return data[0].id;
        });
      } else {
        setSelectedAgentId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load computer agents.",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, filterStatus]);

  const loadPermissions = useCallback(
    async (agentId: string) => {
      try {
        const token = await getToken();
        if (!token) return;

        setLoadingPermissions(true);
        const perms = await listComputerAgentPermissions(token, agentId);
        setPermissions(perms ?? []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load agent permissions.",
        );
      } finally {
        setLoadingPermissions(false);
      }
    },
    [getToken],
  );

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    if (selectedAgentId) {
      void loadPermissions(selectedAgentId);
    } else {
      setPermissions([]);
    }
  }, [selectedAgentId, loadPermissions]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  async function handleCreateAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newAgentName.trim()) {
      setError("Agent name is required.");
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      setCreating(true);
      setError("");
      setSuccess("");

      const result = await createComputerAgent(token, {
        name: newAgentName.trim(),
        id: newAgentId.trim() || undefined,
      });

      setNewlyRegistered(result);
      setNewAgentName("");
      setNewAgentId("");
      await loadAgents();
      setSelectedAgentId(result.agent.id);
      setSuccess(`Agent "${result.agent.name}" registered successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to register computer agent.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeAgent(agentId: string) {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      setActionInProgress(agentId);
      setError("");
      setSuccess("");

      await revokeComputerAgent(token, agentId);
      setConfirmRevokeId(null);
      setSuccess("Computer agent revoked successfully.");
      await loadAgents();
      if (selectedAgentId === agentId) {
        void loadPermissions(agentId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke computer agent.",
      );
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleDeleteAgent(agentId: string) {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      setActionInProgress(agentId);
      setError("");
      setSuccess("");

      await deleteComputerAgent(token, agentId);
      setConfirmDeleteId(null);
      setSuccess("Computer agent deleted successfully.");
      await loadAgents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete computer agent.",
      );
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleTogglePermission(action: string) {
    if (!selectedAgentId || !selectedAgent || selectedAgent.status !== "ACTIVE") {
      return;
    }

    const hasPermission = permissions.some((p) => p.action === action);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication token unavailable.");
      }

      setPermissionToggling(action);
      setError("");
      setSuccess("");

      if (hasPermission) {
        await revokeComputerAgentPermission(token, selectedAgentId, action);
        setSuccess(`Revoked permission: ${action}`);
      } else {
        await grantComputerAgentPermission(token, selectedAgentId, action);
        setSuccess(`Granted permission: ${action}`);
      }

      await loadPermissions(selectedAgentId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to update permission for ${action}.`,
      );
    } finally {
      setPermissionToggling(null);
    }
  }

  function copyCredentialToClipboard(credential: string) {
    navigator.clipboard.writeText(credential).then(() => {
      setCopiedCredential(true);
      setTimeout(() => setCopiedCredential(false), 3000);
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header / Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Computer Agents & Permissions
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
                Device Control
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Manage connected local computer agents, active devices, and granular tool authorization.
            </p>
          </div>
          <DashboardNav current="computer" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Error & Success Feedback Banners */}
        {error && (
          <div className="rounded-lg bg-red-950/80 border border-red-800/80 px-4 py-3 text-sm text-red-200 flex items-start justify-between gap-3 shadow-lg">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-200 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-950/80 border border-emerald-800/80 px-4 py-3 text-sm text-emerald-200 flex items-start justify-between gap-3 shadow-lg">
            <span>{success}</span>
            <button
              onClick={() => setSuccess("")}
              className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Newly Registered Agent Credential Notice */}
        {newlyRegistered && (
          <div className="rounded-xl bg-amber-950/60 border border-amber-800/80 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-base font-semibold text-amber-200">
                  New Agent Registered: {newlyRegistered.agent.name}
                </h2>
              </div>
              <button
                onClick={() => setNewlyRegistered(null)}
                className="text-xs text-amber-400 hover:text-amber-200 underline font-medium"
              >
                Close Notice
              </button>
            </div>

            <p className="text-xs text-amber-300/90 leading-relaxed">
              Copy this registration credential now. For security, BrainOS stores only a salted cryptographic hash of this credential on the server. It cannot be retrieved again.
            </p>

            <div className="bg-zinc-950/90 border border-amber-900/60 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Agent ID:</span>
                <code className="text-zinc-200 font-mono select-all font-semibold">
                  {newlyRegistered.agent.id}
                </code>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-900">
                <span className="text-zinc-400">Agent Credential:</span>
                <div className="flex items-center gap-2">
                  <code className="text-amber-300 font-mono select-all break-all bg-zinc-900 px-2 py-1 rounded">
                    {newlyRegistered.credential}
                  </code>
                  <button
                    onClick={() => copyCredentialToClipboard(newlyRegistered.credential)}
                    className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-black font-semibold rounded transition"
                  >
                    {copiedCredential ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Filter:</span>
            {(["ALL", "ACTIVE", "REVOKED"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filterStatus === tab
                    ? "bg-zinc-800 text-white border border-zinc-700"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {tab === "ALL" ? "All Agents" : tab}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-sm transition"
          >
            <span>+ Register Computer Agent</span>
          </button>
        </div>

        {/* Main Grid: Agents List & Active Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Registered Agents List */}
          <section className="lg:col-span-5 space-y-3" aria-label="Registered Agents List">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider px-1">
              Registered Devices ({agents.length})
            </h2>

            {loading ? (
              <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center text-zinc-400 text-sm">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200 mb-2" />
                <p>Loading computer agents...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center space-y-3">
                <p className="text-sm text-zinc-400">No computer agents found.</p>
                <p className="text-xs text-zinc-500">
                  Register your first local agent to enable secure desktop integration with BrainOS.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
                >
                  Register Agent
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {agents.map((agent) => {
                  const isSelected = agent.id === selectedAgentId;
                  const isActive = agent.status === "ACTIVE";

                  return (
                    <div
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`cursor-pointer rounded-xl p-4 transition border ${
                        isSelected
                          ? "bg-zinc-900/90 border-zinc-600 shadow-md ring-1 ring-zinc-600/40"
                          : "bg-zinc-900/40 border-zinc-800/70 hover:bg-zinc-900/70 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                isActive ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            <h3 className="text-sm font-semibold text-white truncate">
                              {agent.name}
                            </h3>
                          </div>
                          <p className="text-xs font-mono text-zinc-400 truncate">
                            ID: {agent.id}
                          </p>
                        </div>

                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                            isActive
                              ? "bg-emerald-950/60 border-emerald-800/70 text-emerald-300"
                              : "bg-red-950/60 border-red-800/70 text-red-300"
                          }`}
                        >
                          {agent.status}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>
                          Created: {new Date(agent.createdAt).toLocaleDateString()}
                        </span>
                        <span>
                          {agent.lastAuthenticatedAt
                            ? `Active ${new Date(agent.lastAuthenticatedAt).toLocaleDateString()}`
                            : "Never authenticated"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Column: Agent Details & Permission Management */}
          <section className="lg:col-span-7 space-y-6" aria-label="Agent Details and Permissions">
            {selectedAgent ? (
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-6 space-y-6 shadow-xl">
                {/* Agent Header & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-white">
                        {selectedAgent.name}
                      </h2>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          selectedAgent.status === "ACTIVE"
                            ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
                            : "bg-red-950/70 border-red-800 text-red-300"
                        }`}
                      >
                        {selectedAgent.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-zinc-400">
                      Agent ID: {selectedAgent.id}
                    </p>
                  </div>

                  {/* Revoke / Delete Actions */}
                  <div className="flex items-center gap-2">
                    {selectedAgent.status === "ACTIVE" ? (
                      confirmRevokeId === selectedAgent.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleRevokeAgent(selectedAgent.id)}
                            disabled={actionInProgress === selectedAgent.id}
                            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition"
                          >
                            Confirm Revoke
                          </button>
                          <button
                            onClick={() => setConfirmRevokeId(null)}
                            className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRevokeId(selectedAgent.id)}
                          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-red-950/60 text-zinc-300 hover:text-red-300 border border-zinc-700/60 hover:border-red-800/60 rounded-lg transition font-medium"
                        >
                          Revoke Agent
                        </button>
                      )
                    ) : null}

                    {confirmDeleteId === selectedAgent.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDeleteAgent(selectedAgent.id)}
                          disabled={actionInProgress === selectedAgent.id}
                          className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(selectedAgent.id)}
                        className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 border border-zinc-700/60 rounded-lg transition font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* System & Metadata Information */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-950/60 rounded-lg p-3.5 border border-zinc-800/60 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Registered:</span>
                    <span className="text-zinc-300 font-medium">
                      {new Date(selectedAgent.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Last Active:</span>
                    <span className="text-zinc-300 font-medium">
                      {selectedAgent.lastAuthenticatedAt
                        ? new Date(selectedAgent.lastAuthenticatedAt).toLocaleString()
                        : "Never"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Revoked At:</span>
                    <span className="text-zinc-300 font-medium">
                      {selectedAgent.revokedAt
                        ? new Date(selectedAgent.revokedAt).toLocaleString()
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Privileged Action Permissions Section */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Action Authorization Policy
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Privileged actions require explicit database authorization before BrainOS Assistant or Voice can execute them.
                    </p>
                  </div>

                  {selectedAgent.status !== "ACTIVE" ? (
                    <div className="rounded-lg bg-red-950/40 border border-red-900/60 p-4 text-xs text-red-300">
                      This agent is REVOKED. In accordance with BrainOS security invariants, all privileged and active actions are automatically rejected and fail-closed.
                    </div>
                  ) : loadingPermissions ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      Loading permissions...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {RECOGNIZED_PRIVILEGED_ACTIONS.map((priv) => {
                        const isGranted = permissions.some(
                          (p) => p.action === priv.action,
                        );
                        const isToggling = permissionToggling === priv.action;

                        return (
                          <div
                            key={priv.action}
                            className={`rounded-lg border p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isGranted
                                ? "bg-zinc-900/80 border-zinc-700"
                                : "bg-zinc-950/40 border-zinc-850 opacity-80 hover:opacity-100"
                            }`}
                          >
                            <div className="space-y-1 max-w-md">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold text-zinc-200">
                                  {priv.name}
                                </h4>
                                <code className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                                  {priv.action}
                                </code>
                              </div>
                              <p className="text-[11px] text-zinc-400">
                                {priv.description}
                              </p>
                            </div>

                            <button
                              onClick={() => handleTogglePermission(priv.action)}
                              disabled={isToggling}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                isGranted
                                  ? "bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/80"
                                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60"
                              }`}
                            >
                              {isToggling
                                ? "Updating..."
                                : isGranted
                                  ? "Authorized (Click to Revoke)"
                                  : "Grant Permission"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Safe Read-Only Capabilities Information */}
                <div className="pt-4 border-t border-zinc-800/60 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Safe Read-Only Capabilities (Always Authorized)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SAFE_READ_ONLY_ACTIONS.map((safe) => (
                      <div
                        key={safe.action}
                        className="rounded-lg bg-zinc-950/50 border border-zinc-800/60 p-2.5 text-xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-300">
                            {safe.name}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-medium">
                            Policy OK
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          {safe.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-12 text-center text-zinc-400 text-sm">
                Select an agent from the list to inspect status and manage authorization permissions.
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Registration Modal Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-white">
                Register Computer Agent
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Agent Device Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Work Laptop, Studio PC"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Custom Agent ID (Optional)
                </label>
                <input
                  type="text"
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  placeholder="e.g. local-my-laptop (leave blank for auto-generation)"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono text-xs"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newAgentName.trim()}
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition disabled:opacity-50"
                >
                  {creating ? "Registering..." : "Register Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
