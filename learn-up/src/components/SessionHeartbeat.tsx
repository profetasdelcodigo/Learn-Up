"use client";

import { useEffect } from "react";

export default function SessionHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      fetch("/api/auth/session-heartbeat", { method: "POST" }).catch(() => {});
    };

    ping();
    const interval = window.setInterval(ping, 60_000);
    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  return null;
}
