"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { clearAuthStorage, clearLearnUpPwaState } from "@/lib/auth-logout";

function getSessionIdFromJwt(token?: string | null) {
  const payload = token?.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = JSON.parse(window.atob(padded));
    return typeof decoded.session_id === "string" ? decoded.session_id : null;
  } catch {
    return null;
  }
}

export default function SessionHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    let currentSessionId: string | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;
    const supabase = createClient();

    const forceLocalSignOut = async () => {
      if (cancelled) return;
      cancelled = true;
      clearAuthStorage();
      await Promise.race([
        clearLearnUpPwaState(),
        new Promise((resolve) => window.setTimeout(resolve, 800)),
      ]).catch(() => {});
      window.location.replace("/login?reason=session_closed");
    };

    const ping = async () => {
      if (cancelled || !currentSessionId) return;
      const res = await fetch("/api/auth/session-heartbeat", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);

      if (res?.status === 401) {
        await forceLocalSignOut();
      }
    };

    const subscribeToRevocation = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      currentSessionId = getSessionIdFromJwt(data.session?.access_token);
      if (!currentSessionId) return;

      // Listen for UPDATE (revoked_at set) on the current user_sessions row.
      channel = supabase
        .channel(`session-revocation:${currentSessionId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "user_sessions",
            filter: `session_id=eq.${currentSessionId}`,
          },
          async (payload) => {
            const row = payload.new as {
              session_id?: string;
              revoked_at?: string | null;
            };

            if (row.session_id === currentSessionId && row.revoked_at) {
              await forceLocalSignOut();
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "user_sessions",
            filter: `session_id=eq.${currentSessionId}`,
          },
          async (payload) => {
            const old = payload.old as { session_id?: string };
            if (old.session_id === currentSessionId) {
              await forceLocalSignOut();
            }
          },
        )
        .subscribe();

      await ping();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void ping();
    };

    void subscribeToRevocation();
    const interval = window.setInterval(ping, 30_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
