"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";

export default function PushPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const addToast = useSetAtom(addToastAtom);

  useEffect(() => {
    const canPush =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setSupported(canPush);
    setEnabled(
      canPush &&
        Notification.permission === "granted" &&
        localStorage.getItem("learnup_push_enabled") === "true",
    );
  }, []);

  if (!supported) return null;

  const enablePush = async () => {
    if (busy || enabled) return;

    setBusy(true);
    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        addToast({
          message: "Las notificaciones push aún no están configuradas en el servidor",
          type: "info",
        });
        return;
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") {
        addToast({ message: "Permiso de notificaciones denegado", type: "info" });
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });
      }

      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          subscription,
        }),
      });

      if (!response.ok) {
        let message = "No se pudo guardar la suscripción push";
        try {
          const body = await response.json();
          if (body?.error) message = body.error;
        } catch {
          // Keep the generic message when the API does not return JSON.
        }
        throw new Error(message);
      }

      localStorage.setItem("learnup_push_enabled", "true");
      window.dispatchEvent(new Event("learnup:push-enabled"));
      setEnabled(true);
      addToast({ message: "Notificaciones push activadas", type: "success" });
    } catch (error) {
      console.error("Error enabling push notifications:", error);
      addToast({
        message: "No se pudieron activar las notificaciones push. Inténtalo de nuevo.",
        type: "info",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={enablePush}
      disabled={busy || enabled}
      className="flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/15 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <BellRing className="h-4 w-4" />
      {enabled ? "Push activado" : busy ? "Activando..." : "Activar push"}
    </button>
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
