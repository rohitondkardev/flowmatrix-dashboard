"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function InvitationCallback() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState(
    "Invitation verify ho raha hai..."
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function acceptInvitation() {
      try {
        const params = new URLSearchParams(window.location.search);

        const authError =
          params.get("error_description") ||
          params.get("error");

        if (authError) throw new Error(authError);

        const invitationId = params.get("invitation_id");

        if (!invitationId) {
          throw new Error("Invitation ID missing hai.");
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          throw new Error("Login session nahi mila.");
        }

        setMessage("Workspace invitation accept ho raha hai...");

        const { data, error } = await supabase.rpc(
          "accept_workspace_invitation",
          {
            p_invitation_id: invitationId,
          }
        );

        if (error) throw error;

        if (!data?.success) {
          throw new Error("Invitation accept nahi ho paya.");
        }

        setMessage("Invitation accepted! Dashboard open ho raha hai...");

        router.replace("/");
      } catch (error) {
        console.error("Invitation callback error:", error);

        setMessage(
          error instanceof Error
            ? error.message
            : "Invitation accept karne mein error aaya."
        );
      }
    }

    acceptInvitation();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-slate-900">
          FlowMatrix Invitation
        </h1>

        <p className="mt-4 text-sm text-slate-600">
          {message}
        </p>
      </div>
    </div>
  );
}
