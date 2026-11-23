"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";

const WORKSPACE_ID = "4548e6ca-9cb5-444f-8250-18fc155d935e";

type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

type Client = {
  id: string;
  name: string;
};

type Lead = {
  id: string;
  client_id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  city: string;
  category: string;
  source: string;
  source_url: string;
  status: LeadStatus;
  notes: string;
  created_at: string;
};

type LeadForm = {
  client_id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  city: string;
  category: string;
  source: string;
  source_url: string;
  status: LeadStatus;
  notes: string;
};

const emptyForm: LeadForm = {
  client_id: "",
  name: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  city: "",
  category: "",
  source: "",
  source_url: "",
  status: "new",
  notes: "",
};

const statuses: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
];

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function LeadsManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const [form, setForm] = useState<LeadForm>(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, name")
        .eq("workspace_id", WORKSPACE_ID)
        .order("created_at", { ascending: false });

      if (clientError) throw clientError;

      const loadedClients = clientData || [];
      setClients(loadedClients);

      if (loadedClients.length === 0) {
        setLeads([]);
        return;
      }

      const clientIds = loadedClients.map((client) => client.id);

      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select(
          "id, client_id, name, email, phone, company, website, city, category, source, source_url, status, notes, created_at"
        )
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });

      if (leadError) throw leadError;

      setLeads(
        (leadData || []).map((lead) => ({
          ...lead,
          name: lead.name || "",
          email: lead.email || "",
          phone: lead.phone || "",
          company: lead.company || "",
          website: lead.website || "",
          city: lead.city || "",
          category: lead.category || "",
          source: lead.source || "",
          source_url: lead.source_url || "",
          status: (lead.status || "new") as LeadStatus,
          notes: lead.notes || "",
        }))
      );
    } catch (err) {
      console.error("Load leads error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to load leads."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openAddForm() {
    setEditId(null);

    setForm({
      ...emptyForm,
      client_id: clients[0]?.id || "",
    });

    setError("");
    setShowForm(true);
  }

  function openEditForm(lead: Lead) {
    setEditId(lead.id);

    setForm({
      client_id: lead.client_id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      website: lead.website,
      city: lead.city,
      category: lead.category,
      source: lead.source,
      source_url: lead.source_url,
      status: lead.status,
      notes: lead.notes,
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

  async function saveLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.client_id) {
      setError("Please select a client.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        client_id: form.client_id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        website: form.website.trim(),
        city: form.city.trim(),
        category: form.category.trim(),
        source: form.source.trim(),
        source_url: form.source_url.trim(),
        status: form.status,
        notes: form.notes.trim(),
      };

      if (editId) {
        const { data, error: updateError } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", editId)
          .select("id")
          .maybeSingle();

        if (updateError) throw updateError;

        if (!data) {
          throw new Error(
            "Lead update nahi hua. Supabase RLS permission check karni hogi."
          );
        }
      } else {
        const { error: insertError } = await supabase
          .from("leads")
          .insert(payload);

        if (insertError) throw insertError;
      }

      await loadData();
      closeForm();
    } catch (err) {
      console.error("Save lead error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to save lead."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this lead?"
    );

    if (!confirmed) return;

    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      setLeads((previous) =>
        previous.filter((lead) => lead.id !== id)
      );
    } catch (err) {
      console.error("Delete lead error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to delete lead."
      );
    }
  }

  const filteredLeads = leads.filter((lead) => {
    const text = [
      lead.name,
      lead.email,
      lead.phone,
      lead.company,
      lead.city,
      lead.category,
      lead.source,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || lead.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) =>
    clients.find((client) => client.id === clientId)?.name ||
    "Unknown Client";

  const countStatus = (status: LeadStatus) =>
    leads.filter((lead) => lead.status === status).length;

  return (
    <section className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <h3 className="text-xl font-bold">All Leads</h3>
          <p className="mt-1 text-sm text-gray-500">
            Manage potential customers and track their progress.
          </p>
        </div>

        <button
          onClick={openAddForm}
          disabled={clients.length === 0}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add Lead
        </button>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { title: "Total Leads", value: leads.length },
          { title: "New", value: countStatus("new") },
          { title: "Contacted", value: countStatus("contacted") },
          { title: "Qualified", value: countStatus("qualified") },
          { title: "Converted", value: countStatus("converted") },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{item.title}</p>
            <h3 className="mt-2 text-2xl font-bold">
              {loading ? "..." : item.value}
            </h3>
          </div>
        ))}
      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* SEARCH AND FILTER */}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border bg-white px-4 py-3 text-sm"
        >
          <option value="all">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
      </div>

      {/* ADD / EDIT FORM */}

      {showForm && (
        <form
          onSubmit={saveLead}
          className="rounded-xl border bg-white p-5 shadow-sm"
        >
          <h3 className="mb-5 text-lg font-bold">
            {editId ? "Edit Lead" : "Add New Lead"}
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

            <input
              required
              placeholder="Lead Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="Phone Number"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="Company"
              value={form.company}
              onChange={(e) =>
                setForm({ ...form, company: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="Website"
              value={form.website}
              onChange={(e) =>
                setForm({ ...form, website: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="City"
              value={form.city}
              onChange={(e) =>
                setForm({ ...form, city: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="Lead Source"
              value={form.source}
              onChange={(e) =>
                setForm({ ...form, source: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <input
              placeholder="Source URL"
              value={form.source_url}
              onChange={(e) =>
                setForm({ ...form, source_url: e.target.value })
              }
              className="rounded-lg border p-3"
            />

            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as LeadStatus,
                })
              }
              className="rounded-lg border p-3"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
              rows={3}
              className="rounded-lg border p-3 md:col-span-2"
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
                  ? "Update Lead"
                  : "Save Lead"}
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

      {/* LEADS TABLE */}

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="p-4">LEAD</th>
              <th className="p-4">COMPANY</th>
              <th className="p-4">CLIENT</th>
              <th className="p-4">SOURCE</th>
              <th className="p-4">STATUS</th>
              <th className="p-4">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  Loading leads...
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  No leads found.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="p-4">
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.email}</p>
                  </td>

                  <td className="p-4 text-sm">
                    {lead.company || "—"}
                  </td>

                  <td className="p-4 text-sm">
                    {getClientName(lead.client_id)}
                  </td>

                  <td className="p-4 text-sm">
                    {lead.source || "—"}
                  </td>

                  <td className="p-4">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                      {formatStatus(lead.status)}
                    </span>
                  </td>

                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openEditForm(lead)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        Showing {filteredLeads.length} of {leads.length} leads
      </p>

      {clients.length === 0 && !loading && (
        <p className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          Please add a client first. Every lead must be linked to a client.
        </p>
      )}
    </section>
  );
}