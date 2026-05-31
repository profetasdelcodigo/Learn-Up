"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

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
    const supabase = createClient();

    const forceLocalSignOut = async () => {
      if (cancelled) return;
      cancelled = true;
      await Promise.race([
        supabase.auth.signOut({ scope: "local" }),
        new Promise((resolve) => window.setTimeout(resolve, 800)),
      ]).catch(() => {});
      window.location.replace("/login?reason=session_closed");
    };

    const ping = async () => {
      if (cancelled) return;
      const res = await fetch("/api/auth/session-heartbeat", {
        method: "POST",
      }).catch(() => null);

      if (res?.status === 401) {
        await forceLocalSignOut();
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      currentSessionId = getSessionIdFromJwt(data.session?.access_token);
    });

    const channel = supabase
      .channel("session-revocation")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_sessions" },
        async (payload) => {
          const row = payload.new as {
            session_id?: string;
            revoked_at?: string | null;
          };

          if (
            currentSessionId &&
            row.session_id === currentSessionId &&
            row.revoked_at
          ) {
            await forceLocalSignOut();
          }
        },
      )
      .subscribe();

    ping();
    const interval = window.setInterval(ping, 5_000);
    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.clearInterval(interval);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
