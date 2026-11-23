"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  name: string;
  status: string;
};

type StatusRow = {
  id: string;
  status: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type ActivityDetails = {
  name?: string;
  table?: string;
  operation?: string;
  record_id?: string;
  status?: string;
};

type Activity = {
  id: string;
  action: string;
  actor: string;
  details: ActivityDetails | string | null;
  created_at: string;
};

type ReportData = {
  totalClients: number;
  activeClients: number;
  pendingClients: number;
  inactiveClients: number;
  totalProjects: number;
  activeProjects: number;
  pendingProjects: number;
  completedProjects: number;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  totalApprovals: number;
  pendingApprovals: number;
  approvedApprovals: number;
  rejectedApprovals: number;
};

type ReportSection = {
  title: string;
  total: number;
  items: [string, number][];
};

const emptyReport: ReportData = {
  totalClients: 0,
  activeClients: 0,
  pendingClients: 0,
  inactiveClients: 0,
  totalProjects: 0,
  activeProjects: 0,
  pendingProjects: 0,
  completedProjects: 0,
  totalLeads: 0,
  newLeads: 0,
  contactedLeads: 0,
  qualifiedLeads: 0,
  convertedLeads: 0,
  lostLeads: 0,
  totalApprovals: 0,
  pendingApprovals: 0,
  approvedApprovals: 0,
  rejectedApprovals: 0,
};

const normalize = (status: string | null | undefined) =>
  (status || "").toLowerCase().trim();

function getActivityTitle(action: string) {
  const [table, operation] = action.toLowerCase().split("_");

  const tableNames: Record<string, string> = {
    clients: "Client",
    projects: "Project",
    leads: "Lead",
    approvals: "Approval",
  };

  const operationNames: Record<string, string> = {
    insert: "Created",
    update: "Updated",
    delete: "Deleted",
  };

  return `${tableNames[table] || "Record"} ${
    operationNames[operation] || "Changed"
  }`;
}

function getActivityDescription(activity: Activity) {
  if (!activity.details) return "Workspace activity";

  let details: ActivityDetails = {};

  if (typeof activity.details === "string") {
    try {
      details = JSON.parse(activity.details);
    } catch {
      return activity.details;
    }
  } else {
    details = activity.details;
  }

  const name = details.name || "Unnamed record";

  const tableNames: Record<string, string> = {
    clients: "Client",
    projects: "Project",
    leads: "Lead",
    approvals: "Approval",
  };

  const tableName = tableNames[details.table || ""] || "Record";

  return `${name} — ${tableName} activity`;
}

function getActorLabel(
  actor: string,
  profileNames: Record<string, string>
) {
  if (!actor || actor === "system") return "System";

  return profileNames[actor] || "Workspace Member";
}

export default function ReportsManager() {
  const [report, setReport] = useState<ReportData>(emptyReport);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      if (!userData.user) {
        throw new Error("Please login to view reports.");
      }

      const { data: memberships, error: membershipError } =
        await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", userData.user.id);

      if (membershipError) throw membershipError;

      const workspaceIds = [
        ...new Set(
          (memberships || []).map((item) => item.workspace_id)
        ),
      ];

      if (workspaceIds.length === 0) {
        setReport(emptyReport);
        setActivities([]);
        setProfileNames({});
        return;
      }

      const { data: clients, error: clientsError } =
        await supabase
          .from("clients")
          .select("id, name, status")
          .in("workspace_id", workspaceIds);

      if (clientsError) throw clientsError;

      const clientList: Client[] = clients || [];
      const clientIds = clientList.map((client) => client.id);

      if (clientIds.length === 0) {
        setReport(emptyReport);
        setActivities([]);
        setProfileNames({});
        return;
      }

      const [
        projectsResult,
        leadsResult,
        approvalsResult,
        activityResult,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("id, status")
          .in("client_id", clientIds),

        supabase
          .from("leads")
          .select("id, status")
          .in("client_id", clientIds),

        supabase
          .from("approvals")
          .select("id, status")
          .in("client_id", clientIds),

        supabase
          .from("activity_logs")
          .select("id, action, actor, details, created_at")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (projectsResult.error) throw projectsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (approvalsResult.error) throw approvalsResult.error;
      if (activityResult.error) throw activityResult.error;

      const projectList: StatusRow[] =
        projectsResult.data || [];

      const leadList: StatusRow[] =
        leadsResult.data || [];

      const approvalList: StatusRow[] =
        approvalsResult.data || [];

      const activityList: Activity[] =
        (activityResult.data || []) as Activity[];

      // Activity actor IDs se profile names fetch karo
      const actorIds = [
        ...new Set(
          activityList
            .map((activity) => activity.actor)
            .filter((actor) => actor && actor !== "system")
        ),
      ];

      const namesMap: Record<string, string> = {};

      if (actorIds.length > 0) {
        const { data: profiles, error: profilesError } =
          await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", actorIds);

        if (!profilesError && profiles) {
          (profiles as Profile[]).forEach((profile) => {
            namesMap[profile.id] =
              profile.full_name?.trim() || "Workspace Member";
          });
        }
      }

      setProfileNames(namesMap);

      setReport({
        totalClients: clientList.length,

        activeClients: clientList.filter(
          (item) => normalize(item.status) === "active"
        ).length,

        pendingClients: clientList.filter(
          (item) => normalize(item.status) === "pending"
        ).length,

        inactiveClients: clientList.filter(
          (item) => normalize(item.status) === "inactive"
        ).length,

        totalProjects: projectList.length,

        activeProjects: projectList.filter(
          (item) => normalize(item.status) === "active"
        ).length,

        pendingProjects: projectList.filter(
          (item) => normalize(item.status) === "pending"
        ).length,

        completedProjects: projectList.filter(
          (item) => normalize(item.status) === "completed"
        ).length,

        totalLeads: leadList.length,

        newLeads: leadList.filter(
          (item) => normalize(item.status) === "new"
        ).length,

        contactedLeads: leadList.filter(
          (item) => normalize(item.status) === "contacted"
        ).length,

        qualifiedLeads: leadList.filter(
          (item) => normalize(item.status) === "qualified"
        ).length,

        convertedLeads: leadList.filter(
          (item) => normalize(item.status) === "converted"
        ).length,

        lostLeads: leadList.filter(
          (item) => normalize(item.status) === "lost"
        ).length,

        totalApprovals: approvalList.length,

        pendingApprovals: approvalList.filter(
          (item) => normalize(item.status) === "pending"
        ).length,

        approvedApprovals: approvalList.filter(
          (item) => normalize(item.status) === "approved"
        ).length,

        rejectedApprovals: approvalList.filter(
          (item) => normalize(item.status) === "rejected"
        ).length,
      });

      setActivities(activityList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  function exportCSV() {
    const rows: (string | number)[][] = [
      ["Report", "Count"],
      ["Total Clients", report.totalClients],
      ["Active Clients", report.activeClients],
      ["Pending Clients", report.pendingClients],
      ["Inactive Clients", report.inactiveClients],
      ["Total Projects", report.totalProjects],
      ["Active Projects", report.activeProjects],
      ["Pending Projects", report.pendingProjects],
      ["Completed Projects", report.completedProjects],
      ["Total Leads", report.totalLeads],
      ["New Leads", report.newLeads],
      ["Contacted Leads", report.contactedLeads],
      ["Qualified Leads", report.qualifiedLeads],
      ["Converted Leads", report.convertedLeads],
      ["Lost Leads", report.lostLeads],
      ["Total Approvals", report.totalApprovals],
      ["Pending Approvals", report.pendingApprovals],
      ["Approved Approvals", report.approvedApprovals],
      ["Rejected Approvals", report.rejectedApprovals],
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value).replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "flowmatrix-report.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  const sections: ReportSection[] = [
    {
      title: "Clients",
      total: report.totalClients,
      items: [
        ["Active", report.activeClients],
        ["Pending", report.pendingClients],
        ["Inactive", report.inactiveClients],
      ],
    },
    {
      title: "Projects",
      total: report.totalProjects,
      items: [
        ["Active", report.activeProjects],
        ["Pending", report.pendingProjects],
        ["Completed", report.completedProjects],
      ],
    },
    {
      title: "Leads",
      total: report.totalLeads,
      items: [
        ["New", report.newLeads],
        ["Contacted", report.contactedLeads],
        ["Qualified", report.qualifiedLeads],
        ["Converted", report.convertedLeads],
        ["Lost", report.lostLeads],
      ],
    },
    {
      title: "Approvals",
      total: report.totalApprovals,
      items: [
        ["Pending", report.pendingApprovals],
        ["Approved", report.approvedApprovals],
        ["Rejected", report.rejectedApprovals],
      ],
    },
  ];

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Reports
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Business workspace performance and analytics.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadReports()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Refresh
          </button>

          <button
            onClick={exportCSV}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-500">
              Total {section.title}
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-800">
              {section.total}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              {section.title} Breakdown
            </h3>

            <div className="space-y-4">
              {section.items.map(([label, value]) => {
                const percentage =
                  section.total > 0
                    ? (value / section.total) * 100
                    : 0;

                return (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-600">
                        {label}
                      </span>

                      <span className="font-semibold text-slate-800">
                        {value}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">
          Recent Workspace Activity
        </h3>

        {activities.length === 0 ? (
          <p className="py-5 text-center text-sm text-slate-500">
            No recent activity available.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {getActivityTitle(activity.action)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {getActivityDescription(activity)}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    By: {getActorLabel(activity.actor, profileNames)}
                  </p>
                </div>

                <span className="text-xs text-slate-400">
                  {new Date(
                    activity.created_at
                  ).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}