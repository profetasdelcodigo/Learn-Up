"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import PushPermissionButton from "./PushPermissionButton";

export default function PushNotificationManager() {
  const supabase = useMemo(() => createClient(), []);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("Could not register Learn Up service worker:", error);
      }
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setAuthenticated(!!session);
    };

    void registerServiceWorker();
    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setAuthenticated(!!session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (!authenticated) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[95] max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-6">
      <PushPermissionButton />
    </div>
  );
}
