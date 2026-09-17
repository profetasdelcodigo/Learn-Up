"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import PushPermissionButton from "./PushPermissionButton";

export default function PushNotificationManager() {
  const supabase = useMemo(() => createClient(), []);
  const [enabled, setEnabled] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const syncEnabled = () => {
      const isEnabled = localStorage.getItem("learnup_push_enabled") === "true";
      setEnabled(isEnabled);
      setShowButton(!isEnabled);
    };

    syncEnabled();
    window.addEventListener("learnup:push-enabled", syncEnabled);
    window.addEventListener("learnup:push-disabled", syncEnabled);
    return () => {
      window.removeEventListener("learnup:push-enabled", syncEnabled);
      window.removeEventListener("learnup:push-disabled", syncEnabled);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled && session) {
        const isEnabled = localStorage.getItem("learnup_push_enabled") === "true";
        setShowButton(!isEnabled);
      }
    };

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!enabled) return;

    async function setupPush() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!publicVapidKey) return;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
          });
        }

        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "subscribe",
            subscription: subscription.toJSON(),
          }),
        });
      } catch (e) {
        console.error("Error setting up push notifications:", e);
      }
    }

    void setupPush();
  }, [enabled, supabase]);

  if (!showButton || enabled) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[95] max-w-[calc(100vw-2rem)] sm:bottom-6 sm:right-6">
      <PushPermissionButton />
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
