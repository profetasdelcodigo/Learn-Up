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
    setEnabled(localStorage.getItem("learnup_push_enabled") === "true");
  }, []);

  if (!supported) return null;

  const enablePush = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        addToast({ message: "Permiso de notificaciones denegado", type: "info" });
        return;
      }

      localStorage.setItem("learnup_push_enabled", "true");
      window.dispatchEvent(new Event("learnup:push-enabled"));
      setEnabled(true);
      addToast({ message: "Notificaciones push activadas", type: "success" });
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
