"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type ProjectStatus = "Active" | "Pending" | "Completed";

type Client = {
  id: string;
  name: string;
};

type Project = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  clientName: string;
};

type ProjectsManagerProps = {
  canManage: boolean;
  canDelete: boolean;
  roleLoading: boolean;
};

const WORKSPACE_ID = "4548e6ca-9cb5-444f-8250-18fc155d935e";

const emptyForm = {
  client_id: "",
  name: "",
  description: "",
  status: "Active" as ProjectStatus,
};

function formatStatus(status: string | null): ProjectStatus {
  const value = (status || "active").toLowerCase();

  if (value === "pending") return "Pending";
  if (value === "completed") return "Completed";

  return "Active";
}

export default function ProjectsManager({
  canManage,
  canDelete,
  roleLoading,
}: ProjectsManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadProjects() {
    setLoading(true);
    setError("");

    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .eq("workspace_id", WORKSPACE_ID);

      if (clientError) throw clientError;

      const clientList = clientData || [];
      setClients(clientList);

      if (clientList.length === 0) {
        setProjects([]);
        return;
      }

      const clientIds = clientList.map((client) => client.id);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("id, client_id, name, description, status")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });

      if (projectError) throw projectError;

      const formattedProjects: Project[] = (projectData || []).map(
        (project) => {
          const linkedClient = clientList.find(
            (client) => client.id === project.client_id
          );

          return {
            id: project.id,
            client_id: project.client_id,
            name: project.name,
            description: project.description || "",
            status: formatStatus(project.status),
            clientName: linkedClient?.name || "Unknown Client",
          };
        }
      );

      setProjects(formattedProjects);
    } catch (err) {
      console.error("Projects loading error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to load projects."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  function openAddForm() {
    if (!canManage || roleLoading) return;

    setEditId(null);
    setForm({
      ...emptyForm,
      client_id: clients[0]?.id || "",
    });
    setError("");
    setShowForm(true);
  }

  function openEditForm(project: Project) {
    if (!canManage || roleLoading) return;

    setEditId(project.id);

    setForm({
      client_id: project.client_id,
      name: project.name,
      description: project.description,
      status: project.status,
    });

    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setError("");
  }

  async function saveProject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canManage || roleLoading) {
      setError("You do not have permission to manage projects.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (!form.client_id) {
        throw new Error("Please select a client.");
      }

      if (!form.name.trim()) {
        throw new Error("Project name is required.");
      }

      const validClient = clients.some(
        (client) => client.id === form.client_id
      );

      if (!validClient) {
        throw new Error("Invalid client selected.");
      }

      const payload = {
        client_id: form.client_id,
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status.toLowerCase(),
      };

      if (editId) {
        const { error: updateError } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", editId)
          .eq("client_id", form.client_id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("projects")
          .insert(payload);

        if (insertError) throw insertError;
      }

      closeForm();
      await loadProjects();
    } catch (err) {
      console.error("Save project error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to save project."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(project: Project) {
    if (!canDelete || roleLoading) {
      setError("Only the workspace owner can delete projects.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?`
    );

    if (!confirmed) return;

    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id)
        .eq("client_id", project.client_id);

      if (deleteError) throw deleteError;

      setProjects((previous) =>
        previous.filter((item) => item.id !== project.id)
      );
    } catch (err) {
      console.error("Delete project error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to delete project."
      );
    }
  }

  const filteredProjects = projects.filter((project) => {
    const text = [
      project.name,
      project.clientName,
      project.description,
      project.status,
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  const activeCount = projects.filter(
    (project) => project.status === "Active"
  ).length;

  const pendingCount = projects.filter(
    (project) => project.status === "Pending"
  ).length;

  const completedCount = projects.filter(
    (project) => project.status === "Completed"
  ).length;

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm md:p-6">
      {/* HEADER */}

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <h3 className="text-lg font-bold">All Projects</h3>

          <p className="mt-1 text-sm text-gray-500">
            Manage projects and link them with your clients.
          </p>
        </div>

        {!roleLoading && canManage && (
          <button
            onClick={openAddForm}
            disabled={clients.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Project
          </button>
        )}
      </div>

      {/* VIEW ONLY MESSAGE */}

      {!roleLoading && !canManage && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          You have view-only access to project information.
        </div>
      )}

      {/* STATISTICS */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: "Active Projects", value: activeCount },
          { title: "Pending Projects", value: pendingCount },
          { title: "Completed Projects", value: completedCount },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border bg-gray-50 p-5"
          >
            <p className="text-sm text-gray-500">{item.title}</p>
            <h3 className="mt-2 text-2xl font-bold">{item.value}</h3>
          </div>
        ))}
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SEARCH */}

      <input
        type="text"
        placeholder="Search projects or clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-blue-500"
      />

      {/* FORM */}

      {showForm && canManage && !roleLoading && (
        <form
          onSubmit={saveProject}
          className="mb-6 rounded-xl border bg-gray-50 p-5"
        >
          <h3 className="mb-5 text-lg font-bold">
            {editId ? "Edit Project" : "Add New Project"}
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              required
              type="text"
              placeholder="Project Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <select
              required
              value={form.client_id}
              onChange={(e) =>
                setForm({ ...form, client_id: e.target.value })
              }
              className="rounded-lg border p-3"
            >
              <option value="">Select Client</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>

            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as ProjectStatus,
                })
              }
              className="rounded-lg border p-3"
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>

            <input
              type="text"
              placeholder="Project Description (Optional)"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="rounded-lg border p-3"
            />
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editId
                ? "Update Project"
                : "Save Project"}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border px-5 py-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* PROJECT TABLE */}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="p-4">PROJECT</th>
              <th className="p-4">CLIENT</th>
              <th className="p-4">DESCRIPTION</th>
              <th className="p-4">STATUS</th>

              {canManage && !roleLoading && (
                <th className="p-4">ACTIONS</th>
              )}
            </tr>
          </thead>

          <tbody>
            {loading || roleLoading ? (
              <tr>
                <td
                  colSpan={canManage ? 5 : 4}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  Loading projects...
                </td>
              </tr>
            ) : (
              filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="p-4 text-sm font-medium">
                    {project.name}
                  </td>

                  <td className="p-4 text-sm text-gray-500">
                    {project.clientName}
                  </td>

                  <td className="p-4 text-sm">
                    {project.description || "—"}
                  </td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        project.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : project.status === "Pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {project.status}
                    </span>
                  </td>

                  {canManage && !roleLoading && (
                    <td className="p-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => openEditForm(project)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => deleteProject(project)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {!loading && !roleLoading && filteredProjects.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500">
            No projects found.
          </p>
        )}
      </div>

      <div className="mt-5 text-sm text-gray-500">
        Showing {filteredProjects.length} of {projects.length} projects
      </div>
    </section>
  );
}