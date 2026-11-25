"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      const publicPaths = [
        "/login",
        "/forgot-password",
        "/reset-password",
        "/auth/callback",
      ];

      const currentPath = pathname.toLowerCase();

      if (!data.session && !publicPaths.includes(currentPath)) {
        router.replace("/login");
        return;
      }

      if (data.session && currentPath === "/login") {
        router.replace("/");
        return;
      }

      setChecking(false);
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return (
    <>
      {checking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100">
          Checking login...
        </div>
      )}

      {!checking && <div>{children}</div>}
    </>
  );
}
