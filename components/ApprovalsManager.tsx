"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  name: string;
  workspace_id: string;
};

type Approval = {
  id: string;
  client_id: string;
  action_type: string;
  description: string | null;
  payload: Record<string, any> | null;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  reviewed_by: string | null;
  created_at: string;
};

const ACTION_TYPES = [
  "Social Media Post",
  "Email",
  "Freelance Proposal",
  "Automation",
  "Other",
];

export default function ApprovalsManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [adminWorkspaceIds, setAdminWorkspaceIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState("Social Media Post");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    try {
      // CURRENT USER

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!userData.user) {
        throw new Error("Login session nahi mila.");
      }

      setCurrentUserId(userData.user.id);

      // LOAD CLIENTS

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name, workspace_id")
        .order("name");

      if (clientError) throw clientError;

      const loadedClients = (clientData || []) as Client[];
      setClients(loadedClients);

      // CHECK ADMIN ACCESS

      const workspaceIds = [
        ...new Set(loadedClients.map((client) => client.workspace_id)),
      ];

      const adminResults = await Promise.all(
        workspaceIds.map(async (workspaceId) => {
          const { data, error } = await supabase.rpc(
            "is_workspace_admin",
            {
              check_workspace_id: workspaceId,
            }
          );

          if (error) {
            console.error("Workspace role check failed:", error);
            return null;
          }

          return data === true ? workspaceId : null;
        })
      );

      setAdminWorkspaceIds(
        adminResults.filter((id): id is string => id !== null)
      );

      // LOAD APPROVAL HISTORY

      const { data: approvalData, error: approvalError } = await supabase
        .from("approvals")
        .select("*")
        .order("created_at", { ascending: false });

      if (approvalError) throw approvalError;

      setApprovals((approvalData || []) as Approval[]);
    } catch (error) {
      alert(
        "Data load nahi hua: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  // CHECK ADMIN ACCESS

  function canReview(item: Approval) {
    const client = clients.find((c) => c.id === item.client_id);

    if (!client) return false;

    return adminWorkspaceIds.includes(client.workspace_id);
  }

  // PREVENT SELF REVIEW

  function canReviewRequest(item: Approval) {
    if (!currentUserId) return false;

    if (item.requested_by === currentUserId) {
      return false;
    }

    return canReview(item);
  }

  // CREATE APPROVAL

  async function createApproval(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!clientId) {
      alert("Pehle client select karo.");
      return;
    }

    if (!title.trim()) {
      alert("Approval title enter karo.");
      return;
    }

    if (!ACTION_TYPES.includes(actionType)) {
      alert("Invalid Action Type.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("Login session nahi mila.");
      }

      const { error } = await supabase.from("approvals").insert({
        client_id: clientId,
        action_type: actionType,
        description: description.trim(),
        payload: {
          title: title.trim(),
        },
        status: "pending",
        requested_by: userData.user.id,
        reviewed_by: null,
      });

      if (error) throw error;

      alert("Approval request successfully create ho gayi.");

      setTitle("");
      setDescription("");
      setClientId("");
      setActionType("Social Media Post");

      await loadData();
    } catch (error) {
      alert(
        "Approval create nahi hua: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setSaving(false);
    }
  }

  // UPDATE STATUS

  async function updateStatus(
    item: Approval,
    status: "approved" | "rejected",
    decisionNote: string
  ) {
    if (!canReviewRequest(item)) {
      alert("Apni request ko approve ya reject nahi kar sakte.");
      return;
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Login session nahi mila.");
      return;
    }

    const { error } = await supabase
      .from("approvals")
      .update({
        status,
        reviewed_by: userData.user.id,
        payload: {
          ...(item.payload || {}),
          decision_note: decisionNote,
        },
      })
      .eq("id", item.id);

    if (error) {
      alert("Approval update nahi hua: " + error.message);
    } else {
      await loadData();
    }
  }

  // EDIT AND APPROVE

  async function editAndApprove(item: Approval) {
    if (!canReviewRequest(item)) {
      alert("Apni request ko approve nahi kar sakte.");
      return;
    }

    const updatedTitle = prompt(
      "Approval title:",
      item.payload?.title || ""
    );

    if (updatedTitle === null || !updatedTitle.trim()) return;

    const updatedDescription = prompt(
      "Description:",
      item.description || ""
    );

    if (updatedDescription === null) return;

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Login session nahi mila.");
      return;
    }

    const { error } = await supabase
      .from("approvals")
      .update({
        description: updatedDescription.trim(),
        payload: {
          ...(item.payload || {}),
          title: updatedTitle.trim(),
          decision_note: "Edited and approved",
        },
        status: "approved",
        reviewed_by: userData.user.id,
      })
      .eq("id", item.id);

    if (error) {
      alert("Edit & Approve failed: " + error.message);
    } else {
      await loadData();
    }
  }

  // STATISTICS

  const pendingCount = approvals.filter(
    (item) => item.status === "pending"
  ).length;

  const approvedCount = approvals.filter(
    (item) => item.status === "approved"
  ).length;

  const rejectedCount = approvals.filter(
    (item) => item.status === "rejected"
  ).length;

  const filteredApprovals =
    filter === "All"
      ? approvals
      : approvals.filter(
          (item) => item.status === filter.toLowerCase()
        );

  // CLIENT NAME

  function getClientName(id: string) {
    return (
      clients.find((client) => client.id === id)?.name ||
      "Unknown Client"
    );
  }

  // STATUS STYLE

  function statusStyle(status: string) {
    if (status === "approved") {
      return "bg-green-100 text-green-700";
    }

    if (status === "rejected") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Approval Management
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Review AI actions before execution.
          </p>
        </div>

        <button
          onClick={loadData}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Pending</p>
          <h3 className="mt-2 text-3xl font-bold text-yellow-600">
            {pendingCount}
          </h3>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved</p>
          <h3 className="mt-2 text-3xl font-bold text-green-600">
            {approvedCount}
          </h3>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Rejected</p>
          <h3 className="mt-2 text-3xl font-bold text-red-600">
            {rejectedCount}
          </h3>
        </div>

      </div>

      {/* CREATE REQUEST */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">

        <h3 className="mb-4 text-lg font-bold">
          Create Approval Request
        </h3>

        <form onSubmit={createApproval} className="space-y-4">

          <div>
            <label className="mb-1 block text-sm font-medium">
              Select Client
            </label>

            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              required
            >
              <option value="">Select Client</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Action Title
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Publish Instagram Reel"
              className="w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Action Type
            </label>

            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              required
            >
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Action details..."
              rows={3}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={saving || clients.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Request"}
          </button>

        </form>
      </section>

      {/* APPROVAL HISTORY */}

      <section className="rounded-xl border bg-white p-6 shadow-sm">

        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-lg font-bold">
            Approval Requests & History
          </h3>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
        </div>

        {loading ? (
          <p className="py-8 text-center text-gray-500">
            Loading approvals...
          </p>
        ) : filteredApprovals.length === 0 ? (
          <div className="rounded-lg bg-gray-50 py-10 text-center">
            <p className="font-medium text-gray-700">
              No approval requests found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">

            {filteredApprovals.map((item) => (

              <div
                key={item.id}
                className="rounded-xl border p-4"
              >

                <div className="flex flex-col justify-between gap-3 sm:flex-row">

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h4 className="font-semibold text-gray-900">
                        {item.payload?.title || item.action_type}
                      </h4>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(
                          item.status
                        )}`}
                      >
                        {item.status.toUpperCase()}
                      </span>

                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      {item.description || "No description provided."}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>
                        Client: {getClientName(item.client_id)}
                      </span>

                      <span>
                        Type: {item.action_type}
                      </span>

                      <span>
                        Requested:{" "}
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : "Unknown"}
                      </span>
                    </div>

                    {item.reviewed_by && (
                      <p className="mt-2 text-xs text-gray-500">
                        Reviewed by user ID: {item.reviewed_by}
                      </p>
                    )}

                    {item.payload?.decision_note && (
                      <p className="mt-2 text-xs text-gray-500">
                        Decision: {item.payload.decision_note}
                      </p>
                    )}

                  </div>

                  {/* REVIEW BUTTONS: OTHER USER'S REQUESTS ONLY */}

                  {item.status === "pending" && canReviewRequest(item) && (

                    <div className="flex flex-wrap items-start gap-2">

                      <button
                        onClick={() =>
                          updateStatus(item, "approved", "Approved")
                        }
                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => editAndApprove(item)}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Edit & Approve
                      </button>

                      <button
                        onClick={() => {
                          const note = prompt("Rejection reason:");

                          if (note !== null) {
                            updateStatus(item, "rejected", note);
                          }
                        }}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Reject
                      </button>

                    </div>

                  )}

                  {/* OWN REQUEST */}

                  {item.status === "pending" &&
                    item.requested_by === currentUserId && (
                      <span className="self-start rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        Awaiting another Admin's Review
                      </span>
                    )}

                  {/* MEMBER REQUEST */}

                  {item.status === "pending" &&
                    item.requested_by !== currentUserId &&
                    !canReview(item) && (
                      <span className="self-start rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
                        Awaiting Admin Review
                      </span>
                    )}

                </div>

              </div>

            ))}

          </div>
        )}

      </section>

      <p className="text-xs text-gray-400">
        Approval status change karne se email, social post ya automation
        automatically execute nahi hota. Actual execution ke liye
        separate backend authorization aur integration required hai.
      </p>

    </div>
  );
}