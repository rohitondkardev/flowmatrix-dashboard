"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import ProjectsManager from "@/components/ProjectsManager";
import LeadsManager from "@/components/LeadsManager";
import ApprovalsManager from "@/components/ApprovalsManager";
import NotificationsManager from "@/components/NotificationsManager";
import ReportsManager from "@/components/ReportsManager";
import TeamManager from "@/components/TeamManager";
import SettingsManager from "@/components/SettingsManager";

type ClientStatus = "Active" | "Pending" | "Inactive";

type Client = {
  id: string;
  name: string;
  email: string;
  project: string;
  projectId: string | null;
  status: ClientStatus;
};

type ClientForm = {
  name: string;
  email: string;
  project: string;
  status: ClientStatus;
};

const WORKSPACE_ID = "4548e6ca-9cb5-444f-8250-18fc155d935e";

const emptyForm: ClientForm = {
  name: "",
  email: "",
  project: "",
  status: "Active",
};

const navigation = [
  "Overview",
  "Clients",
  "Projects",
  "Leads",
  "Approvals",
  "Notifications",
  "Reports",
  "Team",
  "Settings",
];

function formatStatus(status: string | null): ClientStatus {
  const value = (status || "active").toLowerCase();

  if (value === "pending") return "Pending";
  if (value === "inactive") return "Inactive";

  return "Active";
}

export default function Home() {
  const router = useRouter();

  const [active, setActive] = useState("Overview");
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const [isWorkspaceAdmin, setIsWorkspaceAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // LOGOUT

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error: logoutError } = await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to logout. Please try again."
      );

      setLoggingOut(false);
    }
  }

  // LOAD USER ROLE

  async function loadUserRole() {
    setRoleLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setIsWorkspaceAdmin(false);
        return;
      }

      const { data, error: roleError } = await supabase.rpc(
        "is_workspace_admin",
        {
          check_workspace_id: WORKSPACE_ID,
        }
      );

      if (roleError) throw roleError;

      setIsWorkspaceAdmin(data === true);
    } catch (err) {
      console.error("Role loading error:", err);
      setIsWorkspaceAdmin(false);
    } finally {
      setRoleLoading(false);
    }
  }

  // LOAD CLIENTS

  async function loadClients() {
    setLoading(true);
    setError("");

    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name, email, status")
        .eq("workspace_id", WORKSPACE_ID)
        .order("created_at", { ascending: false });

      if (clientError) throw clientError;

      const loadedClients = clientData || [];

      if (loadedClients.length === 0) {
        setClients([]);
        return;
      }

      const clientIds = loadedClients.map((client) => client.id);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, client_id, name")
        .in("client_id", clientIds)
        .order("created_at", { ascending: true });

      if (projectError) throw projectError;

      const loadedProjects = projectData || [];

      const formattedClients: Client[] = loadedClients.map((client) => {
        const project = loadedProjects.find(
          (item) => item.client_id === client.id
        );

        return {
          id: client.id,
          name: client.name,
          email: client.email || "",
          project: project?.name || "",
          projectId: project?.id || null,
          status: formatStatus(client.status),
        };
      });

      setClients(formattedClients);
    } catch (err) {
      console.error("Load clients error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load clients."
      );
    } finally {
      setLoading(false);
    }
  }

  // LOAD DATA WHEN PAGE OPENS

  useEffect(() => {
    loadUserRole();
    loadClients();
  }, []);

  // SAVE CLIENT

  async function saveClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isWorkspaceAdmin) {
      setError("You do not have permission to manage clients.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const clientPayload = {
        name: form.name.trim(),
        email: form.email.trim(),
        status: form.status.toLowerCase(),
      };

      let clientId = editId;

      if (editId) {
        const { error: updateError } = await supabase
          .from("clients")
          .update(clientPayload)
          .eq("id", editId)
          .eq("workspace_id", WORKSPACE_ID);

        if (updateError) throw updateError;
      } else {
        const { data: newClient, error: insertError } = await supabase
          .from("clients")
          .insert({
            ...clientPayload,
            workspace_id: WORKSPACE_ID,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        clientId = newClient.id;
      }

      if (!clientId) {
        throw new Error("Client ID was not found.");
      }

      // SAVE OR UPDATE PROJECT

      const existingClient = clients.find(
        (client) => client.id === clientId
      );

      const projectName = form.project.trim();

      if (projectName) {
        if (existingClient?.projectId) {
          const { error: projectUpdateError } = await supabase
            .from("projects")
            .update({
              name: projectName,
              status: form.status.toLowerCase(),
            })
            .eq("id", existingClient.projectId)
            .eq("client_id", clientId);

          if (projectUpdateError) throw projectUpdateError;
        } else {
          const { error: projectInsertError } = await supabase
            .from("projects")
            .insert({
              client_id: clientId,
              name: projectName,
              status: form.status.toLowerCase(),
            });

          if (projectInsertError) throw projectInsertError;
        }
      }

      closeForm();
      await loadClients();
    } catch (err) {
      console.error("Save client error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save client."
      );
    } finally {
      setSaving(false);
    }
  }

  // ADD CLIENT

  function addClient() {
    if (!isWorkspaceAdmin) return;

    setEditId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  // EDIT CLIENT

  function editClient(client: Client) {
    if (!isWorkspaceAdmin) return;

    setEditId(client.id);

    setForm({
      name: client.name,
      email: client.email,
      project: client.project,
      status: client.status,
    });

    setError("");
    setShowForm(true);
  }

  // CLOSE FORM

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setError("");
  }

  // DELETE CLIENT

  async function deleteClient(id: string) {
    if (!isWorkspaceAdmin) {
      setError("You do not have permission to delete clients.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this client?"
    );

    if (!confirmed) return;

    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("clients")
        .delete()
        .eq("id", id)
        .eq("workspace_id", WORKSPACE_ID);

      if (deleteError) throw deleteError;

      setClients((previous) =>
        previous.filter((client) => client.id !== id)
      );
    } catch (err) {
      console.error("Delete client error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete client."
      );
    }
  }

  // SEARCH CLIENTS

  const filteredClients = clients.filter((client) => {
    const text = [
      client.name,
      client.email,
      client.project,
      client.status,
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  // CLIENT STATISTICS

  const activeClients = clients.filter(
    (client) => client.status === "Active"
  ).length;

  const pendingClients = clients.filter(
    (client) => client.status === "Pending"
  ).length;

  const inactiveClients = clients.filter(
    (client) => client.status === "Inactive"
  ).length;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 md:flex">

      {/* SIDEBAR */}

      <aside className="w-full bg-gray-900 p-5 text-white md:flex md:w-64 md:flex-col">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-400">
            FlowMatrix.
          </h1>

          <p className="mt-1 text-xs text-gray-400">
            Client Management Platform
          </p>
        </div>

        <p className="mb-3 text-xs uppercase tracking-widest text-gray-500">
          Workspace
        </p>

        <nav className="grid grid-cols-2 gap-2 md:flex md:flex-col">

          {navigation.map((item) => (
            <button
              key={item}
              onClick={() => {
                setActive(item);
                setShowForm(false);
                setError("");
              }}
              className={`rounded-lg px-4 py-3 text-left text-sm transition ${
                active === item
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {item}
            </button>
          ))}

        </nav>

        <div className="mt-8 border-t border-gray-700 pt-5 md:mt-auto">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">
              R
            </div>

            <div>
              <p className="text-sm font-medium">
                {roleLoading
                  ? "Loading..."
                  : isWorkspaceAdmin
                  ? "Admin"
                  : "Member"}
              </p>

              <p className="text-xs text-gray-400">
                {roleLoading
                  ? "Checking role..."
                  : isWorkspaceAdmin
                  ? "Workspace Administrator"
                  : "Workspace Member"}
              </p>
            </div>

          </div>

          {/* LOGOUT */}

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-5 w-full rounded-lg border border-red-500/40 px-4 py-3 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <main className="min-w-0 flex-1 p-5 md:p-8">

        {/* HEADER */}

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">

          <div>
            <h2 className="text-2xl font-bold">
              {active}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Manage your business workspace.
            </p>
          </div>

          <div className="text-sm text-gray-500">
            FlowMatrix Workspace
          </div>

        </header>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* OVERVIEW */}

        {active === "Overview" && (

          <section>

            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

              {[
                {
                  title: "Total Clients",
                  value: clients.length,
                },
                {
                  title: "Active Clients",
                  value: activeClients,
                },
                {
                  title: "Pending Clients",
                  value: pendingClients,
                },
                {
                  title: "Inactive Clients",
                  value: inactiveClients,
                },
              ].map((item) => (

                <div
                  key={item.title}
                  className="rounded-xl border bg-white p-6 shadow-sm"
                >

                  <p className="text-sm text-gray-500">
                    {item.title}
                  </p>

                  <h3 className="mt-3 text-3xl font-bold">
                    {loading ? "..." : item.value}
                  </h3>

                </div>

              ))}

            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">

              <h3 className="text-lg font-bold">
                Welcome to FlowMatrix
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Your business management workspace is ready.
              </p>

              <button
                onClick={() => setActive("Clients")}
                className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm text-white hover:bg-blue-700"
              >
                Manage Clients →
              </button>

            </div>

          </section>

        )}

        {/* CLIENT MANAGEMENT */}

        {active === "Clients" && (

          <section className="rounded-xl border bg-white p-5 shadow-sm md:p-6">

            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row">

              <div>
                <h3 className="text-lg font-bold">
                  All Clients
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Manage your client information.
                </p>
              </div>

              {!roleLoading && isWorkspaceAdmin && (
                <button
                  onClick={addClient}
                  className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + Add Client
                </button>
              )}

            </div>

            {!roleLoading && !isWorkspaceAdmin && (
              <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                You have view-only access to client information.
              </div>
            )}

            <input
              type="text"
              placeholder="Search by name, email or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-6 w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            {showForm && isWorkspaceAdmin && (

              <form
                onSubmit={saveClient}
                className="mb-6 rounded-xl border bg-gray-50 p-5"
              >

                <h3 className="mb-5 text-lg font-bold">
                  {editId !== null
                    ? "Edit Client"
                    : "Add New Client"}
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <input
                    required
                    type="text"
                    placeholder="Client Name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                      })
                    }
                    className="rounded-lg border p-3"
                  />

                  <input
                    required
                    type="email"
                    placeholder="Email Address"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: e.target.value,
                      })
                    }
                    className="rounded-lg border p-3"
                  />

                  <input
                    required
                    type="text"
                    placeholder="Project Name"
                    value={form.project}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        project: e.target.value,
                      })
                    }
                    className="rounded-lg border p-3"
                  />

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as ClientStatus,
                      })
                    }
                    className="rounded-lg border p-3"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>

                </div>

                <div className="mt-5 flex gap-3">

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Saving..."
                      : editId !== null
                      ? "Update Client"
                      : "Save Client"}
                  </button>

                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="rounded-lg border px-5 py-3 text-sm disabled:opacity-60"
                  >
                    Cancel
                  </button>

                </div>

              </form>

            )}

            <div className="overflow-x-auto">

              <table className="w-full min-w-[650px] text-left">

                <thead>

                  <tr className="border-b text-xs text-gray-500">

                    <th className="p-4">CLIENT</th>
                    <th className="p-4">EMAIL</th>
                    <th className="p-4">PROJECT</th>
                    <th className="p-4">STATUS</th>

                    {isWorkspaceAdmin && (
                      <th className="p-4">ACTIONS</th>
                    )}

                  </tr>

                </thead>

                <tbody>

                  {loading || roleLoading ? (

                    <tr>
                      <td
                        colSpan={isWorkspaceAdmin ? 5 : 4}
                        className="py-10 text-center text-sm text-gray-500"
                      >
                        Loading clients...
                      </td>
                    </tr>

                  ) : (

                    filteredClients.map((client) => (

                      <tr
                        key={client.id}
                        className="border-b last:border-0 hover:bg-gray-50"
                      >

                        <td className="p-4 text-sm font-medium">
                          {client.name}
                        </td>

                        <td className="p-4 text-sm text-gray-500">
                          {client.email}
                        </td>

                        <td className="p-4 text-sm">
                          {client.project || "No project"}
                        </td>

                        <td className="p-4">

                          <span
                            className={`rounded-full px-3 py-1 text-xs ${
                              client.status === "Active"
                                ? "bg-green-100 text-green-700"
                                : client.status === "Pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {client.status}
                          </span>

                        </td>

                        {isWorkspaceAdmin && (
                          <td className="p-4">

                            <div className="flex gap-3">

                              <button
                                onClick={() => editClient(client)}
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => deleteClient(client.id)}
                                className="text-sm text-red-600 hover:underline"
                              >
                                Delete
                              </button>

                            </div>

                          </td>
                        )}

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

              {!loading && !roleLoading && filteredClients.length === 0 && (

                <p className="py-10 text-center text-sm text-gray-500">
                  No clients found.
                </p>

              )}

            </div>

            <div className="mt-5 text-sm text-gray-500">
              Showing {filteredClients.length} of {clients.length} clients
            </div>

          </section>

        )}

        {/* PROJECTS MODULE */}

        {active === "Projects" && <ProjectsManager />}

        {/* LEADS MODULE */}

        {active === "Leads" && <LeadsManager />}

        {/* APPROVALS MODULE */}

        {active === "Approvals" && <ApprovalsManager />}

        {/* NOTIFICATIONS MODULE */}

        {active === "Notifications" && <NotificationsManager />}

        {/* REPORTS MODULE */}

        {active === "Reports" && <ReportsManager />}

        {/* TEAM MODULE */}

        {active === "Team" && <TeamManager />}

        {/* SETTINGS MODULE */}

        {active === "Settings" && <SettingsManager />}

        {/* FOOTER */}

        <footer className="mt-10 text-center text-xs text-gray-400">
          © 2026 FlowMatrix. All rights reserved.
        </footer>

      </main>

    </div>
  );
}