"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";

const PUSH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), PUSH_TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function getPushStatus() {
  const response = await fetch("/api/push", { cache: "no-store", credentials: "include" });
  if (!response.ok) return false;
  const body = await response.json().catch(() => null);
  return body?.enabled === true;
}

async function getLocalPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export default function PushPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const addToast = useSetAtom(addToastAtom);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const canPush =
        typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      setSupported(canPush);
      if (!canPush) return;

      try {
        const localSubscription = await getLocalPushSubscription();
        const localEnabled = Notification.permission === "granted" && !!localSubscription;
        const serverEnabled = localEnabled ? await getPushStatus() : false;
        if (!cancelled) setEnabled(serverEnabled);
      } catch (error) {
        console.warn("Could not load push status:", error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!supported) return null;

  const ensureServiceWorker = async () => {
    let registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) {
      registration = await withTimeout(
        navigator.serviceWorker.register("/sw.js", { scope: "/" }),
        "El servicio de notificaciones tardó demasiado en registrarse",
      );
    }
    await withTimeout(registration.update(), "El servicio de notificaciones tardó demasiado en actualizarse");
    return registration;
  };

  const enablePush = async () => {
    if (busy || enabled) return;
    setBusy(true);

    try {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) throw new Error("Push notifications are not configured");

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        addToast({ message: "Permiso de notificaciones denegado", type: "info" });
        return;
      }

      const registration = await ensureServiceWorker();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
          }),
          "La suscripción push tardó demasiado",
        );
      }

      const response = await withTimeout(
        fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON() }),
        }),
        "El servidor tardó demasiado en guardar la suscripción",
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "No se pudo guardar la suscripción push");
      }

      localStorage.setItem("learnup_push_enabled", "true");
      setEnabled(true);
      window.dispatchEvent(new Event("learnup:push-enabled"));
      addToast({ message: "Notificaciones push activadas", type: "success" });
    } catch (error) {
      console.error("Error enabling push notifications:", error);
      addToast({
        message:
          error instanceof Error && error.message.includes("configured")
            ? "Las notificaciones push aún no están configuradas en el servidor"
            : "No se pudieron activar las notificaciones push. Inténtalo de nuevo.",
        type: "info",
      });
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    if (busy || !enabled) return;
    setBusy(true);

    try {
      const registration = await withTimeout(
        ensureServiceWorker(),
        "El servicio de notificaciones tardó demasiado en iniciar",
      );
      const subscription = await registration.pushManager.getSubscription();

      const response = await withTimeout(
        fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "unsubscribe",
            endpoint: subscription?.endpoint ?? null,
          }),
        }),
        "El servidor tardó demasiado en desactivar las notificaciones",
      );

      if (!response.ok) throw new Error("No se pudo eliminar la suscripción del servidor");

      if (subscription) await withTimeout(subscription.unsubscribe(), "No se pudo desactivar el push del navegador");

      localStorage.removeItem("learnup_push_enabled");
      setEnabled(false);
      window.dispatchEvent(new Event("learnup:push-disabled"));
      addToast({ message: "Notificaciones push desactivadas", type: "success" });
    } catch (error) {
      console.error("Error disabling push notifications:", error);
      addToast({ message: "No se pudieron desactivar las notificaciones push. Inténtalo de nuevo.", type: "info" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={enabled ? disablePush : enablePush}
      disabled={busy}
      className="flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-4 py-2 text-sm font-semibold text-brand-gold hover:bg-brand-gold/15 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {enabled ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
      {busy ? "Procesando..." : enabled ? "Desactivar push" : "Activar push"}
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
