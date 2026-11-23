"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const WORKSPACE_ID = "4548e6ca-9cb5-444f-8250-18fc155d935e";

type TeamMember = {
  user_id: string;
  full_name: string | null;
  role: string;
  joined_at: string | null;
};

type Invitation = {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  created_at: string;
};

export default function TeamManager() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sendingInvite, setSendingInvite] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please log in to view your team.");

      const { data: ownMembership, error: ownError } =
        await supabase
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", WORKSPACE_ID)
          .eq("user_id", user.id)
          .maybeSingle();

      if (ownError) throw ownError;

      if (!ownMembership) {
        throw new Error("You are not a member of this workspace.");
      }

      const owner = ownMembership.role === "owner";
      setIsOwner(owner);

      const { data, error: teamError } = await supabase.rpc(
        "get_workspace_team",
        {
          check_workspace_id: WORKSPACE_ID,
        }
      );

      if (teamError) throw teamError;

      setMembers((data || []) as TeamMember[]);

      if (owner) {
        const { data: inviteData, error: inviteError } =
          await supabase.rpc("get_workspace_invitations", {
            check_workspace_id: WORKSPACE_ID,
          });

        if (inviteError) throw inviteError;

        setInvitations((inviteData || []) as Invitation[]);
      } else {
        setInvitations([]);
      }
    } catch (err) {
      console.error("Load team error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load team members."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function sendInvitation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isOwner) return;

    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setError("Please enter an email address.");
      return;
    }

    setSendingInvite(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: inviteError } =
        await supabase.functions.invoke(
          "invite-workspace-member",
          {
            body: {
              email,
              role: inviteRole,
            },
          }
        );

      if (inviteError) {
        let errorMessage = inviteError.message;

        try {
          const response = inviteError.context as Response;

          if (response) {
            const errorData = await response.clone().json();

            errorMessage =
              errorData?.error || errorMessage;
          }
        } catch {
          // Keep original error message
        }

        throw new Error(errorMessage);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error("Invitation could not be sent.");
      }

      setInviteEmail("");
      setInviteRole("member");

      setSuccess(`Invitation sent to ${email}.`);

      await loadTeam();
    } catch (err) {
      console.error("Send invitation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send invitation."
      );
    } finally {
      setSendingInvite(false);
    }
  }

  async function updateRole(member: TeamMember, newRole: string) {
    if (!isOwner || member.role === "owner") return;

    const confirmed = window.confirm(
      `Change this member's role to ${newRole}?`
    );

    if (!confirmed) return;

    setSavingId(member.user_id);
    setError("");
    setSuccess("");

    try {
      const { data, error: updateError } = await supabase
        .from("workspace_members")
        .update({ role: newRole })
        .eq("workspace_id", WORKSPACE_ID)
        .eq("user_id", member.user_id)
        .neq("role", "owner")
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error("Role update was not permitted.");
      }

      setSuccess("Member role updated successfully.");

      await loadTeam();
    } catch (err) {
      console.error("Update role error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update member role."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function removeMember(member: TeamMember) {
    if (!isOwner || member.role === "owner") return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this member from the workspace?"
    );

    if (!confirmed) return;

    setSavingId(member.user_id);
    setError("");
    setSuccess("");

    try {
      const { data, error: deleteError } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", WORKSPACE_ID)
        .eq("user_id", member.user_id)
        .neq("role", "owner")
        .select("id")
        .maybeSingle();

      if (deleteError) throw deleteError;

      if (!data) {
        throw new Error("Member removal was not permitted.");
      }

      setSuccess("Team member removed successfully.");

      await loadTeam();
    } catch (err) {
      console.error("Remove member error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove team member."
      );
    } finally {
      setSavingId(null);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function roleBadge(role: string) {
    if (role === "owner") {
      return "bg-purple-100 text-purple-700";
    }

    if (role === "admin") {
      return "bg-blue-100 text-blue-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  function statusBadge(status: string) {
    if (status === "accepted") {
      return "bg-green-100 text-green-700";
    }

    if (status === "cancelled") {
      return "bg-red-100 text-red-700";
    }

    return "bg-yellow-100 text-yellow-700";
  }

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm md:p-6">

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">
            Team Management
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Manage workspace members and their access roles.
          </p>
        </div>

        <button
          onClick={loadTeam}
          disabled={loading}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Invite Member */}

      {isOwner && (
        <div className="mb-7 rounded-xl border bg-slate-50 p-5">

          <h4 className="text-base font-semibold">
            Invite Team Member
          </h4>

          <p className="mt-1 text-sm text-gray-500">
            Invite someone to join your FlowMatrix workspace.
          </p>

          <form
            onSubmit={sendInvitation}
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4"
          >

            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
              className="rounded-lg border bg-white px-3 py-3 text-sm md:col-span-2"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border bg-white px-3 py-3 text-sm"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>

            <button
              type="submit"
              disabled={sendingInvite}
              className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sendingInvite ? "Sending..." : "Send Invitation"}
            </button>

          </form>

          <p className="mt-3 text-xs text-gray-500">
            Invitations are sent by email. The member joins after accepting the invitation.
          </p>

        </div>
      )}

      {/* Statistics */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Total Members</p>
          <p className="mt-2 text-2xl font-bold">
            {members.length}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Administrators</p>
          <p className="mt-2 text-2xl font-bold">
            {members.filter((m) => m.role === "admin").length}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Members</p>
          <p className="mt-2 text-2xl font-bold">
            {members.filter((m) => m.role === "member").length}
          </p>
        </div>

      </div>

      {!loading && !isOwner && (
        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          You have view-only access to team management.
        </div>
      )}

      {/* Team Members */}

      <div className="mb-3">
        <h4 className="font-semibold">Workspace Members</h4>
      </div>

      <div className="overflow-x-auto">

        <table className="w-full min-w-[650px] text-left">

          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="p-4">TEAM MEMBER</th>
              <th className="p-4">ROLE</th>
              <th className="p-4">JOINED</th>
              {isOwner && <th className="p-4">ACTIONS</th>}
            </tr>
          </thead>

          <tbody>

            {loading ? (
              <tr>
                <td
                  colSpan={isOwner ? 4 : 3}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  Loading team members...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td
                  colSpan={isOwner ? 4 : 3}
                  className="py-10 text-center text-sm text-gray-500"
                >
                  No team members found.
                </td>
              </tr>
            ) : (
              members.map((member) => (

                <tr
                  key={member.user_id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >

                  <td className="p-4">
                    <p className="text-sm font-medium">
                      {member.full_name || "Unnamed Member"}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      {member.user_id}
                    </p>
                  </td>

                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${roleBadge(member.role)}`}
                    >
                      {member.role}
                    </span>
                  </td>

                  <td className="p-4 text-sm text-gray-500">
                    {formatDate(member.joined_at)}
                  </td>

                  {isOwner && (
                    <td className="p-4">

                      {member.role === "owner" ? (
                        <span className="text-xs text-gray-400">
                          Protected
                        </span>
                      ) : (
                        <div className="flex flex-col gap-2">

                          <select
                            value={member.role}
                            disabled={savingId === member.user_id}
                            onChange={(e) =>
                              updateRole(member, e.target.value)
                            }
                            className="rounded-lg border p-2 text-xs disabled:opacity-50"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>

                          <button
                            onClick={() => removeMember(member)}
                            disabled={savingId === member.user_id}
                            className="text-left text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            Remove Member
                          </button>

                        </div>
                      )}

                    </td>
                  )}

                </tr>

              ))
            )}

          </tbody>

        </table>

      </div>

      {/* Invitation History */}

      {isOwner && (
        <div className="mt-8">

          <h4 className="mb-3 font-semibold">
            Invitation History
          </h4>

          <div className="overflow-x-auto rounded-lg border">

            <table className="w-full min-w-[600px] text-left">

              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="p-4">EMAIL</th>
                  <th className="p-4">ROLE</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4">DATE</th>
                </tr>
              </thead>

              <tbody>

                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-sm text-gray-500">
                      Loading invitations...
                    </td>
                  </tr>
                ) : invitations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-sm text-gray-500">
                      No invitations found.
                    </td>
                  </tr>
                ) : (
                  invitations.map((invitation) => (

                    <tr
                      key={invitation.id}
                      className="border-t"
                    >

                      <td className="p-4 text-sm">
                        {invitation.invited_email}
                      </td>

                      <td className="p-4 text-sm capitalize">
                        {invitation.role}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusBadge(invitation.status)}`}
                        >
                          {invitation.status}
                        </span>
                      </td>

                      <td className="p-4 text-sm text-gray-500">
                        {formatDate(invitation.created_at)}
                      </td>

                    </tr>

                  ))
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

      <div className="mt-5 text-sm text-gray-500">
        Showing {members.length} team members.
      </div>

    </section>
  );
}